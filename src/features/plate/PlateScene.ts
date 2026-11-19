/**
 * The three.js side of the plate. It draws only when something changes (a
 * drag, a new setting, the opening spin), so an idle plate costs no battery.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ColorManagement,
  DataTexture,
  DoubleSide,
  LinearSRGBColorSpace,
  Line,
  LineBasicMaterial,
  Mesh,
  NoColorSpace,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { contourInterval, type PlateGeometry } from "./geometry";
import type { PlateExtras } from "./extras";
import { paletteRamp, type ReliefPalette } from "./palettes";
import {
  STYLE_CODE,
  labelFragment,
  labelVertex,
  shadowFragment,
  shadowVertex,
  shellFragment,
  shellVertex,
  surfaceFragment,
  surfaceVertex,
} from "./shaders";

// Colours stay plain sRGB throughout; see shaders.ts.
ColorManagement.enabled = false;

export type PlateStyle = keyof typeof STYLE_CODE;

export interface PlateLook {
  style: PlateStyle;
  ink: string;
  paper: string;
  side: string;
  shadow: boolean;
  /** About how many contour lines run from the lowest to the highest point. */
  lines: number;
  palette: ReliefPalette;
}

const LIGHT = new Vector3(-0.55, 0.75, -0.35).normalize();
const FOV = 24;
const IDLE_SPIN_MS = 1_200;
/** The opening spin stops on its own, so a plate left open does not drain the battery. */
const SPIN_LIMIT_MS = 20_000;

export class PlateScene {
  readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.05, 50);
  private readonly controls: OrbitControls;
  private readonly surfaceMaterial: ShaderMaterial;
  private readonly shellMaterial: ShaderMaterial;
  private readonly shadowMaterial: ShaderMaterial;
  private readonly rimMaterial = new LineBasicMaterial();
  private readonly surface = new Mesh(new BufferGeometry());
  private readonly shell = new Mesh(new BufferGeometry());
  private readonly rim = new Line(new BufferGeometry());
  private readonly shadow: Mesh;
  private readonly labelMaterial: ShaderMaterial;
  private readonly pinMaterial: ShaderMaterial;
  private readonly labelTop = new Mesh(new BufferGeometry());
  private readonly labelShell = new Mesh(new BufferGeometry());
  private readonly pin = new Mesh(new BufferGeometry());
  private readonly peakTag = new Sprite(
    new SpriteMaterial({ depthTest: false, transparent: true }),
  );
  private labelTexture: CanvasTexture | null = null;
  private readonly ramp = new DataTexture(new Uint8Array(256 * 4), 256, 1, RGBAFormat);
  private palette: ReliefPalette | null = null;
  private reach = 0.5;
  private drape: CanvasTexture | null = null;
  private frame = 0;
  private activeUntil = 0;
  private plateHeight = 0;
  private baseDepth = 0;
  private elevationRange: [number, number] = [0, 1];
  private lines = 30;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private readonly createdAt = performance.now();
  /** Called once the user turns or zooms the plate. */
  onInteract?: () => void;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.5 : 2));

    this.surfaceMaterial = new ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      uniforms: {
        uStyle: { value: 0 },
        uInk: { value: new Color() },
        uPaper: { value: new Color() },
        uInterval: { value: 50 },
        uMin: { value: 0 },
        uMax: { value: 1 },
        uLineScale: { value: 1 },
        uLight: { value: LIGHT },
        uDrape: { value: null },
        uHasDrape: { value: false },
        uRamp: { value: this.ramp },
      },
    });
    this.ramp.colorSpace = NoColorSpace;
    this.labelMaterial = new ShaderMaterial({
      vertexShader: labelVertex,
      fragmentShader: labelFragment,
      uniforms: {
        uMask: { value: null },
        uBase: { value: new Color() },
        uText: { value: new Color() },
        uLight: { value: LIGHT },
      },
    });
    this.shellMaterial = new ShaderMaterial({
      vertexShader: shellVertex,
      fragmentShader: shellFragment,
      uniforms: { uSide: { value: new Color() }, uLight: { value: LIGHT } },
    });
    this.shadowMaterial = new ShaderMaterial({
      vertexShader: shadowVertex,
      fragmentShader: shadowFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uInk: { value: new Color() },
        uStripe: { value: 6 },
      },
    });
    this.pinMaterial = this.shellMaterial.clone();
    this.pinMaterial.uniforms.uSide.value = new Color();
    this.surface.material = this.surfaceMaterial;
    this.shell.material = this.shellMaterial;
    this.labelTop.material = this.labelMaterial;
    this.labelShell.material = this.shellMaterial;
    this.pin.material = this.pinMaterial;
    this.peakTag.renderOrder = 10;
    this.peakTag.center.set(0.5, 0);
    for (const object of [this.labelTop, this.labelShell, this.pin, this.peakTag]) {
      object.visible = false;
    }
    this.rim.material = this.rimMaterial;
    this.shadow = new Mesh(new BufferGeometry(), this.shadowMaterial);
    this.shadow.renderOrder = -1;
    this.scene.add(
      this.shadow,
      this.shell,
      this.surface,
      this.rim,
      this.labelTop,
      this.labelShell,
      this.pin,
      this.peakTag,
    );

    this.camera.position.setFromSphericalCoords(3.4, (52 * Math.PI) / 180, (-28 * Math.PI) / 180);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.09,
      enablePan: false,
      minDistance: 1.3,
      maxDistance: 7,
      minPolarAngle: (8 * Math.PI) / 180,
      maxPolarAngle: (82 * Math.PI) / 180,
      rotateSpeed: 0.7,
      autoRotateSpeed: 0.8,
    });
    this.controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.controls.addEventListener("start", () => {
      if (this.controls.autoRotate) {
        this.controls.autoRotate = false;
        this.onInteract?.();
      }
      this.wake(Infinity);
    });
    // "end" leaves time for the damped glide to finish. There is no "change"
    // listener: damping reports tiny changes every frame and would never rest.
    this.controls.addEventListener("end", () => this.wake(IDLE_SPIN_MS));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.resize();
  }

  private handleVisibility = () => {
    if (!document.hidden) this.wake(IDLE_SPIN_MS);
  };

  /** Keeps drawing for `ms` (or until the next "end" for Infinity), then rests. */
  private wake(ms: number) {
    if (this.disposed) return;
    this.activeUntil =
      ms === Infinity
        ? Infinity
        : Math.max(this.activeUntil === Infinity ? 0 : this.activeUntil, performance.now() + ms);
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    this.frame = 0;
    if (this.disposed) return;
    if (this.controls.autoRotate && performance.now() - this.createdAt > SPIN_LIMIT_MS) {
      this.controls.autoRotate = false;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    const spinning = this.controls.autoRotate && !document.hidden;
    // controls.update() may already have queued the next frame through wake().
    if (!this.frame && (spinning || performance.now() < this.activeUntil)) {
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  private resize() {
    const { clientWidth, clientHeight } = this.canvas;
    if (!clientWidth || !clientHeight) return;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / clientHeight;
    this.fitCamera();
    this.wake(0);
  }

  /** Distance that keeps the whole plate and its shadow in view for this aspect ratio. */
  private fitCamera() {
    // Half the diagonal, plus room for the shadow, the relief and the nameplate.
    const radius = 0.76 + this.plateHeight * 0.3 + Math.max(0, this.reach - 0.5) * 0.7;
    const vertical = ((FOV / 2) * Math.PI) / 180;
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const distance = radius / Math.sin(Math.min(vertical, horizontal));
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(distance);
    this.controls.target.set(
      0.04,
      (this.plateHeight - this.baseDepth) / 2,
      0.04 + Math.max(0, this.reach - 0.5) / 2,
    );
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.maxDistance = distance * 2.2;
    this.camera.updateProjectionMatrix();
  }

  setGeometry(geometry: PlateGeometry) {
    const surface = new BufferGeometry();
    surface.setAttribute("position", new BufferAttribute(geometry.surface, 3));
    surface.setAttribute("uv", new BufferAttribute(geometry.uvs, 2));
    surface.setAttribute("elevation", new BufferAttribute(geometry.elevations, 1));
    surface.setIndex(new BufferAttribute(geometry.surfaceIndex, 1));
    surface.computeVertexNormals();
    this.surface.geometry.dispose();
    this.surface.geometry = surface;

    const shell = new BufferGeometry();
    shell.setAttribute("position", new BufferAttribute(geometry.shell, 3));
    shell.computeVertexNormals();
    this.shell.geometry.dispose();
    this.shell.geometry = shell;

    // The rim line sits on the top edge of the walls.
    const ringCount = geometry.outline.length / 2;
    const rim = new Float32Array((ringCount + 1) * 3);
    for (let k = 0; k <= ringCount; k++) {
      const wall = (k % ringCount) * 27;
      rim.set(geometry.shell.subarray(wall, wall + 3), k * 3);
    }
    const rimGeometry = new BufferGeometry();
    rimGeometry.setAttribute("position", new BufferAttribute(rim, 3));
    this.rim.geometry.dispose();
    this.rim.geometry = rimGeometry;

    this.plateHeight = (geometry.max - geometry.min) * geometry.verticalScale;
    this.baseDepth = geometry.baseDepth;
    // The shadow is the plate's outline, flat on the ground and shifted away
    // from the light, so it fits every shape.
    const ring = geometry.outline;
    const fan = new Float32Array((ring.length / 2) * 9);
    for (let k = 0, n = ring.length / 2; k < n; k++) {
      const next = (k + 1) % n;
      fan.set(
        [0, 0, 0, ring[next * 2], 0, ring[next * 2 + 1], ring[k * 2], 0, ring[k * 2 + 1]],
        k * 9,
      );
    }
    const shadowGeometry = new BufferGeometry();
    shadowGeometry.setAttribute("position", new BufferAttribute(fan, 3));
    this.shadow.geometry.dispose();
    this.shadow.geometry = shadowGeometry;
    const reach = 0.05 + (geometry.baseDepth + this.plateHeight) * 0.4;
    this.shadow.position.set(reach, -geometry.baseDepth - 0.0005, reach * 0.8);

    this.elevationRange = [geometry.min, geometry.max];
    const u = this.surfaceMaterial.uniforms;
    u.uMin.value = geometry.min;
    u.uMax.value = Math.max(geometry.max, geometry.min + 1);
    u.uInterval.value = contourInterval(geometry.min, geometry.max, this.lines);
    this.fitCamera();
    this.wake(IDLE_SPIN_MS);
  }

  setLook(look: PlateLook) {
    const u = this.surfaceMaterial.uniforms;
    u.uStyle.value = STYLE_CODE[look.style];
    u.uInk.value.set(look.ink);
    u.uPaper.value.set(look.paper);
    this.lines = look.lines;
    u.uInterval.value = contourInterval(...this.elevationRange, look.lines);
    if (look.palette !== this.palette) {
      this.palette = look.palette;
      (this.ramp.image.data as Uint8Array).set(paletteRamp(look.palette));
      this.ramp.needsUpdate = true;
    }
    this.shellMaterial.uniforms.uSide.value.set(look.side);
    this.labelMaterial.uniforms.uBase.value.set(look.side);
    this.labelMaterial.uniforms.uText.value.set(look.paper);
    this.pinMaterial.uniforms.uSide.value.set(look.ink);
    this.shadowMaterial.uniforms.uInk.value.set(look.side);
    this.rimMaterial.color.set(look.ink);
    this.shadow.visible = look.shadow;
    this.wake(0);
  }

  /** The nameplate and summit pin; null removes them. `peakText` labels the pin. */
  setExtras(extras: PlateExtras | null, peakText = "") {
    const label = extras?.label;
    this.labelTexture?.dispose();
    this.labelTexture = null;
    if (label) {
      const top = new BufferGeometry();
      top.setAttribute("position", new BufferAttribute(label.surface, 3));
      top.setAttribute("uv", new BufferAttribute(label.uvs, 2));
      top.setIndex(new BufferAttribute(label.index, 1));
      top.computeVertexNormals();
      this.labelTop.geometry.dispose();
      this.labelTop.geometry = top;
      const shell = new BufferGeometry();
      shell.setAttribute("position", new BufferAttribute(label.shell, 3));
      shell.computeVertexNormals();
      this.labelShell.geometry.dispose();
      this.labelShell.geometry = shell;
      // Row 0 of the canvas is the north edge, where v = 0.
      this.labelTexture = new CanvasTexture(label.texture);
      this.labelTexture.flipY = false;
      this.labelTexture.colorSpace = NoColorSpace;
      this.labelTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    }
    this.labelMaterial.uniforms.uMask.value = this.labelTexture;
    this.labelTop.visible = this.labelShell.visible = Boolean(label);

    const pin = extras?.pin;
    if (pin) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(pin.soup, 3));
      geometry.computeVertexNormals();
      this.pin.geometry.dispose();
      this.pin.geometry = geometry;
    }
    this.pin.visible = Boolean(pin);
    const material = this.peakTag.material;
    material.map?.dispose();
    material.map = null;
    if (pin && peakText) {
      const canvas = tagCanvas(peakText);
      material.map = new CanvasTexture(canvas);
      material.map.colorSpace = NoColorSpace;
      material.needsUpdate = true;
      const height = 0.05;
      this.peakTag.scale.set((height * canvas.width) / canvas.height, height, 1);
      this.peakTag.position.set(pin.tip[0], pin.tip[1] + 0.012, pin.tip[2]);
    }
    this.peakTag.visible = Boolean(pin && peakText);

    this.reach = extras?.reach ?? 0.5;
    this.fitCamera();
    this.wake(IDLE_SPIN_MS);
  }

  /** Map or satellite image laid over the terrain; null clears it. */
  setDrape(image: HTMLCanvasElement | null) {
    this.drape?.dispose();
    this.drape = null;
    if (image) {
      this.drape = new CanvasTexture(image);
      // Row 0 of the image is the north edge, where the surface's v = 0.
      this.drape.flipY = false;
      this.drape.colorSpace = NoColorSpace;
      this.drape.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    }
    this.surfaceMaterial.uniforms.uDrape.value = this.drape;
    this.surfaceMaterial.uniforms.uHasDrape.value = Boolean(image);
    this.wake(0);
  }

  /** Renders a square image of the current view at `size` pixels, with a transparent background. */
  snapshot(size: number): HTMLCanvasElement {
    const max = Math.min(this.renderer.capabilities.maxTextureSize, 4096);
    const edge = Math.min(size, max);
    const target = new WebGLRenderTarget(edge, edge, { samples: 4 });
    const camera = this.camera.clone();
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    const pixelRatio = this.renderer.getPixelRatio();
    const stripe = this.shadowMaterial.uniforms.uStripe;
    const lineScale = this.surfaceMaterial.uniforms.uLineScale;
    const previous = [stripe.value, lineScale.value];
    // Keep stripes and lines the same weight relative to the plate as on screen.
    const scale =
      edge / Math.min(this.canvas.clientWidth, this.canvas.clientHeight || 1) / pixelRatio;
    stripe.value = previous[0] * pixelRatio * scale;
    lineScale.value = previous[1] * Math.max(1, scale * 0.6);

    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, camera);
    const pixels = new Uint8Array(edge * edge * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, edge, edge, pixels);
    this.renderer.setRenderTarget(null);
    target.dispose();
    [stripe.value, lineScale.value] = previous;
    this.wake(0);

    const canvas = Object.assign(document.createElement("canvas"), { width: edge, height: edge });
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(edge, edge);
    const row = edge * 4;
    for (let y = 0; y < edge; y++) {
      // WebGL rows run bottom-up.
      image.data.set(pixels.subarray((edge - 1 - y) * row, (edge - y) * row), y * row);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  setStripe(pixels: number) {
    this.shadowMaterial.uniforms.uStripe.value = pixels * this.renderer.getPixelRatio();
    this.wake(0);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.controls.dispose();
    this.drape?.dispose();
    this.labelTexture?.dispose();
    this.peakTag.material.map?.dispose();
    this.ramp.dispose();
    for (const object of [
      this.surface,
      this.shell,
      this.shadow,
      this.rim,
      this.labelTop,
      this.labelShell,
      this.pin,
    ]) {
      object.geometry.dispose();
    }
    for (const material of [
      this.surfaceMaterial,
      this.shellMaterial,
      this.shadowMaterial,
      this.rimMaterial,
      this.labelMaterial,
      this.pinMaterial,
      this.peakTag.material,
    ]) {
      material.dispose();
    }
    this.renderer.dispose();
  }
}

/** A small dark pill with white text, for the summit's height. */
function tagCanvas(text: string): HTMLCanvasElement {
  const scale = 4;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontCss = `600 ${13 * scale}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.font = fontCss;
  const width = Math.ceil(ctx.measureText(text).width + 22 * scale);
  canvas.width = width;
  canvas.height = 26 * scale;
  ctx.font = fontCss;
  ctx.fillStyle = "rgba(20, 19, 17, 0.86)";
  ctx.beginPath();
  ctx.roundRect(0, 0, width, 24 * scale, 12 * scale);
  ctx.fill();
  ctx.fillStyle = "#fbfaf7";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, 12.5 * scale);
  return canvas;
}

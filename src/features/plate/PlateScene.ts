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
  Group,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Raycaster,
  Spherical,
  TOUCH,
  Sprite,
  Vector2,
  SpriteMaterial,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { contourInterval, sunAt, sunlight, sunlightFast, type PlateGeometry } from "./geometry";
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
  /** Time of day from 6 (sunrise) to 18 (sunset); 0 keeps the studio light. */
  sunHour: number;
  /** Draw the sea (0 m) as water. */
  water: boolean;
  /** Rock layers on the sides of the box. */
  strata: boolean;
  /** Snow from this share of the relief upwards (0.3 to 0.95); 0 means none. */
  snow: number;
  /** Water up to this many metres above the plate's lowest point; 0 means none. */
  flood: number;
}

const LIGHT = new Vector3(-0.55, 0.75, -0.35).normalize();
const FOV = 24;
/** How long the sun must stand still before its shadows are redone in full detail. */
const SUN_SETTLE_MS = 220;
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
  private readonly markerPins = new Mesh(new BufferGeometry());
  private markerTags: Sprite[] = [];
  private readonly peakTag = new Sprite(
    new SpriteMaterial({ depthTest: false, transparent: true }),
  );
  private labelTexture: CanvasTexture | null = null;
  private readonly ramp = new DataTexture(new Uint8Array(256 * 4), 256, 1, RGBAFormat);
  private palette: ReliefPalette | null = null;
  private reach = 0.5;
  /** The light on the plate: the studio light, or the sun at a chosen hour. */
  private readonly light = LIGHT.clone();
  private sunHour = 0;
  private sunTimer = 0;
  private geometry: PlateGeometry | null = null;
  private extras: PlateExtras | null = null;
  /** A second plate beside the first, at the same scale. */
  private compare: { surface: Mesh; shell: Mesh; material: ShaderMaterial; tags: Sprite[] } | null =
    null;
  private compareShift = 0;
  private look: PlateLook | null = null;
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
  /** Called once the user turns, zooms or moves the plate. */
  onInteract?: () => void;
  /** Called when the view is moved away from the middle of the stage, or back to it. */
  onPan?: (moved: boolean) => void;
  /** Where the view is centred when it has not been moved. */
  private readonly homeTarget = new Vector3();
  /** How far the view may be moved from home, so the plate cannot be lost off screen. */
  private panLimit = 1;
  private moved = false;
  private recentering = false;

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
        uLight: { value: this.light },
        uDrape: { value: null },
        uHasDrape: { value: false },
        uRamp: { value: this.ramp },
        uAo: { value: 0.55 },
        uBake: { value: false },
        uWater: { value: true },
        uSnow: { value: 2 },
        uFlood: { value: -1e9 },
        uWaterMask: { value: null },
        uHasWaterMask: { value: false },
        uOverlay: { value: null },
        uHasOverlay: { value: false },
        uWarmth: { value: 0 },
        uSunMode: { value: false },
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
        uLight: { value: this.light },
      },
    });
    this.shellMaterial = new ShaderMaterial({
      vertexShader: shellVertex,
      fragmentShader: shellFragment,
      uniforms: {
        uSide: { value: new Color() },
        uLight: { value: this.light },
        uStrata: { value: false },
      },
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
    this.pinMaterial.uniforms.uStrata = { value: false };
    this.surface.material = this.surfaceMaterial;
    this.shell.material = this.shellMaterial;
    this.labelTop.material = this.labelMaterial;
    this.labelShell.material = this.shellMaterial;
    this.pin.material = this.pinMaterial;
    this.markerPins.material = this.pinMaterial;
    this.markerPins.visible = false;
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
      this.markerPins,
      this.peakTag,
    );

    this.camera.position.setFromSphericalCoords(3.4, (52 * Math.PI) / 180, (-28 * Math.PI) / 180);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.09,
      enablePan: true,
      screenSpacePanning: true,
      panSpeed: 0.9,
      minDistance: 1.3,
      maxDistance: 7,
      minPolarAngle: (8 * Math.PI) / 180,
      maxPolarAngle: (82 * Math.PI) / 180,
      rotateSpeed: 0.7,
      autoRotateSpeed: 0.8,
    });
    // One finger turns the plate; two fingers move it and pinch to zoom.
    this.controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
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
    if (this.recentering) this.glideHome();
    this.controls.update();
    this.limitPan();
    this.renderer.render(this.scene, this.camera);
    const spinning = this.controls.autoRotate && !document.hidden;
    // controls.update() may already have queued the next frame through wake().
    if (!this.frame && (spinning || performance.now() < this.activeUntil)) {
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  /** Keeps the moved view within reach of the plate, and tells the page when it is off centre. */
  private limitPan() {
    const away = this.controls.target.clone().sub(this.homeTarget);
    const length = away.length();
    if (length > this.panLimit) {
      const back = away.setLength(length - this.panLimit).negate();
      this.controls.target.add(back);
      this.camera.position.add(back);
    }
    const moved = length > this.panLimit * 0.04;
    if (moved !== this.moved) {
      this.moved = moved;
      this.onPan?.(moved);
    }
  }

  private glideHome() {
    const shift = this.homeTarget.clone().sub(this.controls.target);
    if (shift.length() < 1e-4) {
      this.controls.target.add(shift);
      this.camera.position.add(shift);
      this.recentering = false;
      return;
    }
    shift.multiplyScalar(0.22);
    this.controls.target.add(shift);
    this.camera.position.add(shift);
    this.wake(120);
  }

  /** Moves the view from the keyboard: fractions of the reach, right and up on the screen. */
  panBy(right: number, up: number) {
    const forward = new Vector3();
    this.camera.getWorldDirection(forward);
    const across = new Vector3().crossVectors(forward, this.camera.up).normalize();
    const rise = new Vector3().crossVectors(across, forward).normalize();
    const shift = across
      .multiplyScalar(right * this.panLimit)
      .add(rise.multiplyScalar(up * this.panLimit));
    this.controls.target.add(shift);
    this.camera.position.add(shift);
    this.controls.autoRotate = false;
    this.onInteract?.();
    this.wake(IDLE_SPIN_MS);
  }

  /** Brings a moved view back to the middle, gliding unless `instant`. */
  recenter(instant = false) {
    if (instant) {
      const shift = this.homeTarget.clone().sub(this.controls.target);
      this.controls.target.add(shift);
      this.camera.position.add(shift);
      this.recentering = false;
    } else {
      this.recentering = true;
    }
    this.wake(IDLE_SPIN_MS);
  }

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
    // Half the diagonal, plus room for the shadow, the relief, the nameplate and a second plate.
    const radius =
      0.76 +
      this.plateHeight * 0.3 +
      Math.max(0, this.reach - 0.5) * 0.7 +
      this.compareShift * 0.55;
    const vertical = ((FOV / 2) * Math.PI) / 180;
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const distance = radius / Math.sin(Math.min(vertical, horizontal));
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(distance);
    // A view that was moved stays moved when the stage resizes (a phone's address bar, say).
    const moved = this.controls.target.clone().sub(this.homeTarget);
    this.homeTarget.set(
      0.04 + this.compareShift / 2,
      (this.plateHeight - this.baseDepth) / 2,
      0.04 + Math.max(0, this.reach - 0.5) / 2,
    );
    this.controls.target.copy(this.homeTarget).add(moved);
    this.camera.position.copy(this.controls.target).add(offset);
    this.panLimit = radius;
    this.controls.maxDistance = distance * 2.2;
    this.camera.updateProjectionMatrix();
  }

  setGeometry(geometry: PlateGeometry) {
    const surface = new BufferGeometry();
    surface.setAttribute("position", new BufferAttribute(geometry.surface, 3));
    surface.setAttribute("uv", new BufferAttribute(geometry.uvs, 2));
    surface.setAttribute("elevation", new BufferAttribute(geometry.elevations, 1));
    surface.setAttribute("ao", new BufferAttribute(geometry.ao, 1));
    surface.setAttribute(
      "sun",
      new BufferAttribute(new Float32Array(geometry.ao.length).fill(1), 1),
    );
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
    const rimGeometry = new BufferGeometry();
    rimGeometry.setAttribute("position", new BufferAttribute(geometry.rim, 3));
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
    this.geometry = geometry;
    this.applySun();
    const u = this.surfaceMaterial.uniforms;
    u.uMin.value = geometry.min;
    u.uMax.value = Math.max(geometry.max, geometry.min + 1);
    u.uInterval.value = contourInterval(geometry.min, geometry.max, this.lines);
    if (this.look) u.uFlood.value = this.look.flood > 0 ? geometry.min + this.look.flood : -1e9;
    this.fitCamera();
    this.wake(IDLE_SPIN_MS);
  }

  setLook(look: PlateLook) {
    this.look = look;
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
    u.uWater.value = look.water;
    if (look.sunHour !== this.sunHour) {
      this.sunHour = look.sunHour;
      // Quick shadows while the sun moves; the full ones once it has stopped.
      this.applySun(true);
    }
    u.uSnow.value = look.snow > 0 ? look.snow : 2;
    u.uFlood.value = look.flood > 0 ? this.elevationRange[0] + look.flood : -1e9;
    this.shellMaterial.uniforms.uSide.value.set(look.side);
    this.shellMaterial.uniforms.uStrata.value = look.strata;
    this.labelMaterial.uniforms.uBase.value.set(look.side);
    this.labelMaterial.uniforms.uText.value.set(look.paper);
    this.pinMaterial.uniforms.uSide.value.set(look.ink);
    this.shadowMaterial.uniforms.uInk.value.set(look.side);
    this.rimMaterial.color.set(look.ink);
    this.shadow.visible = look.shadow;
    this.wake(0);
  }

  /** Points the light at the sun for the current hour and recomputes the terrain's cast shadows. */
  private applySun(quick = false) {
    if (this.sunTimer) {
      clearTimeout(this.sunTimer);
      this.sunTimer = 0;
    }
    const u = this.surfaceMaterial.uniforms;
    const attribute = this.surface.geometry.getAttribute("sun") as BufferAttribute | undefined;
    if (!this.sunHour || !this.geometry || !attribute) {
      this.light.copy(LIGHT);
      u.uSunMode.value = false;
      this.wake(0);
      return;
    }
    const { direction, warmth } = sunAt(this.sunHour);
    this.light.set(...direction);
    u.uSunMode.value = true;
    u.uWarmth.value = warmth;
    const shade = quick ? sunlightFast : sunlight;
    (attribute.array as Float32Array).set(
      shade(this.geometry.surface, this.geometry.size, direction),
    );
    attribute.needsUpdate = true;
    this.wake(0);
    if (quick && this.geometry.size >= 200) {
      this.sunTimer = window.setTimeout(() => {
        this.sunTimer = 0;
        this.applySun();
      }, SUN_SETTLE_MS);
    }
  }

  /** Finishes the full-detail shadows now, if the sun has only had the quick ones. */
  private settleSun() {
    if (!this.sunTimer) return;
    this.applySun();
  }

  /** The sun's direction for the photo render, or null for the studio light. */
  get sunDirection(): Vector3 | null {
    return this.sunHour ? this.light.clone() : null;
  }

  /** The nameplate and summit pin; null removes them. `peakText` labels the pin. */
  setExtras(
    extras: PlateExtras | null,
    peakText = "",
    photos: Map<string, ImageBitmap> = new Map(),
  ) {
    this.extras = extras;
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

    // Markers: one mesh for every cone, and a name tag above each.
    for (const tag of this.markerTags) {
      this.scene.remove(tag);
      tag.material.map?.dispose();
      tag.material.dispose();
    }
    this.markerTags = [];
    const markers = extras?.markers ?? [];
    if (markers.length) {
      const total = markers.reduce((sum, marker) => sum + marker.soup.length, 0);
      const soup = new Float32Array(total);
      let offset = 0;
      for (const marker of markers) {
        soup.set(marker.soup, offset);
        offset += marker.soup.length;
        const photo = marker.photo ? photos.get(marker.photo) : undefined;
        if (!marker.label && !photo) continue;
        const canvas = photo ? photoCard(photo, marker.label) : tagCanvas(marker.label);
        const map = new CanvasTexture(canvas);
        map.colorSpace = NoColorSpace;
        const tag = new Sprite(new SpriteMaterial({ map, depthTest: false, transparent: true }));
        tag.renderOrder = 10;
        tag.center.set(0.5, 0);
        const height = photo ? 0.16 : 0.042;
        tag.scale.set((height * canvas.width) / canvas.height, height, 1);
        tag.position.set(marker.tip[0], marker.tip[1] + 0.008, marker.tip[2]);
        this.markerTags.push(tag);
        this.scene.add(tag);
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(soup, 3));
      geometry.computeVertexNormals();
      this.markerPins.geometry.dispose();
      this.markerPins.geometry = geometry;
    }
    this.markerPins.visible = markers.length > 0;

    this.reach = extras?.reach ?? 0.5;
    this.fitCamera();
    this.wake(IDLE_SPIN_MS);
  }

  /**
   * The surface's current look (style, contours, colours, map, water) drawn
   * flat into a square texture without lighting, north at the top. Used to
   * colour the realistic photo render and the GLB model.
   */
  bakeSurface(size = 2048): HTMLCanvasElement {
    const edge = Math.min(size, this.renderer.capabilities.maxTextureSize, 4096);
    const target = new WebGLRenderTarget(edge, edge);
    const u = this.surfaceMaterial.uniforms;
    const previous = { lineScale: u.uLineScale.value, side: this.surfaceMaterial.side };
    u.uBake.value = true;
    // Lines are measured in texels here; keep them about as bold as on screen.
    u.uLineScale.value = Math.max(1, edge / 900);
    // In texture space the triangles wind the other way round.
    this.surfaceMaterial.side = DoubleSide;
    const mesh = new Mesh(this.surface.geometry, this.surfaceMaterial);
    mesh.frustumCulled = false;
    const bakeScene = new Scene();
    bakeScene.add(mesh);
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(u.uPaper.value, 1);
    this.renderer.clear();
    this.renderer.render(bakeScene, this.camera);
    const pixels = new Uint8Array(edge * edge * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, edge, edge, pixels);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 0);
    target.dispose();
    u.uBake.value = false;
    u.uLineScale.value = previous.lineScale;
    this.surfaceMaterial.side = previous.side;
    this.wake(0);

    // Pixel row 0 is v = 0, the north edge, which is also the image's top row.
    const canvas = Object.assign(document.createElement("canvas"), { width: edge, height: edge });
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(edge, edge);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  /**
   * The plate rebuilt with standard materials: terrain coloured by the baked
   * surface, box, nameplate and pin. Plate units, y up, base at -baseDepth.
   * The photo render and the GLB export both start from this.
   */
  exportScene(textureSize = 2048): {
    group: Group;
    camera: PerspectiveCamera;
    target: Vector3;
    baseDepth: number;
    sun: Vector3 | null;
  } {
    this.settleSun();
    const look = this.look;
    const linear = (hex: string) => new Color(hex).convertSRGBToLinear();
    const texture = (canvas: HTMLCanvasElement) => {
      const map = new CanvasTexture(canvas);
      map.flipY = false;
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = 8;
      return map;
    };
    const solid = (geometry: BufferGeometry, material: MeshStandardMaterial, name: string) => {
      const copy = geometry.clone();
      // Shader-only data; a GLB would carry it as unknown attributes.
      copy.deleteAttribute("elevation");
      copy.deleteAttribute("ao");
      const mesh = new Mesh(copy, material);
      mesh.name = name;
      return mesh;
    };
    const side = linear(look?.side ?? "#1b1a17");
    const sideMaterial = new MeshStandardMaterial({ color: side, roughness: 0.82, name: "Box" });

    const group = new Group();
    group.name = "teetang.art plate";
    group.add(
      solid(
        this.surface.geometry,
        new MeshStandardMaterial({
          map: texture(this.bakeSurface(textureSize)),
          roughness: 0.9,
          name: "Terrain",
        }),
        "Terrain",
      ),
      solid(this.shell.geometry, sideMaterial, "Box"),
    );
    const label = this.extras?.label;
    if (label && look) {
      // Box-coloured plaque with the letters in the surface colour.
      const mask = label.texture;
      const letters = Object.assign(document.createElement("canvas"), {
        width: mask.width,
        height: mask.height,
      });
      const lettersCtx = letters.getContext("2d")!;
      lettersCtx.drawImage(mask, 0, 0);
      lettersCtx.globalCompositeOperation = "source-in";
      lettersCtx.fillStyle = look.paper;
      lettersCtx.fillRect(0, 0, letters.width, letters.height);
      const plaque = Object.assign(document.createElement("canvas"), {
        width: mask.width,
        height: mask.height,
      });
      const plaqueCtx = plaque.getContext("2d")!;
      plaqueCtx.fillStyle = look.side;
      plaqueCtx.fillRect(0, 0, plaque.width, plaque.height);
      plaqueCtx.drawImage(letters, 0, 0);
      group.add(
        solid(
          this.labelTop.geometry,
          new MeshStandardMaterial({ map: texture(plaque), roughness: 0.75, name: "Nameplate" }),
          "Nameplate",
        ),
        solid(this.labelShell.geometry, sideMaterial, "Nameplate sides"),
      );
    }
    if (this.extras?.pin) {
      group.add(
        solid(
          this.pin.geometry,
          new MeshStandardMaterial({
            color: linear(look?.ink ?? "#1b1a17"),
            roughness: 0.45,
            name: "Summit pin",
          }),
          "Summit pin",
        ),
      );
    }
    if (this.extras?.markers.length) {
      group.add(
        solid(
          this.markerPins.geometry,
          new MeshStandardMaterial({
            color: linear(look?.ink ?? "#1b1a17"),
            roughness: 0.45,
            name: "Markers",
          }),
          "Markers",
        ),
      );
    }
    const camera = this.camera.clone();
    return {
      group,
      camera,
      target: this.controls.target.clone(),
      baseDepth: this.baseDepth,
      sun: this.sunDirection,
    };
  }

  /** Lakes and rivers, white on black over the plate's square; null clears it. */
  setWaterMask(image: HTMLCanvasElement | null) {
    this.setSurfaceTexture("uWaterMask", "uHasWaterMask", image);
  }

  /** Routes and markers drawn on top of the surface, with transparency; null clears it. */
  setOverlay(image: HTMLCanvasElement | null) {
    this.setSurfaceTexture("uOverlay", "uHasOverlay", image);
  }

  private setSurfaceTexture(name: string, flag: string, image: HTMLCanvasElement | null) {
    const u = this.surfaceMaterial.uniforms;
    (u[name].value as CanvasTexture | null)?.dispose();
    let texture: CanvasTexture | null = null;
    if (image) {
      texture = new CanvasTexture(image);
      // Row 0 is the north edge, where v = 0.
      texture.flipY = false;
      texture.colorSpace = NoColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    }
    u[name].value = texture;
    u[flag].value = Boolean(image);
    this.wake(0);
  }

  /** The point of the terrain under a screen position, in plate texture coordinates; null off the plate. */
  pick(clientX: number, clientY: number): [number, number] | null {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hit = raycaster.intersectObject(this.surface, false)[0];
    return hit?.uv ? [hit.uv.x, hit.uv.y] : null;
  }

  /**
   * Hands the camera to a script (a fly-over): the opening spin and user
   * controls stop until the returned function puts everything back.
   */
  direct(): {
    /** The view when directing began: distance, angles and target. */
    start: { radius: number; theta: number; phi: number; target: Vector3 };
    /** Places the camera and draws a frame at once. */
    shoot: (position: Vector3, target: Vector3) => void;
    /** Height of the surface at a plate texture point (from above), or null off the plate. */
    groundAt: (u: number, v: number) => number | null;
    release: () => void;
  } {
    const saved = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    const spherical = new Spherical().setFromVector3(saved.position.clone().sub(saved.target));
    this.controls.autoRotate = false;
    this.controls.enabled = false;
    const down = new Raycaster();
    const downward = new Vector3(0, -1, 0);
    return {
      start: {
        radius: spherical.radius,
        theta: spherical.theta,
        phi: spherical.phi,
        target: saved.target.clone(),
      },
      shoot: (position, target) => {
        this.camera.position.copy(position);
        // Keep the controls in step, so a stray frame of the idle loop agrees with this one.
        this.controls.target.copy(target);
        this.camera.lookAt(target);
        this.renderer.render(this.scene, this.camera);
      },
      groundAt: (u, v) => {
        down.set(new Vector3(u - 0.5, 50, v - 0.5), downward);
        return down.intersectObject(this.surface, false)[0]?.point.y ?? null;
      },
      release: () => {
        this.camera.position.copy(saved.position);
        this.controls.target.copy(saved.target);
        this.camera.lookAt(saved.target);
        this.controls.enabled = true;
        this.wake(0);
      },
    };
  }

  /**
   * Squashes the relief towards a flat contour map (0) and back up to its
   * real shape (1), for the classroom lesson. Pins hide while it is flat.
   */
  setReliefScale(scale: number) {
    for (const object of [this.surface, this.shell, this.rim])
      object.scale.y = Math.max(0.001, scale);
    const full = scale >= 0.999;
    this.pin.visible = full && Boolean(this.extras?.pin);
    this.peakTag.visible = full && this.peakTag.material.map !== null && Boolean(this.extras?.pin);
    this.markerPins.visible = full && Boolean(this.extras?.markers.length);
    for (const tag of this.markerTags) tag.visible = full;
    this.wake(0);
  }

  /**
   * A second plate beside this one, for comparing two places. Both must be
   * built with the same vertical scale and base level; this one's colours
   * and contours follow the first plate's look. Null removes it.
   */
  setCompare(geometry: PlateGeometry | null, names: [string, string] = ["", ""]) {
    if (this.compare) {
      const { surface, shell, material, tags } = this.compare;
      this.scene.remove(surface, shell, ...tags);
      surface.geometry.dispose();
      shell.geometry.dispose();
      material.dispose();
      for (const tag of tags) {
        tag.material.map?.dispose();
        tag.material.dispose();
      }
      this.compare = null;
    }
    this.compareShift = 0;
    if (geometry) {
      const gap = 1.18;
      const u = this.surfaceMaterial.uniforms;
      // Share every uniform with the first plate, except its own images.
      const material = new ShaderMaterial({
        vertexShader: surfaceVertex,
        fragmentShader: surfaceFragment,
        uniforms: {
          ...u,
          uDrape: { value: null },
          uHasDrape: { value: false },
          uWaterMask: { value: null },
          uHasWaterMask: { value: false },
          uOverlay: { value: null },
          uHasOverlay: { value: false },
        },
      });
      u.uMax.value = Math.max(u.uMax.value, geometry.max);
      const surfaceGeometry = new BufferGeometry();
      surfaceGeometry.setAttribute("position", new BufferAttribute(geometry.surface, 3));
      surfaceGeometry.setAttribute("uv", new BufferAttribute(geometry.uvs, 2));
      surfaceGeometry.setAttribute("elevation", new BufferAttribute(geometry.elevations, 1));
      surfaceGeometry.setAttribute("ao", new BufferAttribute(geometry.ao, 1));
      surfaceGeometry.setAttribute(
        "sun",
        new BufferAttribute(
          sunlight(geometry.surface, geometry.size, [...this.light.toArray()] as [
            number,
            number,
            number,
          ]),
          1,
        ),
      );
      surfaceGeometry.setIndex(new BufferAttribute(geometry.surfaceIndex, 1));
      surfaceGeometry.computeVertexNormals();
      const shellGeometry = new BufferGeometry();
      shellGeometry.setAttribute("position", new BufferAttribute(geometry.shell, 3));
      shellGeometry.computeVertexNormals();
      const surface = new Mesh(surfaceGeometry, material);
      const shell = new Mesh(shellGeometry, this.shellMaterial);
      surface.position.x = shell.position.x = gap;
      // Name tags over the far edge of each plate.
      const tags = names.map((name, index) => {
        const canvas = tagCanvas(name);
        const map = new CanvasTexture(canvas);
        map.colorSpace = NoColorSpace;
        const tag = new Sprite(new SpriteMaterial({ map, depthTest: false, transparent: true }));
        tag.renderOrder = 10;
        tag.center.set(0.5, 0);
        tag.scale.set((0.06 * canvas.width) / canvas.height, 0.06, 1);
        tag.position.set(index * gap, this.plateHeight + 0.08, -0.5);
        return tag;
      });
      this.scene.add(surface, shell, ...tags);
      this.compare = { surface, shell, material, tags };
      this.compareShift = gap;
    }
    this.fitCamera();
    this.wake(IDLE_SPIN_MS);
  }

  /** The canvas the plate is drawn on, for recording. */
  get domElement(): HTMLCanvasElement {
    return this.canvas;
  }

  /** Turns and zooms the view from the keyboard: angles in degrees, zoom as a factor. */
  nudge(turnDegrees: number, tiltDegrees: number, zoom = 1) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new Spherical().setFromVector3(offset);
    spherical.theta += (turnDegrees * Math.PI) / 180;
    spherical.phi = Math.min(
      this.controls.maxPolarAngle,
      Math.max(this.controls.minPolarAngle, spherical.phi + (tiltDegrees * Math.PI) / 180),
    );
    spherical.radius = Math.min(
      this.controls.maxDistance,
      Math.max(this.controls.minDistance, spherical.radius * zoom),
    );
    this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(spherical));
    this.controls.autoRotate = false;
    this.onInteract?.();
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
    this.settleSun();
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
    if (this.sunTimer) clearTimeout(this.sunTimer);
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
      this.markerPins,
    ]) {
      object.geometry.dispose();
    }
    for (const tag of this.markerTags) {
      tag.material.map?.dispose();
      tag.material.dispose();
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

/** A photo with rounded corners and its pin's name underneath, for a pin's tag. */
function photoCard(photo: ImageBitmap, label: string): HTMLCanvasElement {
  const width = 360;
  const imageHeight = Math.round((width * 3) / 4);
  const strip = label ? 44 : 0;
  const pad = 8;
  const canvas = Object.assign(document.createElement("canvas"), {
    width: width + pad * 2,
    height: imageHeight + strip + pad * 2,
  });
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(20, 19, 17, 0.9)";
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 18);
  ctx.fill();
  // Cover the 4:3 frame with the middle of the photo.
  const scale = Math.max(width / photo.width, imageHeight / photo.height);
  const sw = width / scale;
  const sh = imageHeight / scale;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, width, imageHeight, 12);
  ctx.clip();
  ctx.drawImage(
    photo,
    (photo.width - sw) / 2,
    (photo.height - sh) / 2,
    sw,
    sh,
    pad,
    pad,
    width,
    imageHeight,
  );
  ctx.restore();
  if (label) {
    ctx.fillStyle = "#fbfaf7";
    ctx.font = `600 24px "Space Grotesk", "Kantumruy Pro", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, canvas.width / 2, pad + imageHeight + strip / 2 + 2, width - 16);
  }
  return canvas;
}

/**
 * The Studio's 3D view: the model on a printer bed, in millimetres, with
 * filament colours stacked by height, a section cut to look inside, and
 * preset views. Like the plate, it only draws when something changes.
 */
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  ColorManagement,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  LinearSRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MAX_BANDS } from "./studioSettings";

// Plain sRGB throughout, as in the plate's scene, so swatches match the model.
ColorManagement.enabled = false;

export type StudioView = "iso" | "top" | "front" | "side";

export interface StudioModel {
  /** Each part's triangles in plate units (x, y up, z south). */
  parts: { id: string; soup: Float32Array }[];
  widthMm: number;
  /** Base depth in plate units: the model is lifted by this so it rests on the bed. */
  lift: number;
  /** How far the model reaches south of the plate's centre, in plate units. */
  reach: number;
}

const FOV = 30;

export class StudioScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 1, 10_000);
  private readonly controls: OrbitControls;
  private readonly model = new Group();
  private readonly material: MeshStandardMaterial;
  private readonly bandColors = Array.from({ length: MAX_BANDS }, () => new Color());
  private readonly uniforms = {
    uBandColors: { value: this.bandColors },
    uCuts: { value: [0, 0, 0, 0] },
    uBandCount: { value: 1 },
    uCapColor: { value: new Color("#e4572e") },
  };
  private readonly section = new Plane(new Vector3(0, -1, 0), 1e6);
  private grid: GridHelper | null = null;
  private bed: LineLoop | null = null;
  private size = new Vector3(100, 20, 100);
  private frame = 0;
  private activeUntil = 0;
  private resizeObserver: ResizeObserver;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.material = new MeshStandardMaterial({
      roughness: 0.78,
      metalness: 0,
      side: DoubleSide,
      clippingPlanes: [this.section],
    });
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vHeight;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvHeight = (modelMatrix * vec4(transformed, 1.0)).y;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform vec3 uBandColors[${MAX_BANDS}];
          uniform float uCuts[${MAX_BANDS - 1}];
          uniform int uBandCount;
          uniform vec3 uCapColor;
          varying float vHeight;`,
        )
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec3 band = uBandColors[0];
          for (int k = 0; k < ${MAX_BANDS - 1}; k++) {
            if (k < uBandCount - 1 && vHeight >= uCuts[k]) band = uBandColors[k + 1];
          }
          // Inside faces only show through a section cut.
          vec4 diffuseColor = vec4(gl_FrontFacing ? band : uCapColor, opacity);`,
        );
    };

    this.scene.add(new HemisphereLight(0xffffff, 0x8a8478, 1.4));
    this.scene.add(new AmbientLight(0xffffff, 0.25));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(-1, 1.6, 0.8);
    this.scene.add(sun);
    const fill = new DirectionalLight(0xffffff, 0.5);
    fill.position.set(1, 0.5, -1);
    this.scene.add(fill);
    this.scene.add(this.model);

    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.1,
      screenSpacePanning: true,
      maxPolarAngle: Math.PI * 0.495,
    });
    this.controls.addEventListener("start", () => this.wake(Infinity));
    this.controls.addEventListener("end", () => this.wake(900));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.setView("iso");
    this.resize();
  }

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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (!this.frame && performance.now() < this.activeUntil) {
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  private resize() {
    const { clientWidth, clientHeight } = this.canvas;
    if (!clientWidth || !clientHeight) return;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.wake(0);
  }

  setModel(model: StudioModel) {
    for (const child of [...this.model.children]) {
      (child as Mesh).geometry.dispose();
      this.model.remove(child);
    }
    const w = model.widthMm;
    let top = 0;
    for (const part of model.parts) {
      const positions = new Float32Array(part.soup.length);
      for (let k = 0; k < part.soup.length; k += 3) {
        positions[k] = part.soup[k] * w;
        positions[k + 1] = (part.soup[k + 1] + model.lift) * w;
        positions[k + 2] = part.soup[k + 2] * w;
        if (positions[k + 1] > top) top = positions[k + 1];
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      this.model.add(new Mesh(geometry, this.material));
    }
    // Centre the footprint (plate plus nameplate) on the bed.
    const south = Math.max(0.5, model.reach);
    this.model.position.set(0, 0, (-(south - 0.5) / 2) * w);
    this.size.set(w, top, (0.5 + south) * w);
    this.wake(0);
  }

  /** Colours from the bed up, with the heights (mm) where each next colour starts. */
  setBands(colors: string[], cutsMm: number[]) {
    colors.forEach((color, k) => this.bandColors[k]?.set(color));
    this.uniforms.uBandCount.value = Math.min(colors.length, MAX_BANDS);
    this.uniforms.uCuts.value = [...cutsMm, 1e6, 1e6, 1e6, 1e6].slice(0, MAX_BANDS - 1);
    this.wake(0);
  }

  setWireframe(on: boolean) {
    this.material.wireframe = on;
    this.wake(0);
  }

  /** Hides everything above `mm`; null shows the whole model. */
  setSection(mm: number | null) {
    this.section.constant = mm ?? 1e6;
    this.wake(0);
  }

  setBed(mm: number) {
    for (const helper of [this.grid, this.bed]) {
      if (!helper) continue;
      this.scene.remove(helper);
      helper.geometry.dispose();
      (helper.material as LineBasicMaterial).dispose();
    }
    this.grid = new GridHelper(mm, Math.round(mm / 10), 0x8f897d, 0xc9c3b6);
    (this.grid.material as LineBasicMaterial).transparent = true;
    (this.grid.material as LineBasicMaterial).opacity = 0.45;
    this.grid.position.y = -0.05;
    const half = mm / 2;
    const outline = new BufferGeometry();
    outline.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([-half, 0, -half, half, 0, -half, half, 0, half, -half, 0, half]),
        3,
      ),
    );
    this.bed = new LineLoop(outline, new LineBasicMaterial({ color: 0x6b675e }));
    this.scene.add(this.grid, this.bed);
    this.wake(0);
  }

  setView(view: StudioView) {
    const radius = Math.max(this.size.x, this.size.z, this.size.y * 1.5) * 0.75;
    const distance = radius / Math.sin(((FOV / 2) * Math.PI) / 180);
    const target = new Vector3(0, this.size.y * 0.35, 0);
    const direction = {
      iso: new Vector3(-0.55, 0.62, 0.75),
      top: new Vector3(0, 1, 0.0001),
      front: new Vector3(0, 0.12, 1),
      side: new Vector3(1, 0.12, 0),
    }[view].normalize();
    this.controls.target.copy(target);
    this.camera.position.copy(target).addScaledVector(direction, distance);
    this.camera.near = Math.max(0.5, distance / 100);
    this.camera.far = distance * 20;
    this.camera.updateProjectionMatrix();
    this.wake(400);
  }

  /** A PNG of the current view. */
  snapshot(): Promise<Blob | null> {
    this.renderer.render(this.scene, this.camera);
    return new Promise((resolve) => this.canvas.toBlob(resolve, "image/png"));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    for (const child of this.model.children) (child as Mesh).geometry.dispose();
    this.grid?.geometry.dispose();
    this.bed?.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}

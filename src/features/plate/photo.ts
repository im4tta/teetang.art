/**
 * A realistic still of the plate: a path tracer follows light around the
 * scene, so it gets soft shadows, light bouncing into valleys and contact
 * shadows under the box, like an offline render in Blender. Each frame adds
 * one sample per pixel and the picture clears up as samples build up.
 *
 * Loaded only when someone asks for a photo; three-gpu-pathtracer and
 * three-mesh-bvh stay out of the plate's main bundle.
 */
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Group,
  type PerspectiveCamera,
  type Vector3,
} from "three";
import { GradientEquirectTexture, WebGLPathTracer } from "three-gpu-pathtracer";

export interface PhotoInput {
  group: Group;
  camera: PerspectiveCamera;
  target: Vector3;
  baseDepth: number;
}

export interface PhotoSession {
  /** Samples so far. */
  readonly samples: number;
  stop: () => void;
  toBlob: () => Promise<Blob>;
}

export interface PhotoOptions {
  /** Studio backdrop colour (CSS hex). */
  backdrop: string;
  /** Stop after this many samples per pixel. */
  samples: number;
  onProgress: (samples: number, done: boolean) => void;
}

export async function startPhoto(
  canvas: HTMLCanvasElement,
  input: PhotoInput,
  options: PhotoOptions,
): Promise<PhotoSession> {
  const renderer = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const backdrop = new Color(options.backdrop).convertSRGBToLinear();
  const scene = new Scene();
  scene.background = backdrop.clone();
  scene.add(input.group);

  // A matte studio floor catches soft contact shadows.
  const floor = new Mesh(
    new PlaneGeometry(40, 40),
    new MeshStandardMaterial({ color: backdrop, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -input.baseDepth - 0.0005;
  scene.add(floor);

  // Overcast sky for soft fill, plus a low sun from the north-west for relief.
  const sky = new GradientEquirectTexture();
  sky.topColor.set(0xffffff);
  sky.bottomColor.copy(backdrop);
  sky.exponent = 2;
  sky.update();
  scene.environment = sky;
  scene.environmentIntensity = 0.9;
  const sun = new DirectionalLight(0xfff4e6, 2.4);
  sun.position.set(-0.55, 0.75, -0.35).multiplyScalar(10);
  scene.add(sun);

  const camera = input.camera;
  camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  camera.updateProjectionMatrix();
  camera.lookAt(input.target);

  const tracer = new WebGLPathTracer(renderer);
  tracer.bounces = 4;
  tracer.filterGlossyFactor = 0.5;
  tracer.renderDelay = 0;
  tracer.fadeDuration = 0;
  tracer.minSamples = 1;
  tracer.textureSize.set(2048, 2048);
  // Each frame traces one tile, so a slow GPU never stalls the page for long.
  const tiles = (navigator.hardwareConcurrency ?? 8) <= 4 ? 3 : 2;
  tracer.tiles.set(tiles, tiles);
  // Builds the ray-tracing acceleration structure; a moment of work for a plate.
  tracer.setScene(scene, camera);

  let frame = 0;
  let stopped = false;
  const tick = () => {
    frame = 0;
    if (stopped) return;
    tracer.renderSample();
    const done = tracer.samples >= options.samples;
    options.onProgress(Math.floor(tracer.samples), done);
    if (!done) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    get samples() {
      return tracer.samples;
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      tracer.dispose();
      sky.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      input.group.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const material = mesh.material as MeshStandardMaterial;
        material.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
    },
    toBlob() {
      return new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
          "image/png",
        ),
      );
    },
  };
}

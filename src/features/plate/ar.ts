/**
 * The plate on a real table, at the size it would be printed (10 cm wide).
 *
 * - iPhone and iPad: Apple's AR Quick Look opens a USDZ of the plate.
 * - Android (Chrome): a WebXR session finds a surface; a tap places the plate.
 */
import {
  DirectionalLight,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type MeshStandardMaterial,
} from "three";
import type { PhotoInput } from "./photo";

export type ArMode = "quicklook" | "webxr";

/** Printed width of the plate in AR, in metres. */
const PLATE_METRES = 0.1;

export async function arSupport(): Promise<ArMode | null> {
  if (typeof document === "undefined") return null;
  if (document.createElement("a").relList?.supports?.("ar")) return "quicklook";
  try {
    const xr = (
      navigator as Navigator & { xr?: { isSessionSupported: (mode: string) => Promise<boolean> } }
    ).xr;
    if (xr && (await xr.isSessionSupported("immersive-ar"))) return "webxr";
  } catch {
    // No WebXR here.
  }
  return null;
}

function disposeGroup(input: PhotoInput) {
  input.group.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const material = mesh.material as MeshStandardMaterial;
    material.map?.dispose();
    material.dispose();
  });
}

/** Opens AR Quick Look with a USDZ of the plate. */
export async function openQuickLook(input: PhotoInput, fileName: string): Promise<void> {
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
  input.group.scale.setScalar(PLATE_METRES);
  input.group.position.y = input.baseDepth * PLATE_METRES;
  const scene = new Scene();
  scene.add(input.group);
  const data = await new USDZExporter().parseAsync(scene);
  disposeGroup(input);
  const url = URL.createObjectURL(
    new Blob([data as Uint8Array<ArrayBuffer>], { type: "model/vnd.usdz+zip" }),
  );
  // Quick Look opens from a link with rel="ar" that holds an image.
  const link = Object.assign(document.createElement("a"), {
    href: url,
    rel: "ar",
    download: fileName,
  });
  link.appendChild(document.createElement("img"));
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface XrSessionLike extends EventTarget {
  requestReferenceSpace: (type: string) => Promise<unknown>;
  requestHitTestSource?: (options: { space: unknown }) => Promise<unknown> | undefined;
  end: () => Promise<void>;
}

/**
 * Starts a WebXR AR session: a ring shows where the plate will go, a tap
 * places it, a second tap moves it. `overlay` is shown over the camera view.
 */
export async function startWebXr(
  input: PhotoInput,
  overlay: HTMLElement,
  onEnd: () => void,
): Promise<() => void> {
  const xr = (
    navigator as Navigator & {
      xr: { requestSession: (mode: string, init: object) => Promise<XrSessionLike> };
    }
  ).xr;
  const session = await xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: overlay },
  });
  const canvas = document.createElement("canvas");
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");
  await renderer.xr.setSession(session as unknown as XRSession);

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x777777, 2.2));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1, 2, 1);
  scene.add(sun);

  input.group.scale.setScalar(PLATE_METRES);
  input.group.visible = false;
  scene.add(input.group);
  const reticle = new Mesh(
    new RingGeometry(0.045, 0.055, 40).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: 0xffffff }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const viewer = await session.requestReferenceSpace("viewer");
  const hitSource = await session.requestHitTestSource?.({ space: viewer });
  const placement = new Matrix4();

  session.addEventListener("select", () => {
    if (!reticle.visible) return;
    placement.copy(reticle.matrix);
    input.group.position.setFromMatrixPosition(placement);
    // Sit the base on the surface.
    input.group.position.y += input.baseDepth * PLATE_METRES;
    input.group.visible = true;
  });

  renderer.setAnimationLoop((_, frame) => {
    const xrFrame = frame as XRFrame | undefined;
    const space = renderer.xr.getReferenceSpace();
    if (xrFrame && hitSource && space) {
      const hits = xrFrame.getHitTestResults(hitSource as XRHitTestSource);
      const pose = hits[0]?.getPose(space);
      reticle.visible = Boolean(pose);
      if (pose) reticle.matrix.fromArray(pose.transform.matrix);
    }
    renderer.render(scene, renderer.xr.getCamera());
  });

  let ended = false;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    renderer.setAnimationLoop(null);
    disposeGroup(input);
    reticle.geometry.dispose();
    (reticle.material as MeshBasicMaterial).dispose();
    renderer.dispose();
    onEnd();
  };
  session.addEventListener("end", cleanup);
  return () => {
    session.end().catch(() => undefined);
    cleanup();
  };
}

/**
 * A fly-over video of the plate: the camera circles it, or follows the
 * imported track, while each frame is copied onto a square 1080 × 1080
 * canvas with the place's name and recorded with the browser's own
 * MediaRecorder. MP4 where the browser can write it, WebM elsewhere.
 */
import { Vector3 } from "three";
import type { PlateScene } from "./PlateScene";

export interface FlyoverOptions {
  /** Track in plate texture coordinates; a fly-over follows it when given. */
  route: [number, number][] | null;
  title: string;
  subtitle: string;
  background: string;
  ink: string;
  onProgress: (fraction: number) => void;
  signal?: AbortSignal;
}

const SIZE = 1080;
const FPS = 30;

export function videoType(): { mime: string; extension: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const [mime, extension] of [
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ]) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, extension };
  }
  return null;
}

const ease = (t: number) => t * t * (3 - 2 * t);

export async function recordFlyover(scene: PlateScene, options: FlyoverOptions): Promise<Blob> {
  const type = videoType();
  if (!type) throw new Error("This browser cannot record video");
  const frame = Object.assign(document.createElement("canvas"), { width: SIZE, height: SIZE });
  const ctx = frame.getContext("2d")!;
  const stream = frame.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType: type.mime,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: type.mime.split(";")[0] }));
  });

  const director = scene.direct();
  const source = scene.domElement;
  const { radius, theta, phi, target } = director.start;

  // A track becomes a smooth path a little above the ground.
  const path: Vector3[] = [];
  if (options.route && options.route.length > 1) {
    for (const [u, v] of options.route) {
      const ground = director.groundAt(u, v);
      if (ground !== null) path.push(new Vector3(u - 0.5, ground, v - 0.5));
    }
  }
  const followRoute = path.length > 1;
  const duration = followRoute ? 12_000 : 9_000;
  const along = (t: number) => {
    const f = Math.min(path.length - 1.001, Math.max(0, t * (path.length - 1)));
    const k = Math.floor(f);
    return path[k].clone().lerp(path[k + 1], f - k);
  };

  const drawFrame = () => {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Cover the square with the middle of the (wider or taller) view.
    const scale = Math.max(SIZE / source.width, SIZE / source.height);
    const w = source.width * scale;
    const h = source.height * scale;
    ctx.drawImage(source, (SIZE - w) / 2, (SIZE - h) / 2 - SIZE * 0.04, w, h);
    ctx.fillStyle = options.ink;
    ctx.textAlign = "center";
    ctx.font = `600 54px "Space Grotesk", "Kantumruy Pro", system-ui, sans-serif`;
    ctx.fillText(options.title, SIZE / 2, SIZE - 110);
    ctx.globalAlpha = 0.7;
    ctx.font = `400 28px "JetBrains Mono", "Kantumruy Pro", ui-monospace, monospace`;
    ctx.fillText(options.subtitle, SIZE / 2, SIZE - 62);
    ctx.globalAlpha = 1;
  };

  recorder.start(500);
  const started = performance.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (options.signal?.aborted) {
          reject(new DOMException("Cancelled", "AbortError"));
          return;
        }
        const t = Math.min(1, (performance.now() - started) / duration);
        if (followRoute) {
          // Chase the track: look a little ahead from behind and above.
          const s = ease(t);
          const here = along(s);
          const ahead = along(Math.min(1, s + 0.06));
          const back = here.clone().sub(ahead).setY(0).normalize();
          const eye = here
            .clone()
            .addScaledVector(back, 0.32)
            .add(new Vector3(0, 0.22, 0));
          director.shoot(eye, ahead.add(new Vector3(0, 0.02, 0)));
        } else {
          // One slow turn around the plate, rising a little towards the end.
          const angle = theta + ease(t) * Math.PI * 2;
          const tilt = phi - Math.sin(t * Math.PI) * 0.18;
          const eye = new Vector3().setFromSphericalCoords(radius * 0.92, tilt, angle).add(target);
          director.shoot(eye, target);
        }
        drawFrame();
        options.onProgress(t);
        if (t >= 1) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  } finally {
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
    director.release();
  }
  return finished;
}

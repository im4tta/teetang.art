/** Runs mesh checks and 3MF writing in a worker, or on the main thread where workers are missing. */
import { inspectMesh, weld, write3mf, type MeshReport } from "../plate/printModel";

export interface PrintPart {
  id: string;
  name: string;
  color: string;
  /** Triangles in print millimetres. */
  soup: Float32Array;
}

export type MeshJob =
  { type: "inspect"; parts: PrintPart[] } | { type: "3mf"; parts: PrintPart[]; title: string };

export type PartReport = MeshReport & { id: string };

let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./mesh.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data.result);
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      pending.forEach((job) => job.reject(new Error("worker-failed")));
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

function onMainThread(job: MeshJob): unknown {
  if (job.type === "inspect") {
    return job.parts.map((part) => ({ id: part.id, ...inspectMesh(weld(part.soup)) }));
  }
  return write3mf(
    job.parts.map((part) => ({ ...part, mesh: weld(part.soup) })),
    job.title,
  );
}

async function run<T>(job: MeshJob): Promise<T> {
  const target = getWorker();
  if (target) {
    try {
      return await new Promise<T>((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
        target.postMessage({ ...job, id });
      });
    } catch (error) {
      if ((error as Error).message !== "worker-failed") throw error;
    }
  }
  return onMainThread(job) as T;
}

export const inspectParts = (parts: PrintPart[]) => run<PartReport[]>({ type: "inspect", parts });
export const build3mf = (parts: PrintPart[], title: string) =>
  run<Blob>({ type: "3mf", parts, title });

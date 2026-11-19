/// <reference lib="webworker" />
/** Welding, checking and 3MF writing can take a second or two on big models. */
import { inspectMesh, weld, write3mf } from "../plate/printModel";
import type { MeshJob } from "./meshJobs";

self.onmessage = ({ data }: MessageEvent<MeshJob & { id: number }>) => {
  try {
    if (data.type === "inspect") {
      const reports = data.parts.map((part) => ({ id: part.id, ...inspectMesh(weld(part.soup)) }));
      self.postMessage({ id: data.id, result: reports });
    } else {
      const parts = data.parts.map((part) => ({ ...part, mesh: weld(part.soup) }));
      self.postMessage({ id: data.id, result: write3mf(parts, data.title) });
    }
  } catch (error) {
    self.postMessage({ id: data.id, error: (error as Error).message });
  }
};

/**
 * Photos attached to pins, kept in this browser's IndexedDB. They are shrunk
 * to at most 768 px and never leave the device: share links carry the pins,
 * not the photos.
 */
const DB = "teetangart-photos";
const STORE = "photos";
const MAX_SIDE = 768;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Shrinks and stores a photo; returns its id. */
export async function savePhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement("canvas"), {
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
  });
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85),
  );
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await run("readwrite", (store) => store.put(blob, id));
  return id;
}

export async function loadPhoto(id: string): Promise<ImageBitmap | null> {
  try {
    const blob = await run<Blob | undefined>("readonly", (store) => store.get(id));
    return blob ? await createImageBitmap(blob) : null;
  } catch {
    return null;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {
    // Already gone, or storage blocked: nothing to do.
  }
}

export const isPhotoId = (value: unknown): value is string =>
  typeof value === "string" && /^p[a-z0-9]{4,30}$/.test(value);

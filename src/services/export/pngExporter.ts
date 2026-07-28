function writeUint32BE(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    const index = (crc ^ (bytes[i] ?? 0)) & 0xff;
    crc = ((CRC_TABLE[index] ?? 0) ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildPhysChunk(dpi: number): Uint8Array<ArrayBuffer> {
  const ppm = Math.max(1, Math.round(dpi / 0.0254));
  const length = 9;
  const chunk = new Uint8Array(4 + 4 + length + 4);
  const type = new TextEncoder().encode("pHYs");
  const dataOffset = 8;

  writeUint32BE(chunk, 0, length);
  chunk.set(type, 4);
  writeUint32BE(chunk, dataOffset, ppm);
  writeUint32BE(chunk, dataOffset + 4, ppm);
  chunk[dataOffset + 8] = 1; // meters

  const crcBytes = new Uint8Array(4 + length);
  crcBytes.set(type, 0);
  crcBytes.set(chunk.subarray(dataOffset, dataOffset + length), 4);
  writeUint32BE(chunk, dataOffset + length, crc32(crcBytes));

  return chunk;
}

/**
 * Byte ranges (plus the pHYs chunk) that make up the final PNG.
 *
 * Returned as parts rather than one concatenated array so the Blob can be built
 * directly from views onto the original buffer. A 300 DPI poster PNG is tens of
 * megabytes and the previous implementation copied it three extra times.
 */
function buildPngParts(pngBytes: Uint8Array<ArrayBuffer>, dpi: number): BlobPart[] {
  if (dpi <= 0 || !Number.isFinite(dpi)) {
    return [pngBytes];
  }

  // PNG signature is 8 bytes, first chunk is expected to be IHDR.
  if (pngBytes.length < 33) {
    return [pngBytes];
  }

  const ihdrLength =
    ((pngBytes[8] ?? 0) << 24) |
    ((pngBytes[9] ?? 0) << 16) |
    ((pngBytes[10] ?? 0) << 8) |
    (pngBytes[11] ?? 0);
  const insertAt = 8 + 12 + ihdrLength;
  if (insertAt > pngBytes.length) {
    return [pngBytes];
  }

  return [pngBytes.subarray(0, insertAt), buildPhysChunk(dpi), pngBytes.subarray(insertAt)];
}

export async function createPngBlob(canvas: HTMLCanvasElement, dpi: number = 300): Promise<Blob> {
  const baseBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to create PNG blob from canvas."));
      }
    }, "image/png");
  });

  const bytes = new Uint8Array<ArrayBuffer>(await baseBlob.arrayBuffer());
  return new Blob(buildPngParts(bytes, dpi), { type: "image/png" });
}

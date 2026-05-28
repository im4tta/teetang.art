export interface IFileDownloader {
  downloadBlob(blob: Blob, filename: string): Promise<void>;
}

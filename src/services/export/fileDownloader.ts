import type { IFileDownloader } from "@/services/export/ports";

const webFileDownloader: IFileDownloader = {
  async downloadBlob(blob: Blob, filename: string): Promise<void> {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

let _downloader: IFileDownloader = webFileDownloader;

export function setFileDownloader(downloader: IFileDownloader): void {
  _downloader = downloader;
}

export function getFileDownloader(): IFileDownloader {
  return _downloader;
}

export function triggerDownloadBlob(blob: Blob, filename: string): Promise<void> {
  return _downloader.downloadBlob(blob, filename);
}

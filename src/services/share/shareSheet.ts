/** Small sharing helpers with no app dependencies, safe for any page to import. */

export const SITE_URL = "https://teetang.art";

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** Opens the native share sheet when there is one, otherwise copies the link. */
export async function shareOrCopy(data: ShareData): Promise<ShareOutcome> {
  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  return copyText(data.url ?? data.text ?? "");
}

export async function copyText(text: string): Promise<ShareOutcome> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

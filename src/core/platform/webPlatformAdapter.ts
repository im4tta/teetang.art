import type { IPlatformAdapter } from "./ports";

export const webPlatformAdapter: IPlatformAdapter = {
  isNative: false,
  platform: "web",
};

import type { IPlatformAdapter } from "@/services/platform/ports";

export const webPlatformAdapter: IPlatformAdapter = {
  isNative: false,
  platform: "web",
};

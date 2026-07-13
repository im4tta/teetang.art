import type { IPlatformAdapter } from "@/services/platform/ports";
import { webPlatformAdapter } from "@/services/platform/webPlatformAdapter";

let _adapter: IPlatformAdapter = webPlatformAdapter;
let _onChange: (() => void) | null = null;

export const onPlatformAdapterChange = (cb: () => void) => { _onChange = cb; };
export const setPlatformAdapter = (a: IPlatformAdapter) => { _adapter = a; _onChange?.(); };
export const getPlatformAdapter = () => _adapter;
export const isNativePlatform = () => _adapter.isNative;

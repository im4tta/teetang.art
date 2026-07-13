export interface IPlatformAdapter {
  readonly isNative: boolean;
  readonly platform: "web" | "ios" | "android";
}

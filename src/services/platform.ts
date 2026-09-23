/** True when running inside a Capacitor native shell rather than a browser. */
export const isNativePlatform = () =>
  Boolean((window as Window & { Capacitor?: unknown }).Capacitor);

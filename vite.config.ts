import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const packageJson: { version?: string } = JSON.parse(
  fs.readFileSync(path.resolve(rootDir, "package.json"), "utf8"),
);
const appVersion = String(packageJson.version ?? "0.0.0");
const MAPLIBRE_DEP_PACKAGES = new Set([
  "earcut",
  "gl-matrix",
  "kdbush",
  "murmurhash-js",
  "pbf",
  "potpack",
  "quickselect",
  "supercluster",
  "tinyqueue",
]);

function getPackageName(id: string): string | null {
  const nodeModulesMatch = /[\\/]node_modules[\\/](.*)$/.exec(id);
  if (!nodeModulesMatch?.[1]) return null;

  const modulePath = nodeModulesMatch[1];
  const parts = modulePath.split(/[\\/]/);
  if (parts.length === 0) return null;

  const first = parts[0];
  if (!first) return null;

  if (first.startsWith("@") && parts.length > 1) {
    return `${first}/${parts[1]}`;
  }

  return first;
}

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
  },
  build: {
    // maplibre-gl is distributed as a large prebundled module and remains a
    // single chunk even with manual chunking.
    chunkSizeWarningLimit: 1100,
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          const packageName = getPackageName(id);

          if (packageName === "maplibre-gl") {
            return "vendor-maplibre-core";
          }

          if (
            packageName?.startsWith("@maplibre/") ||
            packageName?.startsWith("@mapbox/") ||
            MAPLIBRE_DEP_PACKAGES.has(packageName)
          ) {
            return "vendor-maplibre-deps";
          }

          if (packageName?.startsWith("react-icons")) {
            return "vendor-icons";
          }

          if (
            packageName === "react" ||
            packageName === "react-dom" ||
            packageName === "react-colorful"
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    reporters: ["default"],
  },
});

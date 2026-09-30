import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"),
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

const VENDOR_REACT_PACKAGES = new Set([
  "react",
  "react-dom",
  "scheduler",
  "react-router",
  "react-router-dom",
]);

function getPackageName(id) {
  const nodeModulesMatch = id.match(/[\\/]node_modules[\\/](.*)$/);
  if (!nodeModulesMatch || !nodeModulesMatch[1]) return null;

  const modulePath = nodeModulesMatch[1];
  const parts = modulePath.split(/[\\/]/);
  if (parts.length === 0) return null;

  if (parts[0].startsWith("@") && parts.length > 1) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0];
}

const baseConfig = {
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
        manualChunks(id) {
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

          // Everything both the home page and the editor need, cached together.
          if (VENDOR_REACT_PACKAGES.has(packageName)) {
            return "vendor-react";
          }
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
      // react-router's package exports point at its development build, which
      // keeps dev-only checks and warnings in the production bundle.
      {
        find: /^react-router$/,
        replacement: path.resolve(
          import.meta.dirname,
          "node_modules/react-router/dist/production/index.mjs",
        ),
      },
    ],
  },
};

/**
 * Dev/preview stand-in for the `api/carto` edge function: CARTO raster tiles
 * are requested on the app's own origin so CARTO_API_KEY stays server-side.
 */
function cartoProxy(apiKey) {
  return {
    "/api/carto": {
      target: "https://a.basemaps.cartocdn.com",
      changeOrigin: true,
      rewrite: (requestPath) =>
        `${requestPath.replace(/^\/api\/carto/, "")}?key=${encodeURIComponent(apiKey ?? "")}`,
    },
  };
}

export default defineConfig(({ mode }) => {
  const proxy = cartoProxy(loadEnv(mode, process.cwd(), "").CARTO_API_KEY);

  return {
    ...baseConfig,
    server: { proxy },
    preview: { proxy },
  };
});

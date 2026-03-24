import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const copyStaticFilesPlugin = {
  name: "copy-extension-static-files",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "manifest.json",
      source: readFileSync("manifest.json", "utf8")
    });
    this.emitFile({
      type: "asset",
      fileName: "styles/content.css",
      source: readFileSync("styles/content.css", "utf8")
    });
  }
};

export default defineConfig(({ mode }) => {
  if (mode === "content") {
    return {
      plugins: [copyStaticFilesPlugin],
      build: {
        emptyOutDir: true,
        outDir: "dist",
        sourcemap: true,
        rollupOptions: {
          input: {
            contentScript: "src/content/content-script.ts"
          },
          output: {
            format: "iife",
            entryFileNames: "assets/contentScript.js",
            inlineDynamicImports: true
          }
        }
      }
    };
  }

  return {
    build: {
      emptyOutDir: false,
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        input: {
          serviceWorker: "src/background/service-worker.ts"
        },
        output: {
          format: "es",
          entryFileNames: "assets/serviceWorker.js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name].[ext]"
        }
      }
    }
  };
});

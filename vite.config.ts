import { defineConfig, type Plugin, type UserConfig } from "vite";
import { readFileSync } from "node:fs";

const copyStaticFilesPlugin: Plugin = {
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

const copyPopupStaticFilesPlugin: Plugin = {
  name: "copy-popup-static-files",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "popup.html",
      source: readFileSync("src/popup/popup.html", "utf8")
    });
    this.emitFile({
      type: "asset",
      fileName: "styles/popup.css",
      source: readFileSync("styles/popup.css", "utf8")
    });
  }
};

export default defineConfig(({ mode }) => {
  if (mode === "popup") {
    const config: UserConfig = {
      plugins: [copyPopupStaticFilesPlugin],
      build: {
        emptyOutDir: false,
        outDir: "dist",
        sourcemap: true,
        rollupOptions: {
          input: {
            popup: "src/popup/popup.ts"
          },
          output: {
            format: "es",
            entryFileNames: "assets/popup.js",
            inlineDynamicImports: true,
            chunkFileNames: "assets/[name]-[hash].js",
            assetFileNames: "assets/[name].[ext]"
          }
        }
      }
    };
    return config;
  }

  if (mode === "content") {
    const config: UserConfig = {
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
    return config;
  }

  const config: UserConfig = {
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
  return config;
});

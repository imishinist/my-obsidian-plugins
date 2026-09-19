import esbuild from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const production = process.argv[2] === "production";
const pluginDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(pluginDir, "../../dist/markdown-capture");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await esbuild.build({
  entryPoints: [resolve(pluginDir, "src/main.ts")],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2022",
  platform: "browser",
  sourcemap: production ? false : "inline",
  minify: production,
  outfile: resolve(outputDir, "main.js"),
  logLevel: "info"
});

await Promise.all([
  copyFile(resolve(pluginDir, "manifest.json"), resolve(outputDir, "manifest.json")),
  copyFile(resolve(pluginDir, "styles.css"), resolve(outputDir, "styles.css"))
]);

// Builds the unpacked extension into extension/dist/.
//   - background.js  (ES module service worker, esbuild)
//   - content.js     (IIFE content script, esbuild)
//   - sidepanel.html + assets/  (Vite + React + Tailwind)
//   - manifest.json  (copied verbatim)

import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, mkdir, copyFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extDir = __dirname;
const distDir = path.join(extDir, "dist");

async function clean() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
}

async function buildBackground() {
  await esbuild({
    entryPoints: [path.join(extDir, "src/background.ts")],
    outfile: path.join(distDir, "background.js"),
    bundle: true,
    format: "esm",
    target: "chrome114",
    platform: "browser",
    minify: false,
    sourcemap: false,
  });
}

async function buildContent() {
  await esbuild({
    entryPoints: [path.join(extDir, "src/content/content.ts")],
    outfile: path.join(distDir, "content.js"),
    bundle: true,
    format: "iife",
    target: "chrome114",
    platform: "browser",
    minify: false,
    sourcemap: false,
  });
}

async function buildClaudeContent() {
  await esbuild({
    entryPoints: [path.join(extDir, "src/content/claude.ts")],
    outfile: path.join(distDir, "claude.js"),
    bundle: true,
    format: "iife",
    target: "chrome114",
    platform: "browser",
    minify: false,
    sourcemap: false,
  });
}

async function buildSidePanel() {
  await viteBuild({
    configFile: path.join(extDir, "vite.config.ts"),
  });
}

async function copyManifest() {
  await copyFile(
    path.join(extDir, "manifest.json"),
    path.join(distDir, "manifest.json")
  );
}

async function summarize() {
  async function walk(dir, prefix = "") {
    const entries = await readdir(dir);
    for (const name of entries.sort()) {
      const full = path.join(dir, name);
      const s = await stat(full);
      if (s.isDirectory()) {
        console.log(`${prefix}${name}/`);
        await walk(full, prefix + "  ");
      } else {
        console.log(`${prefix}${name}  ${s.size}b`);
      }
    }
  }
  console.log("\nextension/dist/");
  await walk(distDir, "  ");
}

await clean();
await Promise.all([
  buildBackground(),
  buildContent(),
  buildClaudeContent(),
  buildSidePanel(),
]);
await copyManifest();
await summarize();

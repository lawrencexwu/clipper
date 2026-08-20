// Bundles the iOS Shortcut JS payload as a single self-contained IIFE that
// can be pasted into "Run JavaScript on Web Page". Outputs to
// ios-shortcut/dist/payload.js.

import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(__dirname, "../shared");
const DIST = path.join(__dirname, "dist");

const aliasShared = {
  name: "alias-shared",
  setup(b) {
    b.onResolve({ filter: /^@shared\// }, (args) => {
      const rel = args.path.slice("@shared/".length).replace(/\.js$/, ".ts");
      return { path: path.join(SHARED, rel) };
    });
  },
};

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

await build({
  entryPoints: [path.join(__dirname, "src/payload.ts")],
  outfile: path.join(DIST, "payload.js"),
  bundle: true,
  format: "iife",
  target: "es2020",
  // Keep identifier names so `completion` (a free variable provided by the
  // Shortcuts host) doesn't get renamed.
  minify: true,
  keepNames: true,
  plugins: [aliasShared],
  logLevel: "warning",
});

console.log("\nios-shortcut/dist/");
console.log("  payload.js — paste into the 'Run JavaScript on Web Page' action");

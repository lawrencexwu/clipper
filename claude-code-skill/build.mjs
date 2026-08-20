// Bundles clip.ts → clip.mjs as an ESM Node script, with shared code
// inlined but jsdom / readability / turndown kept external (they live in
// node_modules and are loaded at runtime).

import { build } from "esbuild";
import { chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(__dirname, "../shared");
const OUT = path.join(__dirname, "clip.mjs");

const aliasShared = {
  name: "alias-shared",
  setup(b) {
    b.onResolve({ filter: /^@shared\// }, (args) => {
      const rel = args.path.slice("@shared/".length).replace(/\.js$/, ".ts");
      return { path: path.join(SHARED, rel) };
    });
  },
};

await build({
  entryPoints: [path.join(__dirname, "clip.ts")],
  outfile: OUT,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  external: ["jsdom", "@mozilla/readability", "turndown"],
  banner: { js: "#!/usr/bin/env node" },
  plugins: [aliasShared],
  logLevel: "warning",
});

await chmod(OUT, 0o755);
console.log("Built claude-code-skill/clip.mjs");

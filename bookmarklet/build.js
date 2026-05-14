// Builds the Safari bookmarklet into bookmarklet/dist/.
//
//   - main.js     — the bundled extraction script (hosted, loaded by loader)
//   - result.js   — the result-page handler (hosted, loaded by result.html)
//   - result.html — copied verbatim
//   - setup.html  — setup-page.html with the bookmarklet URL substituted
//   - bookmarklet.txt — the raw javascript: URL, for manual copy/paste
//
// Override the hosting URL with CLIPPER_BOOKMARKLET_HOST (default:
// https://lawrencexwu.github.io/clipper/).

import { build } from "esbuild";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(__dirname, "../shared");
const DIST = path.join(__dirname, "dist");
const HOST =
  process.env.CLIPPER_BOOKMARKLET_HOST ?? "https://lawrencexwu.github.io/clipper/";

async function clean() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
}

const aliasShared = {
  name: "alias-shared",
  setup(b) {
    b.onResolve({ filter: /^@shared\// }, (args) => {
      const rel = args.path.slice("@shared/".length).replace(/\.js$/, ".ts");
      return { path: path.join(SHARED, rel) };
    });
  },
};

async function buildMain() {
  await build({
    entryPoints: [path.join(__dirname, "src/main.ts")],
    outfile: path.join(DIST, "main.js"),
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    sourcemap: false,
    plugins: [aliasShared],
    logLevel: "warning",
  });
}

async function buildResult() {
  await build({
    entryPoints: [path.join(__dirname, "src/result.ts")],
    outfile: path.join(DIST, "result.js"),
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    sourcemap: false,
    plugins: [aliasShared],
    logLevel: "warning",
  });
}

async function buildLoader() {
  const out = await build({
    entryPoints: [path.join(__dirname, "src/loader.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    write: false,
    define: { __HOST__: JSON.stringify(HOST) },
    plugins: [aliasShared],
    logLevel: "warning",
  });
  return out.outputFiles[0].text.trim().replace(/;?\s*$/, "");
}

function bookmarkletUrl(loaderSource) {
  return "javascript:" + encodeURIComponent(loaderSource);
}

async function copyResultHtml() {
  await copyFile(
    path.join(__dirname, "result-page.html"),
    path.join(DIST, "result.html")
  );
}

async function writeSetupHtml(url) {
  const template = await readFile(
    path.join(__dirname, "setup-page.html"),
    "utf-8"
  );
  const attrEscaped = url
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
  const filled = template
    .replaceAll("__BOOKMARKLET_URL__", attrEscaped)
    .replaceAll("__BOOKMARKLET_LENGTH__", String(url.length));
  await writeFile(path.join(DIST, "setup.html"), filled);
}

async function writeRawUrl(url) {
  await writeFile(path.join(DIST, "bookmarklet.txt"), url);
}

await clean();
await Promise.all([buildMain(), buildResult(), copyResultHtml()]);
const loaderSource = await buildLoader();
const url = bookmarkletUrl(loaderSource);
await Promise.all([writeSetupHtml(url), writeRawUrl(url)]);

console.log("\nbookmarklet/dist/");
console.log(`  main.js        — extraction bundle (loaded by loader)`);
console.log(`  result.js      — result-page handler`);
console.log(`  result.html    — hosted at ${HOST}result.html`);
console.log(`  setup.html     — drop on GitHub Pages; drag the link to bookmarks`);
console.log(`  bookmarklet.txt — raw javascript: URL (${url.length} chars)`);
console.log(`\nHost: ${HOST}`);

// Claude Code "clipper" skill entry point. Fetches a URL, runs the shared
// extractor via JSDOM, and writes the resulting markdown to a flat
// iCloud Drive folder (overridable with $CLIPPER_DIR). Emits a single
// JSON status object on stdout so Claude Code can parse and report it.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { extract } from "@shared/extractor.js";
import { slugify } from "@shared/slug.js";

const DEFAULT_DIR = join(
  homedir(),
  "Library/Mobile Documents/com~apple~CloudDocs/Clipper"
);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url || !/^https?:\/\//.test(url)) {
    process.stderr.write(
      "Usage: clip <url>   (URL must be http:// or https://)\n"
    );
    process.exit(2);
  }

  const dir = process.env.CLIPPER_DIR || DEFAULT_DIR;

  const resp = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
  const html = await resp.text();

  const dom = new JSDOM(html, { url });
  const result = extract(
    dom.window.document as unknown as Document,
    url
  );
  if (!result) throw new Error("Extraction returned nothing");

  const fm = result.frontmatter;
  const date = fm.clipped.slice(0, 10);
  const base = `${date}-${slugify(fm.title)}-${fm.source}.md`;
  const filename = await firstAvailable(dir, base);

  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const fullPath = join(dir, filename);
  await writeFile(fullPath, result.markdown, "utf-8");

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        path: fullPath,
        filename,
        title: fm.title,
        source: fm.source,
        author: fm.author,
        word_count: fm.word_count,
        lang: fm.lang,
        adapter: fm.adapter,
      },
      null,
      2
    ) + "\n"
  );
}

async function firstAvailable(dir: string, base: string): Promise<string> {
  if (!existsSync(join(dir, base))) return base;
  const stem = base.replace(/\.md$/, "");
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}-${i}.md`;
    if (!existsSync(join(dir, candidate))) return candidate;
  }
  throw new Error("Too many naming conflicts");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    JSON.stringify({ ok: false, error: msg }, null, 2) + "\n"
  );
  process.exit(1);
});

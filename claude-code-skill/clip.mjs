#!/usr/bin/env node

// claude-code-skill/clip.ts
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

// shared/adapters/generic.ts
import { Readability } from "@mozilla/readability";
function genericAdapter(doc) {
  const cloned = doc.cloneNode(true);
  const parsed = new Readability(cloned).parse();
  if (!parsed) return null;
  return {
    title: (parsed.title ?? doc.title ?? "").trim(),
    contentHtml: parsed.content ?? "",
    author: (parsed.byline ?? extractAuthor(doc)).trim(),
    published: extractPublished(doc),
    adapter: "generic"
  };
}
function extractAuthor(doc) {
  const meta = doc.querySelector('meta[name="author"]')?.getAttribute("content") ?? doc.querySelector('meta[property="article:author"]')?.getAttribute("content");
  return meta ?? "";
}
function extractPublished(doc) {
  const raw = doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ?? doc.querySelector('meta[name="date"]')?.getAttribute("content") ?? doc.querySelector("time[datetime]")?.getAttribute("datetime") ?? "";
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// shared/adapters/x.ts
function matchX(url) {
  try {
    const u = new URL(url);
    return /^(www\.)?(x|twitter)\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}
function xAdapter(doc, url) {
  const handle = extractHandle(url);
  if (!handle) return null;
  const articles = Array.from(
    doc.querySelectorAll('article[data-testid="tweet"]')
  );
  if (articles.length === 0) return null;
  const parts = [];
  let index = 0;
  for (const article of articles) {
    const tweetHandle = articleAuthorHandle(article);
    if (tweetHandle !== handle) continue;
    const text = articleText(article);
    if (!text) continue;
    index++;
    const numbered = /^\d+\s*\/\s*/.test(text) ? text : `${index}/ ${text}`;
    let html = `<p>${escapeHtml(numbered)}</p>`;
    for (const img of articleImages(article)) {
      html += `<p><img src="${escapeAttr(img.src)}" alt="${escapeAttr(img.alt)}"></p>`;
    }
    for (const q of articleQuotes(article)) {
      html += `<blockquote><p>@${escapeHtml(q.author)}: ${escapeHtml(q.text)}</p></blockquote>`;
    }
    parts.push(html);
  }
  if (parts.length === 0) return null;
  const firstText = articleText(articles[0]) ?? "";
  const previewText = firstText.replace(/^\d+\s*\/\s*/, "").trim();
  const title = `@${handle}: ${previewText.slice(0, 80).replace(/\s+/g, " ")}` + (previewText.length > 80 ? "\u2026" : "");
  const timeEl = articles[0].querySelector("time[datetime]");
  const published = timeEl?.getAttribute("datetime")?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
  return {
    title,
    contentHtml: parts.join("\n"),
    author: `@${handle}`,
    published,
    adapter: "x"
  };
}
function extractHandle(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ?? null;
  } catch {
    return null;
  }
}
function articleAuthorHandle(article) {
  const link = article.querySelector(
    '[data-testid="User-Name"] a[href^="/"]'
  );
  const href = link?.getAttribute("href") ?? "";
  const parts = href.split("/").filter(Boolean);
  return parts[0] ?? null;
}
function articleText(article) {
  const el = article.querySelector('[data-testid="tweetText"]');
  return el?.textContent?.trim() ?? "";
}
function articleImages(article) {
  const result = [];
  for (const img of Array.from(article.querySelectorAll("img[src]"))) {
    const src = img.getAttribute("src") ?? "";
    const alt = img.getAttribute("alt") ?? "";
    if (!src) continue;
    if (/\/(profile|avatar)/i.test(src)) continue;
    if (/(profile|avatar)/i.test(img.getAttribute("class") ?? "")) continue;
    result.push({ src, alt });
  }
  return result;
}
function articleQuotes(article) {
  const result = [];
  for (const nested of Array.from(article.querySelectorAll("article"))) {
    const author = articleAuthorHandle(nested);
    const text = articleText(nested);
    if (author && text) result.push({ author, text });
  }
  return result;
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// shared/adapters/substack.ts
function matchSubstack(url, doc) {
  try {
    const u = new URL(url);
    if (/\.substack\.com$/.test(u.hostname)) return true;
  } catch {
  }
  const gen = doc.querySelector('meta[name="generator"]')?.getAttribute("content");
  return gen === "Substack";
}
function substackAdapter(doc) {
  const bodyEl = doc.querySelector(
    ".body.markup, div.body, .available-content"
  );
  if (!bodyEl) return null;
  const titleEl = doc.querySelector(".post-title") ?? doc.querySelector("h1.post-title") ?? doc.querySelector("h1");
  const subtitleEl = doc.querySelector(".subtitle, h3.subtitle");
  const title = (titleEl?.textContent ?? doc.title ?? "").trim().replace(/\s+-\s+[^-]+(Substack)?$/i, "").trim();
  const subtitle = subtitleEl?.textContent?.trim() ?? "";
  let html = "";
  if (subtitle) html += `<h2>${escapeHtml2(subtitle)}</h2>
`;
  html += rewriteFootnotes(bodyEl);
  const author = doc.querySelector(".author-name, a.author-name, [rel='author']")?.textContent?.trim() ?? doc.querySelector('meta[name="author"]')?.getAttribute("content")?.trim() ?? "";
  const published = matchDate(
    doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content")
  ) ?? matchDate(doc.querySelector("time[datetime]")?.getAttribute("datetime")) ?? "";
  return {
    title,
    contentHtml: html,
    author,
    published,
    adapter: "substack"
  };
}
function rewriteFootnotes(bodyEl) {
  const clone = bodyEl.cloneNode(true);
  const anchors = Array.from(
    clone.querySelectorAll("a.footnote-anchor, a[id^='footnote-anchor']")
  );
  if (anchors.length === 0) return clone.innerHTML;
  for (let i = 0; i < anchors.length; i++) {
    const ref = clone.ownerDocument.createTextNode(`[^${i + 1}]`);
    anchors[i].replaceWith(ref);
  }
  const defs = Array.from(
    clone.querySelectorAll(".footnote, .footnote-body, [id^='footnote-']")
  ).filter((el) => !el.matches("a"));
  let trailer = "";
  if (defs.length > 0) {
    trailer += "<hr><p><strong>Footnotes</strong></p>";
    defs.forEach((def, i) => {
      const text = def.textContent?.trim() ?? "";
      if (text) trailer += `<p>[^${i + 1}]: ${escapeHtml2(text)}</p>`;
      def.remove();
    });
  }
  return clone.innerHTML + trailer;
}
function matchDate(raw) {
  if (!raw) return void 0;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : void 0;
}
function escapeHtml2(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// shared/adapters/nyt.ts
function matchNyt(url) {
  try {
    const u = new URL(url);
    return /(^|\.)nytimes\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}
function nytAdapter(doc) {
  const cloned = doc.cloneNode(true);
  stripPaywall(cloned);
  const bodyEl = cloned.querySelector('section[name="articleBody"]') ?? cloned.querySelector("article section");
  if (!bodyEl) return null;
  const titleEl = cloned.querySelector('h1[data-testid="headline"]') ?? cloned.querySelector("article h1") ?? cloned.querySelector("h1");
  const title = titleEl?.textContent?.trim() ?? cloned.title.replace(/\s*-\s*The New York Times.*$/i, "").trim();
  const byl = cloned.querySelector('meta[name="byl"]')?.getAttribute("content")?.trim();
  const bylineText = cloned.querySelector('[data-testid="byline"]')?.textContent?.trim();
  const author = (byl ?? bylineText ?? "").replace(/^By\s+/i, "").trim();
  const published = matchDate2(
    cloned.querySelector('meta[property="article:published_time"]')?.getAttribute("content")
  ) ?? matchDate2(cloned.querySelector("time[datetime]")?.getAttribute("datetime")) ?? "";
  return {
    title,
    contentHtml: bodyEl.innerHTML,
    author,
    published,
    adapter: "nyt"
  };
}
function stripPaywall(doc) {
  const selectors = [
    '[data-testid="paywall-overlay"]',
    '[data-testid*="paywall" i]',
    '[id*="gateway" i]',
    '[class*="paywall" i]',
    '[class*="gateway" i]'
  ];
  for (const sel of selectors) {
    for (const el of Array.from(doc.querySelectorAll(sel))) {
      el.remove();
    }
  }
}
function matchDate2(raw) {
  if (!raw) return void 0;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : void 0;
}

// shared/adapters/index.ts
var adapters = [
  { name: "x", match: (url) => matchX(url), run: xAdapter },
  { name: "substack", match: matchSubstack, run: substackAdapter },
  { name: "nyt", match: (url) => matchNyt(url), run: nytAdapter }
];
function dispatch(doc, url) {
  for (const a of adapters) {
    if (!a.match(url, doc)) continue;
    const result = a.run(doc, url);
    if (result) return result;
  }
  return genericAdapter(doc);
}

// shared/markdown.ts
import TurndownService from "turndown";
function createTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    fence: "```",
    bulletListMarker: "-",
    emDelimiter: "_",
    linkStyle: "inlined",
    hr: "---"
  });
  td.addRule("strip-empty-paragraph", {
    filter: (node) => node.nodeName === "P" && (node.textContent ?? "").trim() === "" && node.childElementCount === 0,
    replacement: () => ""
  });
  td.addRule("image-with-alt", {
    filter: "img",
    replacement: (_content, node) => {
      const el = node;
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      if (!src) return alt ? `[${alt}]` : "";
      return `![${alt}](${src})`;
    }
  });
  return td;
}
function htmlToMarkdown(html) {
  if (!html) return "";
  const td = createTurndown();
  return td.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
}

// shared/frontmatter.ts
function yamlString(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function buildFrontmatter(fm) {
  const tagsLine = fm.tags.length === 0 ? "tags: []" : `tags: [${fm.tags.map(yamlString).join(", ")}]`;
  const lines = [
    "---",
    `title: ${yamlString(fm.title)}`,
    `url: ${fm.url}`,
    `source: ${fm.source}`,
    `author: ${yamlString(fm.author)}`,
    `published: ${fm.published ? fm.published : '""'}`,
    `clipped: ${fm.clipped}`,
    `lang: ${fm.lang}`,
    `adapter: ${fm.adapter}`,
    `word_count: ${fm.word_count}`,
    tagsLine,
    "---",
    ""
  ];
  return lines.join("\n");
}
function bareDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function nowIso(date = /* @__PURE__ */ new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = pad(Math.floor(Math.abs(tz) / 60));
  const mm = pad(Math.abs(tz) % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`;
}

// shared/lang.ts
function detectLang(text) {
  if (!text) return "other";
  const sample = text.slice(0, 4e3);
  let han = 0;
  let kana = 0;
  let latin = 0;
  for (const ch of sample) {
    const cp = ch.codePointAt(0);
    if (cp >= 12352 && cp <= 12447 || cp >= 12448 && cp <= 12543) {
      kana++;
    } else if (cp >= 19968 && cp <= 40959 || cp >= 13312 && cp <= 19903 || cp >= 63744 && cp <= 64255) {
      han++;
    } else if (cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122) {
      latin++;
    }
  }
  if (kana >= 5 || kana > 0 && kana * 4 >= han) return "ja";
  if (han >= 20 && han > latin / 2) return "zh";
  if (latin >= 20) return "en";
  return "other";
}

// shared/extractor.ts
function extract(doc, url) {
  const a = dispatch(doc, url);
  if (!a) return null;
  const body = htmlToMarkdown(a.contentHtml);
  const fm = {
    title: a.title,
    url,
    source: bareDomain(url),
    author: a.author,
    published: a.published,
    clipped: nowIso(),
    lang: detectLang(body || a.title),
    adapter: a.adapter,
    word_count: countWords(body),
    tags: []
  };
  const markdown = buildFrontmatter(fm) + body + "\n";
  return { frontmatter: fm, body, markdown };
}
function countWords(text) {
  const cjk = (text.match(/[㐀-鿿぀-ヿ]/g) ?? []).length;
  const stripped = text.replace(/[㐀-鿿぀-ヿ]/g, " ");
  const words = stripped.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  return cjk + words;
}

// shared/slug.ts
function slugify(input) {
  if (!input) return "untitled";
  let s = input.normalize("NFKC").trim().toLowerCase();
  s = s.replace(/[\s ]+/g, "-");
  s = s.replace(/[!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~·。、，！？：；「」『』（）【】]/g, "");
  s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (!s) return "untitled";
  if (s.length > 80) {
    s = s.slice(0, 80);
    const lastHyphen = s.lastIndexOf("-");
    if (lastHyphen > 40) s = s.slice(0, lastHyphen);
  }
  return s || "untitled";
}

// claude-code-skill/clip.ts
var DEFAULT_DIR = join(
  homedir(),
  "Library/Mobile Documents/com~apple~CloudDocs/Clipper"
);
var USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
async function main() {
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
    headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" }
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
  const html = await resp.text();
  const dom = new JSDOM(html, { url });
  const result = extract(
    dom.window.document,
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
        adapter: fm.adapter
      },
      null,
      2
    ) + "\n"
  );
}
async function firstAvailable(dir, base) {
  if (!existsSync(join(dir, base))) return base;
  const stem = base.replace(/\.md$/, "");
  for (let i = 2; i < 1e3; i++) {
    const candidate = `${stem}-${i}.md`;
    if (!existsSync(join(dir, candidate))) return candidate;
  }
  throw new Error("Too many naming conflicts");
}
main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    JSON.stringify({ ok: false, error: msg }, null, 2) + "\n"
  );
  process.exit(1);
});

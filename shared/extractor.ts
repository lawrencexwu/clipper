import { dispatch } from "./adapters/index.js";
import { htmlToMarkdown } from "./markdown.js";
import {
  buildFrontmatter,
  bareDomain,
  nowIso,
  type Frontmatter,
} from "./frontmatter.js";
import { detectLang } from "./lang.js";
import { preprocessLazyImages } from "./images.js";
import { resolveCanonicalUrl } from "./canonical.js";

export interface ExtractResult {
  frontmatter: Frontmatter;
  body: string;
  markdown: string;
  // Rough estimate of the source page's visible-text word count, after
  // stripping obvious chrome (nav/footer/aside/script/style). The UI uses
  // (word_count / visible_words) to flag suspiciously sparse extractions.
  visible_words: number;
}

export function extract(doc: Document, url: string): ExtractResult | null {
  preprocessLazyImages(doc);
  const canonicalUrl = resolveCanonicalUrl(doc, url);
  const visible_words = estimateVisibleWords(doc);
  const a = dispatch(doc, canonicalUrl);
  if (!a) return null;

  const body = htmlToMarkdown(a.contentHtml);
  const fm: Frontmatter = {
    title: a.title,
    url: canonicalUrl,
    source: bareDomain(canonicalUrl),
    author: a.author,
    published: a.published,
    clipped: nowIso(),
    lang: detectLang(body || a.title),
    adapter: a.adapter,
    word_count: countWords(body),
    tags: [],
  };

  const markdown = buildFrontmatter(fm) + body + "\n";
  return { frontmatter: fm, body, markdown, visible_words };
}

function estimateVisibleWords(doc: Document): number {
  const clone = doc.cloneNode(true) as Document;
  const noise = "script,style,nav,footer,aside,iframe,noscript,form,header";
  for (const el of Array.from(clone.querySelectorAll(noise))) el.remove();
  const text = clone.body?.textContent ?? clone.documentElement.textContent ?? "";
  return countWords(text);
}

function countWords(text: string): number {
  const cjk = (text.match(/[㐀-鿿぀-ヿ]/g) ?? []).length;
  const stripped = text.replace(/[㐀-鿿぀-ヿ]/g, " ");
  const words = stripped.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  return cjk + words;
}

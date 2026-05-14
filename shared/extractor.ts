import { dispatch } from "./adapters/index.js";
import { htmlToMarkdown } from "./markdown.js";
import {
  buildFrontmatter,
  bareDomain,
  nowIso,
  type Frontmatter,
} from "./frontmatter.js";
import { detectLang } from "./lang.js";

export interface ExtractResult {
  frontmatter: Frontmatter;
  body: string;
  markdown: string;
}

export function extract(doc: Document, url: string): ExtractResult | null {
  const a = dispatch(doc, url);
  if (!a) return null;

  const body = htmlToMarkdown(a.contentHtml);
  const fm: Frontmatter = {
    title: a.title,
    url,
    source: bareDomain(url),
    author: a.author,
    published: a.published,
    clipped: nowIso(),
    lang: detectLang(body || a.title),
    adapter: a.adapter,
    word_count: countWords(body),
    tags: [],
  };

  const markdown = buildFrontmatter(fm) + body + "\n";
  return { frontmatter: fm, body, markdown };
}

function countWords(text: string): number {
  const cjk = (text.match(/[㐀-鿿぀-ヿ]/g) ?? []).length;
  const stripped = text.replace(/[㐀-鿿぀-ヿ]/g, " ");
  const words = stripped.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  return cjk + words;
}

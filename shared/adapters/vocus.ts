import type { AdapterResult } from "./generic.js";

// vocus.cc — a Taiwanese blogging platform (React/Next.js). Article pages are
// server-rendered enough that we can pull structured JSON-LD when present,
// then fall back to standard article-body selectors. Titles / dates come from
// og:* and article:* meta tags, which vocus reliably sets.

export function matchVocus(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)vocus\.cc$/.test(u.hostname);
  } catch {
    return false;
  }
}

export function vocusAdapter(doc: Document): AdapterResult | null {
  const jsonLd = readArticleJsonLd(doc);

  const contentHtml =
    findBodyHtml(doc) ??
    (jsonLd?.articleBody ? `<p>${escapeHtml(jsonLd.articleBody)}</p>` : null);
  if (!contentHtml) return null;

  const title =
    jsonLd?.headline ??
    metaContent(doc, 'meta[property="og:title"]') ??
    doc.querySelector("h1")?.textContent?.trim() ??
    doc.title.replace(/\s*\|\s*方格子[\s\S]*$/, "").trim();

  const author =
    jsonLd?.author ??
    metaContent(doc, 'meta[name="author"]') ??
    metaContent(doc, 'meta[property="article:author"]') ??
    doc.querySelector('[data-testid="author-name"], .author-name, a[href*="/user/"]')
      ?.textContent?.trim() ??
    "";

  const published =
    matchDate(
      metaContent(doc, 'meta[property="article:published_time"]') ??
        metaContent(doc, 'meta[name="date"]') ??
        jsonLd?.datePublished
    ) ??
    matchDate(doc.querySelector("time[datetime]")?.getAttribute("datetime")) ??
    "";

  return {
    title,
    contentHtml,
    author,
    published,
    adapter: "vocus",
  };
}

function findBodyHtml(doc: Document): string | null {
  const selectors = [
    '[itemprop="articleBody"]',
    "article .article-content",
    "article [class*='ArticleContent' i]",
    "article [class*='PostContent' i]",
    "article [class*='content' i]",
    "main article",
    "article",
    ".article-content",
    ".post-content",
    "#article-content",
    "main [role='article']",
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el && (el.textContent ?? "").trim().length > 200) {
      return stripUiChrome(el).innerHTML;
    }
  }
  return null;
}

// Remove common non-content siblings that Next.js article shells inject
// (share bars, comment blocks, author cards, related articles).
function stripUiChrome(el: Element): Element {
  const clone = el.cloneNode(true) as Element;
  const junkSelectors = [
    "[class*='share' i]",
    "[class*='comment' i]",
    "[class*='related' i]",
    "[class*='recommend' i]",
    "[class*='subscribe' i]",
    "[class*='paywall' i]",
    "[class*='sidebar' i]",
    "button",
    "script",
    "style",
  ];
  for (const sel of junkSelectors) {
    for (const j of Array.from(clone.querySelectorAll(sel))) j.remove();
  }
  return clone;
}

interface ArticleLd {
  headline?: string;
  articleBody?: string;
  author?: string;
  datePublished?: string;
}

function readArticleJsonLd(doc: Document): ArticleLd | null {
  const scripts = Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]')
  );
  for (const s of scripts) {
    const raw = s.textContent?.trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const article = pickArticle(data);
      if (article) return article;
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return null;
}

function pickArticle(data: unknown): ArticleLd | null {
  if (!data || typeof data !== "object") return null;
  const nodes: unknown[] = Array.isArray(data)
    ? data
    : ((data as { "@graph"?: unknown[] })["@graph"] ?? [data]);
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const t = (node as { "@type"?: unknown })["@type"];
    const isArticle = Array.isArray(t)
      ? t.some((x) => typeof x === "string" && /Article|BlogPosting|NewsArticle/i.test(x))
      : typeof t === "string" && /Article|BlogPosting|NewsArticle/i.test(t);
    if (!isArticle) continue;
    const n = node as {
      headline?: unknown;
      articleBody?: unknown;
      author?: unknown;
      datePublished?: unknown;
    };
    const author = extractAuthorName(n.author);
    return {
      headline: typeof n.headline === "string" ? n.headline : undefined,
      articleBody:
        typeof n.articleBody === "string" ? n.articleBody : undefined,
      author,
      datePublished:
        typeof n.datePublished === "string" ? n.datePublished : undefined,
    };
  }
  return null;
}

function extractAuthorName(a: unknown): string | undefined {
  if (!a) return undefined;
  if (typeof a === "string") return a;
  if (Array.isArray(a)) {
    for (const item of a) {
      const name = extractAuthorName(item);
      if (name) return name;
    }
    return undefined;
  }
  if (typeof a === "object") {
    const name = (a as { name?: unknown }).name;
    if (typeof name === "string") return name;
  }
  return undefined;
}

function metaContent(doc: Document, selector: string): string | undefined {
  const v = doc.querySelector(selector)?.getAttribute("content")?.trim();
  return v || undefined;
}

function matchDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : undefined;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

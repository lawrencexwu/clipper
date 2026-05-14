import type { AdapterResult } from "./generic.js";

export function matchX(url: string): boolean {
  try {
    const u = new URL(url);
    return /^(www\.)?(x|twitter)\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

export function xAdapter(doc: Document, url: string): AdapterResult | null {
  const handle = extractHandle(url);
  if (!handle) return null;

  const articles = Array.from(
    doc.querySelectorAll('article[data-testid="tweet"]')
  );
  if (articles.length === 0) return null;

  const parts: string[] = [];
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
  const title =
    `@${handle}: ${previewText.slice(0, 80).replace(/\s+/g, " ")}` +
    (previewText.length > 80 ? "…" : "");

  const timeEl = articles[0].querySelector("time[datetime]");
  const published =
    timeEl?.getAttribute("datetime")?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";

  return {
    title,
    contentHtml: parts.join("\n"),
    author: `@${handle}`,
    published,
    adapter: "x",
  };
}

function extractHandle(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

function articleAuthorHandle(article: Element): string | null {
  const link = article.querySelector(
    '[data-testid="User-Name"] a[href^="/"]'
  );
  const href = link?.getAttribute("href") ?? "";
  const parts = href.split("/").filter(Boolean);
  return parts[0] ?? null;
}

function articleText(article: Element): string {
  const el = article.querySelector('[data-testid="tweetText"]');
  return el?.textContent?.trim() ?? "";
}

interface ImgRef {
  src: string;
  alt: string;
}

function articleImages(article: Element): ImgRef[] {
  const result: ImgRef[] = [];
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

interface Quote {
  author: string;
  text: string;
}

function articleQuotes(article: Element): Quote[] {
  const result: Quote[] = [];
  for (const nested of Array.from(article.querySelectorAll("article"))) {
    const author = articleAuthorHandle(nested);
    const text = articleText(nested);
    if (author && text) result.push({ author, text });
  }
  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

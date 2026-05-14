import type { AdapterResult } from "./generic.js";

export function matchNyt(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)nytimes\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

export function nytAdapter(doc: Document): AdapterResult | null {
  const cloned = doc.cloneNode(true) as Document;
  stripPaywall(cloned);

  const bodyEl =
    cloned.querySelector('section[name="articleBody"]') ??
    cloned.querySelector("article section");
  if (!bodyEl) return null;

  const titleEl =
    cloned.querySelector('h1[data-testid="headline"]') ??
    cloned.querySelector("article h1") ??
    cloned.querySelector("h1");
  const title =
    titleEl?.textContent?.trim() ??
    cloned.title.replace(/\s*-\s*The New York Times.*$/i, "").trim();

  const byl = cloned
    .querySelector('meta[name="byl"]')
    ?.getAttribute("content")
    ?.trim();
  const bylineText = cloned
    .querySelector('[data-testid="byline"]')
    ?.textContent?.trim();
  const author = (byl ?? bylineText ?? "").replace(/^By\s+/i, "").trim();

  const published =
    matchDate(
      cloned
        .querySelector('meta[property="article:published_time"]')
        ?.getAttribute("content")
    ) ??
    matchDate(cloned.querySelector("time[datetime]")?.getAttribute("datetime")) ??
    "";

  return {
    title,
    contentHtml: bodyEl.innerHTML,
    author,
    published,
    adapter: "nyt",
  };
}

function stripPaywall(doc: Document): void {
  const selectors = [
    '[data-testid="paywall-overlay"]',
    '[data-testid*="paywall" i]',
    '[id*="gateway" i]',
    '[class*="paywall" i]',
    '[class*="gateway" i]',
  ];
  for (const sel of selectors) {
    for (const el of Array.from(doc.querySelectorAll(sel))) {
      el.remove();
    }
  }
}

function matchDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : undefined;
}

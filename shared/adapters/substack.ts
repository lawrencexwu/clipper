import type { AdapterResult } from "./generic.js";

export function matchSubstack(url: string, doc: Document): boolean {
  try {
    const u = new URL(url);
    if (/\.substack\.com$/.test(u.hostname)) return true;
    // Substack Reader / inbox view — same rendering, different origin.
    if (
      u.hostname === "substack.com" &&
      /^\/(inbox\/post|p|inbox\/p)\//.test(u.pathname)
    ) {
      return true;
    }
  } catch {
    /* fall through */
  }
  const gen = doc
    .querySelector('meta[name="generator"]')
    ?.getAttribute("content");
  return gen === "Substack";
}

export function substackAdapter(doc: Document): AdapterResult | null {
  const bodyEl = doc.querySelector(
    ".body.markup, div.body, .available-content"
  );
  if (!bodyEl) return null;

  const titleEl =
    doc.querySelector(".post-title") ??
    doc.querySelector("h1.post-title") ??
    doc.querySelector("h1");
  const subtitleEl = doc.querySelector(".subtitle, h3.subtitle");

  const title = (titleEl?.textContent ?? doc.title ?? "")
    .trim()
    .replace(/\s+-\s+[^-]+(Substack)?$/i, "")
    .trim();
  const subtitle = subtitleEl?.textContent?.trim() ?? "";

  let html = "";
  if (subtitle) html += `<h2>${escapeHtml(subtitle)}</h2>\n`;
  html += rewriteFootnotes(bodyEl);

  const author =
    doc.querySelector(".author-name, a.author-name, [rel='author']")
      ?.textContent?.trim() ??
    doc.querySelector('meta[name="author"]')?.getAttribute("content")?.trim() ??
    "";

  const published =
    matchDate(
      doc
        .querySelector('meta[property="article:published_time"]')
        ?.getAttribute("content")
    ) ??
    matchDate(doc.querySelector("time[datetime]")?.getAttribute("datetime")) ??
    "";

  return {
    title,
    contentHtml: html,
    author,
    published,
    adapter: "substack",
  };
}

// Replace .footnote-anchor links with [^N] inline refs. Append matching
// definitions at the end if a .footnote-body container exists. Pass-through
// when no footnote markup is present.
function rewriteFootnotes(bodyEl: Element): string {
  const clone = bodyEl.cloneNode(true) as Element;
  const anchors = Array.from(
    clone.querySelectorAll("a.footnote-anchor, a[id^='footnote-anchor']")
  );
  if (anchors.length === 0) return clone.innerHTML;

  for (let i = 0; i < anchors.length; i++) {
    const ref = clone.ownerDocument!.createTextNode(`[^${i + 1}]`);
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
      if (text) trailer += `<p>[^${i + 1}]: ${escapeHtml(text)}</p>`;
      def.remove();
    });
  }

  return clone.innerHTML + trailer;
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

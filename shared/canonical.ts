// Resolve the "real" URL of the page — the one the author declares as
// canonical. Fixes three common misfires:
//   - Substack Reader inbox: substack.com/inbox/post/<id> → the author's
//     actual publication URL (e.g. thediff.co/p/foo)
//   - Tracking-parameter noise: strips ?utm_source= etc. via canonical
//   - AMP: /amp/ URLs canonicalize to the desktop version

export function resolveCanonicalUrl(doc: Document, fallback: string): string {
  const link = doc
    .querySelector('link[rel="canonical"]')
    ?.getAttribute("href");
  const linkResolved = safeResolve(link, fallback);
  if (linkResolved) return linkResolved;

  const og = doc
    .querySelector('meta[property="og:url"]')
    ?.getAttribute("content");
  const ogResolved = safeResolve(og, fallback);
  if (ogResolved) return ogResolved;

  return fallback;
}

function safeResolve(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

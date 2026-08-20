// Real-image resolution for pages that lazy-load. Most modern sites
// (Substack, NYT, Medium, vocus, X) put a placeholder in `src=` and the
// actual image URL in `data-src`, `data-original`, `data-lazy-src`, or a
// `srcset`. Turndown reads `src` only, so without this pass the resulting
// markdown ends up with blank / 1×1 / base64-stub images.
//
// Runs on the parsed Document before adapters see it, so per-site adapters
// benefit automatically. Mutates the given document in place.

const LAZY_SRC_ATTRS = [
  "data-src",
  "data-original",
  "data-lazy-src",
  "data-lazy",
  "data-hi-res-src",
  "data-full-src",
  "data-image-src",
];

export function preprocessLazyImages(doc: Document): void {
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    // 1. If current src is empty or a placeholder, promote a data-* attr.
    const raw = img.getAttribute("src");
    if (!raw || isPlaceholder(raw)) {
      const promoted = LAZY_SRC_ATTRS.map((a) => img.getAttribute(a)).find(
        (v): v is string => !!v && !isPlaceholder(v)
      );
      if (promoted) {
        img.setAttribute("src", promoted);
      } else {
        // 2. Fall through to srcset / data-srcset.
        const srcset =
          img.getAttribute("srcset") ?? img.getAttribute("data-srcset");
        if (srcset) {
          const best = pickLargestFromSrcset(srcset);
          if (best) img.setAttribute("src", best);
        }
      }
    }

    // 3. Resolve relative URLs against the document baseURI so downstream
    //    markdown links out to a working absolute URL.
    const current = img.getAttribute("src");
    if (current && !isDataUrl(current) && !/^https?:\/\//i.test(current)) {
      try {
        img.setAttribute("src", new URL(current, doc.baseURI).toString());
      } catch {
        /* ignore malformed URLs */
      }
    }
  }
}

function isPlaceholder(s: string): boolean {
  if (!s) return true;
  if (isDataUrl(s)) return true;
  // 1×1 spacer gifs / lazy placeholder patterns various libs use
  if (/\/(spacer|placeholder|blank|transparent|1x1|1px)\b/i.test(s)) return true;
  return false;
}

function isDataUrl(s: string): boolean {
  return /^data:/i.test(s);
}

// srcset: "u1 320w, u2 640w, u3 1024w" or "u1 1x, u2 2x"
// Pick the URL with the highest width descriptor; fall back to the last entry.
function pickLargestFromSrcset(srcset: string): string | null {
  let bestUrl = "";
  let bestWidth = -1;
  for (const raw of srcset.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const parts = entry.split(/\s+/);
    const url = parts[0];
    if (!url) continue;
    const descriptor = parts[1] ?? "";
    const width = parseWidth(descriptor);
    if (width >= bestWidth) {
      bestUrl = url;
      bestWidth = width;
    }
  }
  return bestUrl || null;
}

function parseWidth(descriptor: string): number {
  if (descriptor.endsWith("w")) return parseInt(descriptor, 10) || 0;
  if (descriptor.endsWith("x")) return Math.round((parseFloat(descriptor) || 0) * 1000);
  return 0;
}

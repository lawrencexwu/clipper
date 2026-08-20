import { genericAdapter, type AdapterResult } from "./generic.js";
import { matchX, xAdapter } from "./x.js";
import { matchSubstack, substackAdapter } from "./substack.js";
import { matchNyt, nytAdapter } from "./nyt.js";
import { matchVocus, vocusAdapter } from "./vocus.js";

export type { AdapterResult };

interface AdapterEntry {
  name: string;
  match: (url: string, doc: Document) => boolean;
  run: (doc: Document, url: string) => AdapterResult | null;
}

const adapters: AdapterEntry[] = [
  { name: "x", match: (url) => matchX(url), run: xAdapter },
  { name: "substack", match: matchSubstack, run: substackAdapter },
  { name: "nyt", match: (url) => matchNyt(url), run: nytAdapter },
  { name: "vocus", match: (url) => matchVocus(url), run: vocusAdapter },
];

export function dispatch(doc: Document, url: string): AdapterResult | null {
  for (const a of adapters) {
    if (!a.match(url, doc)) continue;
    const result = a.run(doc, url);
    if (result) return result;
  }
  return genericAdapter(doc);
}

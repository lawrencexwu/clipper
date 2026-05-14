import { genericAdapter, type AdapterResult } from "./generic.js";

export type { AdapterResult };

interface AdapterEntry {
  name: string;
  match: (url: string) => boolean;
  run: (doc: Document, url: string) => AdapterResult | null;
}

// Per-site adapters registered here in Phase 5.
const adapters: AdapterEntry[] = [];

export function dispatch(doc: Document, url: string): AdapterResult | null {
  for (const a of adapters) {
    if (!a.match(url)) continue;
    const result = a.run(doc, url);
    if (result) return result;
  }
  return genericAdapter(doc);
}

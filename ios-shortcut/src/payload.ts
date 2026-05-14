// Body of the "Run JavaScript on Web Page" action in the Clipper iOS
// Shortcut. Runs inside the current Safari tab, extracts via the shared
// pipeline, and reports the result through Apple's `completion()` callback
// as a JSON string of `{ filename, markdown }` or `{ error }`.
//
// Built into a self-contained IIFE by ios-shortcut/build.js. Paste the
// generated dist/payload.js into the Shortcuts action verbatim.

import { extract } from "@shared/extractor.js";
import { slugify } from "@shared/slug.js";

declare function completion(value: string): void;

(() => {
  try {
    const result = extract(document, location.href);
    if (!result) {
      completion(
        JSON.stringify({ error: "Extraction returned nothing." })
      );
      return;
    }
    const fm = result.frontmatter;
    const date = fm.clipped.slice(0, 10);
    const filename = `${date}-${slugify(fm.title)}-${fm.source}.md`;
    completion(JSON.stringify({ filename, markdown: result.markdown }));
  } catch (err) {
    completion(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
    );
  }
})();

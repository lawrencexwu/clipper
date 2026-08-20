// Runs in the host page's context (loaded via <script src> by the loader).
// Extracts the page with the shared core, then postMessages the result to
// the tab the loader opened. Retries until acked or a short timeout.

import { extract } from "@shared/extractor.js";
import { slugify } from "@shared/slug.js";

interface ClipperApi {
  run(target: Window, uuid: string): void;
}

const api: ClipperApi = {
  run(target, uuid) {
    let result;
    try {
      result = extract(document, location.href);
    } catch (err) {
      postError(target, uuid, String(err));
      return;
    }
    if (!result) {
      postError(target, uuid, "Extraction returned nothing.");
      return;
    }

    const fm = result.frontmatter;
    const date = fm.clipped.slice(0, 10);
    const filename = `${date}-${slugify(fm.title)}-${fm.source}.md`;
    const payload = {
      kind: "clipper-payload" as const,
      uuid,
      markdown: result.markdown,
      frontmatter: fm,
      filename,
    };

    let acked = false;
    window.addEventListener("message", (e) => {
      const d = e.data;
      if (d && d.kind === "clipper-ack" && d.uuid === uuid) acked = true;
    });

    const send = () => {
      try {
        target.postMessage(payload, "*");
      } catch {
        /* target closed */
      }
    };
    send();

    let attempts = 0;
    const tick = setInterval(() => {
      if (acked || attempts++ > 20 || target.closed) {
        clearInterval(tick);
        return;
      }
      send();
    }, 250);
  },
};

(window as unknown as { __clipper: ClipperApi }).__clipper = api;

function postError(target: Window, uuid: string, message: string): void {
  try {
    target.postMessage({ kind: "clipper-error", uuid, message }, "*");
  } catch {
    /* target closed */
  }
}

import TurndownService from "turndown";
// GFM plugin bundle: tables, strikethrough, task lists. No published types.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — turndown-plugin-gfm has no type declarations
import { gfm } from "turndown-plugin-gfm";

export function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    fence: "```",
    bulletListMarker: "-",
    emDelimiter: "_",
    linkStyle: "inlined",
    hr: "---",
  });

  td.use(gfm);

  td.addRule("strip-empty-paragraph", {
    filter: (node) =>
      node.nodeName === "P" &&
      (node.textContent ?? "").trim() === "" &&
      (node as Element).childElementCount === 0,
    replacement: () => "",
  });

  // Preserve image alt text; Turndown's default ![alt](src) is fine but ensure
  // it doesn't drop images with empty src.
  td.addRule("image-with-alt", {
    filter: "img",
    replacement: (_content, node) => {
      const el = node as HTMLImageElement;
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      if (!src) return alt ? `[${alt}]` : "";
      return `![${alt}](${src})`;
    },
  });

  return td;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  const td = createTurndown();
  return td
    .turndown(html)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

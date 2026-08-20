import { Readability } from "@mozilla/readability";

export interface AdapterResult {
  title: string;
  contentHtml: string;
  author: string;
  published: string;
  adapter: string;
}

export function genericAdapter(doc: Document): AdapterResult | null {
  const cloned = doc.cloneNode(true) as Document;
  const parsed = new Readability(cloned).parse();
  if (!parsed) return null;

  return {
    title: (parsed.title ?? doc.title ?? "").trim(),
    contentHtml: parsed.content ?? "",
    author: (parsed.byline ?? extractAuthor(doc)).trim(),
    published: extractPublished(doc),
    adapter: "generic",
  };
}

function extractAuthor(doc: Document): string {
  const meta =
    doc.querySelector('meta[name="author"]')?.getAttribute("content") ??
    doc.querySelector('meta[property="article:author"]')?.getAttribute("content");
  return meta ?? "";
}

function extractPublished(doc: Document): string {
  const raw =
    doc
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute("content") ??
    doc.querySelector('meta[name="date"]')?.getAttribute("content") ??
    doc.querySelector("time[datetime]")?.getAttribute("datetime") ??
    "";
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

import type { Lang } from "./lang.js";

export interface Frontmatter {
  title: string;
  url: string;
  source: string;
  author: string;
  published: string;
  clipped: string;
  lang: Lang;
  adapter: string;
  word_count: number;
  tags: string[];
}

function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildFrontmatter(fm: Frontmatter): string {
  const tagsLine = fm.tags.length === 0
    ? "tags: []"
    : `tags: [${fm.tags.map(yamlString).join(", ")}]`;

  const lines = [
    "---",
    `title: ${yamlString(fm.title)}`,
    `url: ${fm.url}`,
    `source: ${fm.source}`,
    `author: ${yamlString(fm.author)}`,
    `published: ${fm.published ? fm.published : '""'}`,
    `clipped: ${fm.clipped}`,
    `lang: ${fm.lang}`,
    `adapter: ${fm.adapter}`,
    `word_count: ${fm.word_count}`,
    tagsLine,
    "---",
    "",
  ];
  return lines.join("\n");
}

export function bareDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Parser that round-trips the schema buildFrontmatter emits. Not a general
// YAML parser; only handles the keys + scalar/array shapes we write.
export function parseFrontmatter(
  markdown: string
): { frontmatter: Frontmatter | null; body: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: markdown };

  const fm: Partial<Frontmatter> & { tags: string[] } = { tags: [] };
  for (const line of match[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();

    switch (key) {
      case "tags":
        fm.tags = parseInlineArray(raw);
        break;
      case "word_count":
        fm.word_count = parseInt(raw, 10) || 0;
        break;
      case "title":
      case "url":
      case "source":
      case "author":
      case "published":
      case "clipped":
      case "lang":
      case "adapter":
        (fm as Record<string, unknown>)[key] = unwrapScalar(raw);
        break;
    }
  }

  const required: (keyof Frontmatter)[] = [
    "title",
    "url",
    "source",
    "author",
    "published",
    "clipped",
    "lang",
    "adapter",
    "word_count",
    "tags",
  ];
  for (const k of required) {
    if (fm[k] === undefined) return { frontmatter: null, body: markdown };
  }

  return { frontmatter: fm as Frontmatter, body: match[2] };
}

function unwrapScalar(raw: string): string {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return raw;
}

function parseInlineArray(raw: string): string[] {
  const m = raw.match(/^\[\s*(.*)\s*\]$/);
  if (!m) return [];
  const inside = m[1].trim();
  if (!inside) return [];
  return inside
    .split(",")
    .map((part) => unwrapScalar(part.trim()))
    .filter((s) => s.length > 0);
}

export function nowIso(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = pad(Math.floor(Math.abs(tz) / 60));
  const mm = pad(Math.abs(tz) % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${hh}:${mm}`
  );
}

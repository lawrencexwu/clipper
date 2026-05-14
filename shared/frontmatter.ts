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

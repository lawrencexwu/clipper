import type { Frontmatter } from "@shared/frontmatter.js";

const KEY = "library.clips";

export interface ClipMeta {
  filename: string;
  title: string;
  source: string;
  author: string;
  published: string;
  clipped: string;
  url: string;
  lang: string;
  adapter: string;
  word_count: number;
  tags: string[];
}

export function clipMetaFromFrontmatter(
  fm: Frontmatter,
  filename: string
): ClipMeta {
  return {
    filename,
    title: fm.title,
    source: fm.source,
    author: fm.author,
    published: fm.published,
    clipped: fm.clipped,
    url: fm.url,
    lang: fm.lang,
    adapter: fm.adapter,
    word_count: fm.word_count,
    tags: fm.tags,
  };
}

export async function listClips(): Promise<ClipMeta[]> {
  const r = await chrome.storage.local.get(KEY);
  const arr = r[KEY];
  return Array.isArray(arr) ? (arr as ClipMeta[]) : [];
}

async function writeClips(clips: ClipMeta[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: clips });
}

export async function addClip(meta: ClipMeta): Promise<void> {
  const all = await listClips();
  const next = [meta, ...all.filter((c) => c.filename !== meta.filename)];
  await writeClips(next);
}

export async function removeClip(filename: string): Promise<void> {
  const all = await listClips();
  await writeClips(all.filter((c) => c.filename !== filename));
}

export async function updateClipMeta(
  filename: string,
  patch: Partial<ClipMeta>
): Promise<void> {
  const all = await listClips();
  const next = all.map((c) =>
    c.filename === filename ? { ...c, ...patch } : c
  );
  await writeClips(next);
}

export interface SearchFilters {
  query: string;
  source: string | null;
  lang: string | null;
}

export function applyFilters(
  clips: ClipMeta[],
  filters: SearchFilters
): ClipMeta[] {
  const q = filters.query.trim().toLowerCase();
  return clips.filter((c) => {
    if (filters.source && c.source !== filters.source) return false;
    if (filters.lang && c.lang !== filters.lang) return false;
    if (!q) return true;
    if (c.title.toLowerCase().includes(q)) return true;
    if (c.source.toLowerCase().includes(q)) return true;
    if (c.author.toLowerCase().includes(q)) return true;
    if (c.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });
}

export function uniqueValues(
  clips: ClipMeta[],
  key: "source" | "lang"
): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of clips) {
    const v = c[key];
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

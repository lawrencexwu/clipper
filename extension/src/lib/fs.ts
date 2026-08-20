import { idbDelete, idbGet, idbSet } from "./idb.js";
import {
  buildFrontmatter,
  parseFrontmatter,
  type Frontmatter,
} from "@shared/frontmatter.js";
import { slugify } from "@shared/slug.js";

const DIR_KEY = "clipsDir";

export type PermissionState = "granted" | "denied" | "prompt";

interface HandleWithPermissions extends FileSystemDirectoryHandle {
  queryPermission(opts: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(opts: { mode: "readwrite" }): Promise<PermissionState>;
}

interface ShowDirectoryPicker {
  (opts?: { mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
}

export async function getClipsDir(): Promise<FileSystemDirectoryHandle | undefined> {
  return idbGet<FileSystemDirectoryHandle>(DIR_KEY);
}

export async function setClipsDir(handle: FileSystemDirectoryHandle): Promise<void> {
  await idbSet(DIR_KEY, handle);
}

export async function clearClipsDir(): Promise<void> {
  await idbDelete(DIR_KEY);
}

// Must be invoked from a user gesture.
export async function pickClipsDir(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as unknown as { showDirectoryPicker: ShowDirectoryPicker })
    .showDirectoryPicker;
  if (!picker) throw new Error("File System Access API not available");
  const handle = await picker({ mode: "readwrite" });
  await setClipsDir(handle);
  return handle;
}

export async function ensureWritePermission(
  handle: FileSystemDirectoryHandle,
  request: boolean
): Promise<PermissionState> {
  const h = handle as HandleWithPermissions;
  let state = await h.queryPermission({ mode: "readwrite" });
  if (state !== "granted" && request) {
    state = await h.requestPermission({ mode: "readwrite" });
  }
  return state;
}

export function clipFilename(fm: Frontmatter): string {
  const date = fm.clipped.slice(0, 10);
  const slug = slugify(fm.title) || "untitled";
  return `${date}-${slug}-${fm.source}.md`;
}

async function fileExists(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function nextAvailableName(
  dir: FileSystemDirectoryHandle,
  baseName: string
): Promise<string> {
  if (!(await fileExists(dir, baseName))) return baseName;
  const dot = baseName.lastIndexOf(".");
  const stem = dot >= 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot >= 0 ? baseName.slice(dot) : "";
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!(await fileExists(dir, candidate))) return candidate;
  }
  throw new Error("too many name conflicts");
}

export async function saveClip(
  dir: FileSystemDirectoryHandle,
  fm: Frontmatter,
  markdown: string
): Promise<string> {
  const desired = clipFilename(fm);
  const finalName = await nextAvailableName(dir, desired);
  const fileHandle = await dir.getFileHandle(finalName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(markdown);
  await writable.close();
  return finalName;
}

export interface ReadClipResult {
  frontmatter: Frontmatter;
  body: string;
  markdown: string;
}

export async function readClip(
  dir: FileSystemDirectoryHandle,
  filename: string
): Promise<ReadClipResult> {
  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  const markdown = await file.text();
  const parsed = parseFrontmatter(markdown);
  if (!parsed.frontmatter) {
    throw new Error(`${filename}: no parseable frontmatter`);
  }
  return { frontmatter: parsed.frontmatter, body: parsed.body, markdown };
}

export async function rewriteFrontmatter(
  dir: FileSystemDirectoryHandle,
  filename: string,
  next: Frontmatter
): Promise<string> {
  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  const parsed = parseFrontmatter(await file.text());
  if (!parsed.frontmatter) {
    throw new Error(`${filename}: no parseable frontmatter`);
  }
  const newMarkdown = buildFrontmatter(next) + parsed.body;
  const writable = await fileHandle.createWritable();
  await writable.write(newMarkdown);
  await writable.close();
  return newMarkdown;
}

// Append an AI-action result to the clip file as a new section. Successive
// calls stack under a common "AI actions" heading so a clip accretes
// analyses over time — run Summarize now, come back next week and run
// Extract, both are visible at the bottom of the same .md.
export async function appendAiSection(
  dir: FileSystemDirectoryHandle,
  filename: string,
  label: string,
  body: string
): Promise<void> {
  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  const existing = await file.text();

  const stamp = humanTimestamp();
  const trimmedBody = body.trim();
  const alreadyHasHeader = /\n## AI actions\s*\n/.test(existing);
  const heading = alreadyHasHeader ? "" : "\n\n---\n\n## AI actions\n";
  const section =
    `${heading}\n\n### ${label} · ${stamp}\n\n${trimmedBody}\n`;

  const combined = existing.replace(/\s*$/, "") + section;
  const writable = await fileHandle.createWritable();
  await writable.write(combined);
  await writable.close();
}

function humanTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

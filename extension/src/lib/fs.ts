import { idbDelete, idbGet, idbSet } from "./idb.js";
import type { Frontmatter } from "@shared/frontmatter.js";
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

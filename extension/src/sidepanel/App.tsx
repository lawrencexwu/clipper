import { useEffect, useState } from "react";
import { extract, type ExtractResult } from "@shared/extractor.js";
import {
  clipFilename,
  ensureWritePermission,
  getClipsDir,
  saveClip,
} from "../lib/fs.js";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; result: ExtractResult }
  | { kind: "error"; message: string };

type SaveState =
  | { kind: "idle" }
  | { kind: "no-folder" }
  | { kind: "needs-permission"; dirName: string }
  | { kind: "saving" }
  | { kind: "saved"; filename: string }
  | { kind: "error"; message: string };

export function App() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void runClip();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function runClip() {
    setStatus({ kind: "loading" });
    setSave({ kind: "idle" });
    try {
      const resp = await chrome.runtime.sendMessage({ type: "fetch-active-tab" });
      if (!resp?.ok) throw new Error(resp?.error ?? "unknown error");
      const doc = new DOMParser().parseFromString(resp.html, "text/html");
      const base = doc.createElement("base");
      base.href = resp.url;
      doc.head.insertBefore(base, doc.head.firstChild);
      const result = extract(doc, resp.url);
      if (!result) throw new Error("extraction returned nothing");
      setStatus({ kind: "ok", result });
      void autoSave(result);
    } catch (err) {
      setStatus({ kind: "error", message: String(err) });
    }
  }

  async function autoSave(result: ExtractResult) {
    const dir = await getClipsDir();
    if (!dir) {
      setSave({ kind: "no-folder" });
      return;
    }
    const state = await ensureWritePermission(dir, false);
    if (state !== "granted") {
      setSave({ kind: "needs-permission", dirName: dir.name });
      return;
    }
    await writeToDisk(result, dir);
  }

  async function writeToDisk(
    result: ExtractResult,
    dir: FileSystemDirectoryHandle
  ) {
    setSave({ kind: "saving" });
    try {
      const filename = await saveClip(dir, result.frontmatter, result.markdown);
      setSave({ kind: "saved", filename });
      setToast(`Saved ${filename}`);
    } catch (err) {
      setSave({ kind: "error", message: String(err) });
    }
  }

  async function saveNow() {
    if (status.kind !== "ok") return;
    const dir = await getClipsDir();
    if (!dir) {
      setSave({ kind: "no-folder" });
      return;
    }
    const state = await ensureWritePermission(dir, true);
    if (state !== "granted") {
      setSave({ kind: "error", message: "Permission denied" });
      return;
    }
    await writeToDisk(status.result, dir);
  }

  async function copyMarkdown() {
    if (status.kind !== "ok") return;
    await navigator.clipboard.writeText(status.result.markdown);
    setToast("Copied to clipboard");
  }

  function downloadMarkdown() {
    if (status.kind !== "ok") return;
    const fm = status.result.frontmatter;
    const filename = clipFilename(fm);
    const blob = new Blob([status.result.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast(`Downloaded ${filename}`);
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Clipper</span>
          {status.kind === "loading" && (
            <span className="text-xs text-neutral-500">extracting…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openOptions}
            className="text-xs text-neutral-500 hover:text-neutral-900"
            title="Open options"
          >
            ⚙
          </button>
          <button
            onClick={runClip}
            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
          >
            Re-clip
          </button>
        </div>
      </header>

      {status.kind === "ok" && (
        <ActionBar
          onCopy={copyMarkdown}
          onDownload={downloadMarkdown}
          save={save}
          onSave={saveNow}
          onOpenOptions={openOptions}
        />
      )}

      <main className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {status.kind === "idle" && (
          <p className="text-sm text-neutral-500">Ready.</p>
        )}
        {status.kind === "loading" && (
          <p className="text-sm text-neutral-500">Extracting page content…</p>
        )}
        {status.kind === "error" && (
          <div className="text-sm text-red-700">
            <p className="font-medium">Could not clip this page.</p>
            <p className="mt-1 break-words text-xs text-red-600">{status.message}</p>
          </div>
        )}
        {status.kind === "ok" && <Preview result={status.result} />}
      </main>

      <footer className="border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500">
        Library — coming in Phase 6
      </footer>

      {toast && (
        <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 rounded bg-neutral-900 px-3 py-1.5 text-xs text-white shadow">
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionBar({
  onCopy,
  onDownload,
  save,
  onSave,
  onOpenOptions,
}: {
  onCopy: () => void;
  onDownload: () => void;
  save: SaveState;
  onSave: () => void;
  onOpenOptions: () => void;
}) {
  return (
    <div className="border-b border-neutral-200 px-3 py-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onCopy}
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
        >
          Copy
        </button>
        <button
          onClick={onDownload}
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100"
        >
          Download .md
        </button>
        {(save.kind === "needs-permission" || save.kind === "saving") && (
          <button
            onClick={onSave}
            disabled={save.kind === "saving"}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
          >
            {save.kind === "saving" ? "Saving…" : `Save to ${save.dirName}`}
          </button>
        )}
      </div>
      <SaveStatusLine save={save} onOpenOptions={onOpenOptions} />
    </div>
  );
}

function SaveStatusLine({
  save,
  onOpenOptions,
}: {
  save: SaveState;
  onOpenOptions: () => void;
}) {
  if (save.kind === "saved") {
    return (
      <p className="mt-1.5 text-[11px] text-green-700">
        Saved <span className="font-mono">{save.filename}</span>
      </p>
    );
  }
  if (save.kind === "no-folder") {
    return (
      <p className="mt-1.5 text-[11px] text-neutral-500">
        No clips folder set —{" "}
        <button onClick={onOpenOptions} className="underline">
          choose one in options
        </button>
        .
      </p>
    );
  }
  if (save.kind === "needs-permission") {
    return (
      <p className="mt-1.5 text-[11px] text-neutral-500">
        Click <em>Save</em> to grant write permission to {save.dirName}.
      </p>
    );
  }
  if (save.kind === "error") {
    return (
      <p className="mt-1.5 text-[11px] text-red-700">{save.message}</p>
    );
  }
  return null;
}

function Preview({ result }: { result: ExtractResult }) {
  const fm = result.frontmatter;
  return (
    <div className="space-y-3">
      <div className="rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-700">
        <div className="font-medium text-neutral-900">{fm.title || "(no title)"}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          <span>{fm.source}</span>
          {fm.author && <span>{fm.author}</span>}
          {fm.published && <span>{fm.published}</span>}
          <span>{fm.word_count} words</span>
          <span>lang: {fm.lang}</span>
          <span>via {fm.adapter}</span>
        </div>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded border border-neutral-200 bg-white p-2 font-mono text-[11px] leading-snug">
        {result.markdown}
      </pre>
    </div>
  );
}

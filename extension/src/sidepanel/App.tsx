import { useEffect, useState } from "react";
import { extract, type ExtractResult } from "@shared/extractor.js";
import { slugify } from "@shared/slug.js";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; result: ExtractResult }
  | { kind: "error"; message: string };

export function App() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    runClip();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function runClip() {
    setStatus({ kind: "loading" });
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
    } catch (err) {
      setStatus({ kind: "error", message: String(err) });
    }
  }

  async function copyMarkdown() {
    if (status.kind !== "ok") return;
    await navigator.clipboard.writeText(status.result.markdown);
    setToast("Copied to clipboard");
  }

  function downloadMarkdown() {
    if (status.kind !== "ok") return;
    const fm = status.result.frontmatter;
    const date = fm.clipped.slice(0, 10);
    const filename = `${date}-${slugify(fm.title)}-${fm.source}.md`;
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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Clipper</span>
          {status.kind === "loading" && (
            <span className="text-xs text-neutral-500">extracting…</span>
          )}
        </div>
        <button
          onClick={runClip}
          className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
        >
          Re-clip
        </button>
      </header>

      {status.kind === "ok" && (
        <ActionBar
          onCopy={copyMarkdown}
          onDownload={downloadMarkdown}
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
}: {
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-3 py-2">
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
    </div>
  );
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

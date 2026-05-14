import { useEffect, useRef, useState } from "react";
import { extract, type ExtractResult } from "@shared/extractor.js";
import { PROMPT_LABELS, type PromptKey } from "@shared/prompts.js";
import {
  clipFilename,
  ensureWritePermission,
  getClipsDir,
  saveClip,
} from "../lib/fs.js";
import { getApiKey, getArchiveFallback, resolvePrompt } from "../lib/settings.js";
import { archivePhUrl, shouldOfferArchive } from "@shared/archive.js";
import {
  claudeAiHandoff,
  notebookLmHandoff,
  streamFromAnthropic,
  type StreamUsage,
} from "../lib/ai.js";

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

type AiState =
  | { kind: "idle" }
  | { kind: "handoff"; label: string }
  | { kind: "streaming"; label: string; text: string }
  | { kind: "done"; label: string; text: string; usage: StreamUsage }
  | { kind: "error"; label: string; message: string };

const ACTION_KEYS: PromptKey[] = [
  "summarize",
  "explain",
  "steelman",
  "extract",
  "falsify",
];

export function App() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [ai, setAi] = useState<AiState>({ kind: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const [archiveOn, setArchiveOn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void getArchiveFallback().then(setArchiveOn);
  }, []);

  useEffect(() => {
    void runClip();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function runClip() {
    setStatus({ kind: "loading" });
    setSave({ kind: "idle" });
    setAi({ kind: "idle" });
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
    if (!dir) return setSave({ kind: "no-folder" });
    const state = await ensureWritePermission(dir, false);
    if (state !== "granted")
      return setSave({ kind: "needs-permission", dirName: dir.name });
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
    if (!dir) return setSave({ kind: "no-folder" });
    const state = await ensureWritePermission(dir, true);
    if (state !== "granted")
      return setSave({ kind: "error", message: "Permission denied" });
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

  async function runAiAction(key: PromptKey) {
    if (status.kind !== "ok") return;
    const label = PROMPT_LABELS[key];
    const prompt = await resolvePrompt(key);
    const apiKey = await getApiKey();
    const markdown = status.result.markdown;

    if (!apiKey) {
      setAi({ kind: "handoff", label });
      try {
        await claudeAiHandoff(prompt, markdown);
        setToast(`${label} → Claude.ai (paste with Cmd+V)`);
        setAi({ kind: "idle" });
      } catch (err) {
        setAi({ kind: "error", label, message: String(err) });
      }
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAi({ kind: "streaming", label, text: "" });

    try {
      const usage = await streamFromAnthropic(apiKey, prompt, markdown, {
        signal: ctrl.signal,
        onDelta: (delta) =>
          setAi((prev) =>
            prev.kind === "streaming" && prev.label === label
              ? { ...prev, text: prev.text + delta }
              : prev
          ),
      });
      setAi((prev) =>
        prev.kind === "streaming" && prev.label === label
          ? { kind: "done", label, text: prev.text, usage }
          : prev
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setAi({ kind: "idle" });
      } else {
        setAi({ kind: "error", label, message: String(err) });
      }
    }
  }

  async function runNotebookLm() {
    if (status.kind !== "ok") return;
    setAi({ kind: "handoff", label: "NotebookLM" });
    try {
      await notebookLmHandoff(
        clipFilename(status.result.frontmatter),
        status.result.markdown
      );
      setToast("Opened NotebookLM (file downloaded)");
      setAi({ kind: "idle" });
    } catch (err) {
      setAi({ kind: "error", label: "NotebookLM", message: String(err) });
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  function dismissAi() {
    abortRef.current?.abort();
    setAi({ kind: "idle" });
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

      {status.kind === "ok" && (
        <AiBar
          onAction={runAiAction}
          onNotebookLm={runNotebookLm}
          disabled={ai.kind === "streaming" || ai.kind === "handoff"}
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
        {status.kind === "ok" && ai.kind === "idle" && (
          <Preview
            result={status.result}
            archiveOn={archiveOn}
          />
        )}
        {status.kind === "ok" && ai.kind !== "idle" && (
          <AiPanel
            ai={ai}
            onStop={stopStreaming}
            onDismiss={dismissAi}
          />
        )}
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
  if (save.kind === "saved")
    return (
      <p className="mt-1.5 text-[11px] text-green-700">
        Saved <span className="font-mono">{save.filename}</span>
      </p>
    );
  if (save.kind === "no-folder")
    return (
      <p className="mt-1.5 text-[11px] text-neutral-500">
        No clips folder set —{" "}
        <button onClick={onOpenOptions} className="underline">
          choose one in options
        </button>
        .
      </p>
    );
  if (save.kind === "needs-permission")
    return (
      <p className="mt-1.5 text-[11px] text-neutral-500">
        Click <em>Save</em> to grant write permission to {save.dirName}.
      </p>
    );
  if (save.kind === "error")
    return <p className="mt-1.5 text-[11px] text-red-700">{save.message}</p>;
  return null;
}

function AiBar({
  onAction,
  onNotebookLm,
  disabled,
}: {
  onAction: (key: PromptKey) => void;
  onNotebookLm: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-neutral-200 px-3 py-2">
      {ACTION_KEYS.map((k) => (
        <button
          key={k}
          onClick={() => onAction(k)}
          disabled={disabled}
          className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
        >
          {PROMPT_LABELS[k]}
        </button>
      ))}
      <button
        onClick={onNotebookLm}
        disabled={disabled}
        className="rounded border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
      >
        NotebookLM
      </button>
    </div>
  );
}

function AiPanel({
  ai,
  onStop,
  onDismiss,
}: {
  ai: AiState;
  onStop: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-700">
          {ai.kind === "streaming" && `${ai.label} (streaming)`}
          {ai.kind === "done" && ai.label}
          {ai.kind === "handoff" && `${ai.label} → opening Claude.ai…`}
          {ai.kind === "error" && `${ai.label} (error)`}
        </span>
        <div className="flex gap-1">
          {ai.kind === "streaming" && (
            <button
              onClick={onStop}
              className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] hover:bg-neutral-100"
            >
              Stop
            </button>
          )}
          <button
            onClick={onDismiss}
            className="rounded border border-neutral-300 px-2 py-0.5 text-[11px] hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
      </div>

      {(ai.kind === "streaming" || ai.kind === "done") && (
        <pre className="whitespace-pre-wrap break-words rounded border border-neutral-200 bg-white p-2 text-[12px] leading-normal">
          {ai.text || (ai.kind === "streaming" ? "…" : "(no output)")}
        </pre>
      )}
      {ai.kind === "done" && (
        <p className="text-[11px] text-neutral-500">
          {ai.usage.input_tokens} in · {ai.usage.output_tokens} out
          {ai.usage.cache_read_input_tokens > 0 &&
            ` · ${ai.usage.cache_read_input_tokens} cached`}
        </p>
      )}
      {ai.kind === "error" && (
        <p className="text-[12px] text-red-700">{ai.message}</p>
      )}
    </div>
  );
}

function Preview({
  result,
  archiveOn,
}: {
  result: ExtractResult;
  archiveOn: boolean;
}) {
  const fm = result.frontmatter;
  const sparse = shouldOfferArchive(fm.word_count);
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
      {sparse && archiveOn && (
        <div className="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          <span>
            Only {fm.word_count} words extracted — try archive.ph?
          </span>
          <a
            href={archivePhUrl(fm.url)}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-amber-400 bg-white px-2 py-0.5 text-amber-900 hover:bg-amber-100"
          >
            Open archive.ph
          </a>
        </div>
      )}
      <pre className="whitespace-pre-wrap break-words rounded border border-neutral-200 bg-white p-2 font-mono text-[11px] leading-snug">
        {result.markdown}
      </pre>
    </div>
  );
}

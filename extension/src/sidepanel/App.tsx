import { useEffect, useMemo, useRef, useState } from "react";
import { extract, type ExtractResult } from "@shared/extractor.js";
import type { Frontmatter } from "@shared/frontmatter.js";
import { PROMPT_LABELS, type PromptKey } from "@shared/prompts.js";
import { archivePhUrl, shouldOfferArchive } from "@shared/archive.js";
import {
  clipFilename,
  ensureWritePermission,
  getClipsDir,
  readClip,
  rewriteFrontmatter,
  saveClip,
} from "../lib/fs.js";
import {
  getApiKey,
  getArchiveFallback,
  resolvePrompt,
} from "../lib/settings.js";
import {
  claudeAiHandoff,
  estimateCostUsd,
  formatUsd,
  notebookLmHandoff,
  streamFromAnthropic,
  type StreamUsage,
} from "../lib/ai.js";
import {
  addClip,
  applyFilters,
  clipMetaFromFrontmatter,
  listClips,
  removeClip,
  uniqueValues,
  updateClipMeta,
  type ClipMeta,
  type SearchFilters,
} from "../lib/library.js";

type Tab = "current" | "library";

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
  const [tab, setTab] = useState<Tab>("current");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [ai, setAi] = useState<AiState>({ kind: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const [archiveOn, setArchiveOn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    void getArchiveFallback().then(setArchiveOn);
    void runClip();
    return () => abortRef.current?.abort();
  }, []);

  // The side panel persists across tab navigations, so a fresh trigger
  // (FAB / shortcut / context menu) won't remount it. The background
  // broadcasts "reclip" on every trigger; re-extract the active tab.
  useEffect(() => {
    function onMessage(msg: unknown) {
      if (
        msg &&
        typeof msg === "object" &&
        (msg as { type?: string }).type === "reclip"
      ) {
        setTab("current");
        void runClip();
      }
    }
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function runClip() {
    if (runningRef.current) return; // collapse concurrent triggers
    runningRef.current = true;
    abortRef.current?.abort(); // cancel any in-flight AI stream
    setStatus({ kind: "loading" });
    setSave({ kind: "idle" });
    setAi({ kind: "idle" });
    try {
      const resp = await chrome.runtime.sendMessage({
        type: "fetch-active-tab",
      });
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
    } finally {
      runningRef.current = false;
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
      await addClip(clipMetaFromFrontmatter(result.frontmatter, filename));
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
    const filename = clipFilename(status.result.frontmatter);
    triggerDownload(filename, status.result.markdown);
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
        setToast(`${label} → sending to Claude.ai…`);
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
          {status.kind === "loading" && tab === "current" && (
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
          {tab === "current" && (
            <button
              onClick={runClip}
              className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
            >
              Re-clip
            </button>
          )}
        </div>
      </header>

      <TabBar tab={tab} onChange={setTab} />

      {tab === "current" && status.kind === "ok" && (
        <>
          <ActionBar
            onCopy={copyMarkdown}
            onDownload={downloadMarkdown}
            save={save}
            onSave={saveNow}
            onOpenOptions={openOptions}
          />
          <AiBar
            onAction={runAiAction}
            onNotebookLm={runNotebookLm}
            disabled={ai.kind === "streaming" || ai.kind === "handoff"}
          />
        </>
      )}

      <main className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {tab === "current" && (
          <CurrentTab
            status={status}
            ai={ai}
            archiveOn={archiveOn}
            onStop={stopStreaming}
            onDismiss={dismissAi}
          />
        )}
        {tab === "library" && (
          <LibraryTab
            onToast={setToast}
          />
        )}
      </main>

      <footer className="border-t border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-500">
        {tab === "current" ? "Press ⚙ for options" : "Library"}
      </footer>

      {toast && (
        <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 rounded bg-neutral-900 px-3 py-1.5 text-xs text-white shadow">
          {toast}
        </div>
      )}
    </div>
  );
}

function TabBar({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (next: Tab) => void;
}) {
  return (
    <div className="flex border-b border-neutral-200 text-xs">
      {(["current", "library"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={
            "flex-1 px-3 py-1.5 " +
            (tab === t
              ? "border-b-2 border-neutral-900 font-medium text-neutral-900"
              : "text-neutral-500 hover:text-neutral-900")
          }
        >
          {t === "current" ? "Current" : "Library"}
        </button>
      ))}
    </div>
  );
}

function CurrentTab({
  status,
  ai,
  archiveOn,
  onStop,
  onDismiss,
}: {
  status: Status;
  ai: AiState;
  archiveOn: boolean;
  onStop: () => void;
  onDismiss: () => void;
}) {
  if (status.kind === "idle")
    return <p className="text-sm text-neutral-500">Ready.</p>;
  if (status.kind === "loading")
    return <p className="text-sm text-neutral-500">Extracting page content…</p>;
  if (status.kind === "error")
    return (
      <div className="text-sm text-red-700">
        <p className="font-medium">Could not clip this page.</p>
        <p className="mt-1 break-words text-xs text-red-600">
          {status.message}
        </p>
      </div>
    );
  if (ai.kind !== "idle")
    return <AiPanel ai={ai} onStop={onStop} onDismiss={onDismiss} />;
  return <Preview result={status.result} archiveOn={archiveOn} />;
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
          {" · "}
          <span className="font-medium text-neutral-700">
            {formatUsd(estimateCostUsd(ai.usage))}
          </span>
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
      <FrontmatterCard fm={fm} />
      {sparse && archiveOn && (
        <div className="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          <span>Only {fm.word_count} words extracted — try archive.ph?</span>
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

function FrontmatterCard({ fm }: { fm: Frontmatter }) {
  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-700">
      <div className="font-medium text-neutral-900">
        {fm.title || "(no title)"}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>{fm.source}</span>
        {fm.author && <span>{fm.author}</span>}
        {fm.published && <span>{fm.published}</span>}
        <span>{fm.word_count} words</span>
        <span>lang: {fm.lang}</span>
        <span>via {fm.adapter}</span>
      </div>
    </div>
  );
}

// -- Library ---------------------------------------------------------------

type LibraryView =
  | { kind: "list" }
  | { kind: "loading-clip"; filename: string }
  | { kind: "viewing"; filename: string; frontmatter: Frontmatter; body: string }
  | { kind: "error"; message: string };

function LibraryTab({ onToast }: { onToast: (s: string) => void }) {
  const [clips, setClips] = useState<ClipMeta[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    source: null,
    lang: null,
  });
  const [view, setView] = useState<LibraryView>({ kind: "list" });

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setClips(await listClips());
  }

  const filtered = useMemo(
    () => applyFilters(clips, filters),
    [clips, filters]
  );
  const sources = useMemo(() => uniqueValues(clips, "source"), [clips]);
  const langs = useMemo(() => uniqueValues(clips, "lang"), [clips]);

  async function openClip(meta: ClipMeta) {
    setView({ kind: "loading-clip", filename: meta.filename });
    try {
      const dir = await getClipsDir();
      if (!dir) throw new Error("No clips folder set");
      const state = await ensureWritePermission(dir, false);
      if (state !== "granted")
        throw new Error("Write permission needed (try saving a clip first)");
      const r = await readClip(dir, meta.filename);
      setView({
        kind: "viewing",
        filename: meta.filename,
        frontmatter: r.frontmatter,
        body: r.body,
      });
    } catch (err) {
      setView({ kind: "error", message: String(err) });
    }
  }

  async function commitTags(filename: string, tags: string[]) {
    try {
      const dir = await getClipsDir();
      if (!dir) throw new Error("No clips folder set");
      if (view.kind !== "viewing") return;
      const nextFm: Frontmatter = { ...view.frontmatter, tags };
      await rewriteFrontmatter(dir, filename, nextFm);
      await updateClipMeta(filename, { tags });
      setView({ ...view, frontmatter: nextFm });
      await refresh();
      onToast("Tags saved");
    } catch (err) {
      onToast(`Tag save failed: ${String(err)}`);
    }
  }

  async function removeFromIndex(filename: string) {
    await removeClip(filename);
    await refresh();
    if (view.kind === "viewing" && view.filename === filename) {
      setView({ kind: "list" });
    }
    onToast("Removed from library");
  }

  if (view.kind === "viewing") {
    return (
      <LibraryViewer
        filename={view.filename}
        frontmatter={view.frontmatter}
        body={view.body}
        onBack={() => setView({ kind: "list" })}
        onSaveTags={(tags) => commitTags(view.filename, tags)}
        onRemove={() => removeFromIndex(view.filename)}
      />
    );
  }

  if (view.kind === "loading-clip") {
    return (
      <p className="text-sm text-neutral-500">
        Reading <span className="font-mono">{view.filename}</span>…
      </p>
    );
  }

  if (view.kind === "error") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-700">{view.message}</p>
        <button
          onClick={() => setView({ kind: "list" })}
          className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={filters.query}
        onChange={(e) => setFilters({ ...filters, query: e.target.value })}
        placeholder="Search title, source, author, tags…"
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
      />

      {(sources.length > 0 || langs.length > 0) && (
        <div className="space-y-1">
          {sources.length > 0 && (
            <ChipRow
              label="source"
              items={sources}
              active={filters.source}
              onChange={(v) =>
                setFilters({ ...filters, source: filters.source === v ? null : v })
              }
            />
          )}
          {langs.length > 0 && (
            <ChipRow
              label="lang"
              items={langs}
              active={filters.lang}
              onChange={(v) =>
                setFilters({ ...filters, lang: filters.lang === v ? null : v })
              }
            />
          )}
        </div>
      )}

      <p className="text-[11px] text-neutral-500">
        {filtered.length} of {clips.length} clips
      </p>

      {clips.length === 0 && (
        <p className="text-sm text-neutral-500">
          No clips yet. Save one from the Current tab.
        </p>
      )}

      <ul className="space-y-1.5">
        {filtered.map((c) => (
          <ClipRow key={c.filename} meta={c} onClick={() => openClip(c)} />
        ))}
      </ul>
    </div>
  );
}

function ChipRow({
  label,
  items,
  active,
  onChange,
}: {
  label: string;
  items: Array<{ value: string; count: number }>;
  active: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[10px] uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={
            "rounded-full border px-2 py-0.5 text-[10px] " +
            (active === item.value
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100")
          }
        >
          {item.value} <span className="text-neutral-400">·{item.count}</span>
        </button>
      ))}
    </div>
  );
}

function ClipRow({
  meta,
  onClick,
}: {
  meta: ClipMeta;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-left hover:border-neutral-400 hover:bg-neutral-50"
      >
        <div className="line-clamp-1 text-[12px] font-medium text-neutral-900">
          {meta.title || "(no title)"}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-neutral-500">
          <span>{meta.source}</span>
          {meta.author && <span>{meta.author}</span>}
          <span>{meta.clipped.slice(0, 10)}</span>
          <span>{meta.word_count} words</span>
          {meta.tags.length > 0 && (
            <span className="text-indigo-700">
              {meta.tags.map((t) => `#${t}`).join(" ")}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function LibraryViewer({
  filename,
  frontmatter,
  body,
  onBack,
  onSaveTags,
  onRemove,
}: {
  filename: string;
  frontmatter: Frontmatter;
  body: string;
  onBack: () => void;
  onSaveTags: (tags: string[]) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
        >
          ← Back
        </button>
        <span className="truncate text-[10px] text-neutral-400">{filename}</span>
      </div>

      <FrontmatterCard fm={frontmatter} />

      <TagEditor initial={frontmatter.tags} onSave={onSaveTags} />

      <pre className="whitespace-pre-wrap break-words rounded border border-neutral-200 bg-white p-2 font-mono text-[11px] leading-snug">
        {body}
      </pre>

      <button
        onClick={onRemove}
        className="text-[11px] text-neutral-400 underline hover:text-red-700"
      >
        Remove from library index (does not delete the file)
      </button>
    </div>
  );
}

function TagEditor({
  initial,
  onSave,
}: {
  initial: string[];
  onSave: (tags: string[]) => void;
}) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const dirty = JSON.stringify(tags) !== JSON.stringify(initial);

  useEffect(() => {
    setTags(initial);
  }, [initial]);

  function add() {
    const t = draft.trim().replace(/^#/, "");
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setDraft("");
  }

  return (
    <div className="rounded border border-neutral-200 p-2">
      <div className="text-[10px] uppercase tracking-wide text-neutral-400">
        tags
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-900"
          >
            #{t}
            <button
              onClick={() => setTags(tags.filter((x) => x !== t))}
              className="text-indigo-500 hover:text-indigo-900"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="add tag"
          className="w-24 flex-1 rounded border border-neutral-200 px-1 py-0.5 text-[11px]"
        />
        {dirty && (
          <button
            onClick={() => onSave(tags)}
            className="rounded bg-neutral-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-neutral-700"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

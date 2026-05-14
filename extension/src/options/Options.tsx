import { useEffect, useState } from "react";
import {
  clearClipsDir,
  ensureWritePermission,
  getClipsDir,
  pickClipsDir,
} from "../lib/fs.js";
import {
  getApiKey,
  getArchiveFallback,
  getPromptOverride,
  setApiKey,
  setArchiveFallback,
  setPromptOverride,
} from "../lib/settings.js";
import { DEFAULTS, PROMPT_LABELS, type PromptKey } from "@shared/prompts.js";

const PROMPT_KEYS: PromptKey[] = [
  "summarize",
  "explain",
  "steelman",
  "extract",
  "falsify",
];

export function Options() {
  return (
    <div className="mx-auto max-w-2xl p-6 space-y-10">
      <h1 className="text-2xl font-semibold">Clipper options</h1>
      <FolderSection />
      <ApiKeySection />
      <ArchiveSection />
      <PromptsSection />
      <NotesSection />
    </div>
  );
}

function FolderSection() {
  const [dirName, setDirName] = useState<string | null>(null);
  const [permission, setPermission] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const h = await getClipsDir();
    if (!h) {
      setDirName(null);
      setPermission(null);
      return;
    }
    setDirName(h.name);
    setPermission(await ensureWritePermission(h, false));
  }

  async function pick() {
    setError(null);
    try {
      const handle = await pickClipsDir();
      await ensureWritePermission(handle, true);
      await refresh();
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(String(err));
    }
  }

  async function clear() {
    await clearClipsDir();
    await refresh();
  }

  async function regrant() {
    const h = await getClipsDir();
    if (!h) return;
    await ensureWritePermission(h, true);
    await refresh();
  }

  return (
    <section>
      <h2 className="text-base font-medium">Clips folder</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Pick a folder (typically inside iCloud Drive or Dropbox) where Clipper
        will save .md files. Chrome asks once for write permission and may
        re-ask after browser restarts.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={pick}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          {dirName ? "Change folder" : "Choose clips folder"}
        </button>
        {dirName && (
          <>
            <span className="text-sm text-neutral-700">
              Current: <span className="font-mono">{dirName}</span>
            </span>
            {permission && permission !== "granted" && (
              <button
                onClick={regrant}
                className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
              >
                Re-grant write permission
              </button>
            )}
            <button
              onClick={clear}
              className="text-xs text-neutral-500 underline hover:text-neutral-800"
            >
              clear
            </button>
          </>
        )}
      </div>
      {dirName && permission && (
        <p className="mt-2 text-xs text-neutral-500">
          Permission: <span className="font-mono">{permission}</span>
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

function ApiKeySection() {
  const [value, setValue] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    void (async () => {
      const k = await getApiKey();
      if (k) {
        setValue(k);
        setHasKey(true);
      }
    })();
  }, []);

  async function save() {
    await setApiKey(value.trim());
    setHasKey(!!value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function clear() {
    setValue("");
    await setApiKey("");
    setHasKey(false);
  }

  return (
    <section>
      <h2 className="text-base font-medium">Anthropic API key (optional)</h2>
      <p className="mt-1 text-sm text-neutral-600">
        If set, AI actions stream responses inline in the side panel instead of
        opening Claude.ai. The key is stored in <code>chrome.storage.local</code>
        and never synced to other devices.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-..."
          className="w-96 max-w-full rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
        />
        <button
          onClick={() => setReveal((r) => !r)}
          className="text-xs text-neutral-500 hover:text-neutral-900"
        >
          {reveal ? "hide" : "reveal"}
        </button>
        <button
          onClick={save}
          className="rounded bg-neutral-900 px-3 py-1 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Save
        </button>
        {hasKey && (
          <button
            onClick={clear}
            className="text-xs text-neutral-500 underline hover:text-neutral-800"
          >
            clear
          </button>
        )}
        {saved && <span className="text-xs text-green-700">saved</span>}
      </div>
    </section>
  );
}

function ArchiveSection() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void getArchiveFallback().then(setEnabled);
  }, []);

  async function toggle(next: boolean) {
    setEnabled(next);
    await setArchiveFallback(next);
  }

  return (
    <section>
      <h2 className="text-base font-medium">archive.ph fallback</h2>
      <p className="mt-1 text-sm text-neutral-600">
        If a clip extracts fewer than 200 words (likely a server-side paywall),
        show a button to open the page via <code>archive.ph/newest/</code> in a
        new tab. Off by default.
      </p>
      <label className="mt-3 inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => void toggle(e.target.checked)}
          className="h-4 w-4"
        />
        Offer archive.ph fallback when extraction is sparse
      </label>
    </section>
  );
}

function PromptsSection() {
  return (
    <section>
      <h2 className="text-base font-medium">Action prompts</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Override the default prompt for each AI action. Leave blank or click
        Reset to use the default.
      </p>
      <div className="mt-4 space-y-5">
        {PROMPT_KEYS.map((k) => (
          <PromptEditor key={k} promptKey={k} />
        ))}
      </div>
    </section>
  );
}

function PromptEditor({ promptKey }: { promptKey: PromptKey }) {
  const [value, setValue] = useState(DEFAULTS[promptKey]);
  const [overridden, setOverridden] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const o = await getPromptOverride(promptKey);
      if (o) {
        setValue(o);
        setOverridden(true);
      }
    })();
  }, [promptKey]);

  async function save() {
    await setPromptOverride(promptKey, value);
    setOverridden(value !== DEFAULTS[promptKey] && value.length > 0);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function reset() {
    setValue(DEFAULTS[promptKey]);
    await setPromptOverride(promptKey, DEFAULTS[promptKey]);
    setOverridden(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-800">
          {PROMPT_LABELS[promptKey]}
          {overridden && (
            <span className="ml-2 text-[11px] font-normal text-amber-700">
              (overridden)
            </span>
          )}
        </label>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-700">saved</span>}
          <button
            onClick={reset}
            className="text-xs text-neutral-500 underline hover:text-neutral-800"
          >
            reset to default
          </button>
          <button
            onClick={save}
            className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100"
          >
            Save
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 font-mono text-[12px] leading-snug"
      />
    </div>
  );
}

function NotesSection() {
  return (
    <section className="text-xs text-neutral-500">
      <p>
        File naming: <span className="font-mono">YYYY-MM-DD-{"{slug}"}-{"{source}"}.md</span>.
        Conflicts append <span className="font-mono">-2</span>, <span className="font-mono">-3</span>, etc.
      </p>
    </section>
  );
}

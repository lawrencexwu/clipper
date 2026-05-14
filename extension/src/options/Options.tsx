import { useEffect, useState } from "react";
import {
  clearClipsDir,
  ensureWritePermission,
  getClipsDir,
  pickClipsDir,
} from "../lib/fs.js";

export function Options() {
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
    const state = await ensureWritePermission(h, false);
    setPermission(state);
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
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Clipper options</h1>

      <section className="mt-6">
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

      <section className="mt-8 text-xs text-neutral-500">
        <p>
          File naming: <span className="font-mono">YYYY-MM-DD-{"{slug}"}-{"{source}"}.md</span>.
          Conflicts append <span className="font-mono">-2</span>, <span className="font-mono">-3</span>, etc.
        </p>
      </section>
    </div>
  );
}

// Runs in the result-page tab opened by the bookmarklet loader. Receives
// the markdown payload via postMessage, stores it in sessionStorage keyed
// by the URL's UUID hash (so a refresh restores the view), and wires up
// the Copy / Save / Claude.ai buttons.

import { summarize } from "@shared/prompts.js";

interface Frontmatter {
  title: string;
  source: string;
  author: string;
  published: string;
  clipped: string;
  word_count: number;
  lang: string;
  adapter: string;
}

interface Payload {
  markdown: string;
  frontmatter: Frontmatter;
  filename: string;
}

const uuid = location.hash.replace(/^#/, "");
const storageKey = `clipper:${uuid}`;
const root = document.getElementById("root")!;
const toastEl = document.getElementById("toast")!;
let payload: Payload | null = null;
let timeoutHandle: number | undefined;

function tryRestore() {
  const stored = sessionStorage.getItem(storageKey);
  if (!stored) return false;
  try {
    payload = JSON.parse(stored) as Payload;
    render(payload);
    return true;
  } catch {
    return false;
  }
}

if (!tryRestore()) {
  timeoutHandle = window.setTimeout(() => {
    if (!payload) {
      root.innerHTML =
        '<p class="error">No clip received. Did the source tab close before sending? Re-run the bookmarklet.</p>';
    }
  }, 10000);
}

window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || typeof d !== "object") return;
  if (d.uuid !== uuid) return;

  if (d.kind === "clipper-payload") {
    payload = {
      markdown: d.markdown,
      frontmatter: d.frontmatter,
      filename: d.filename,
    };
    sessionStorage.setItem(storageKey, JSON.stringify(payload));
    if (e.source && "postMessage" in e.source) {
      try {
        (e.source as Window).postMessage(
          { kind: "clipper-ack", uuid },
          "*"
        );
      } catch {
        /* source closed */
      }
    }
    if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    render(payload);
  }

  if (d.kind === "clipper-error") {
    if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    root.innerHTML = `<p class="error">Could not clip: ${escapeHtml(d.message)}</p>`;
  }
});

function render(p: Payload) {
  const fm = p.frontmatter;
  const metaBits = [
    fm.source,
    fm.author,
    fm.published,
    `${fm.word_count} words`,
    `lang: ${fm.lang}`,
    `via ${fm.adapter}`,
  ]
    .filter(Boolean)
    .join(" · ");

  root.innerHTML = `
    <section class="meta">
      <h2>${escapeHtml(fm.title || "(no title)")}</h2>
      <p class="muted">${escapeHtml(metaBits)}</p>
    </section>
    <div class="actions">
      <button id="btn-copy">Copy markdown</button>
      <button id="btn-save">Save to Files</button>
      <button id="btn-claude">Open in Claude.ai</button>
    </div>
    <pre id="md"></pre>
  `;
  document.getElementById("md")!.textContent = p.markdown;
  document.getElementById("btn-copy")!.addEventListener("click", () => copy(p));
  document.getElementById("btn-save")!.addEventListener("click", () => save(p));
  document
    .getElementById("btn-claude")!
    .addEventListener("click", () => openClaude(p));
}

async function copy(p: Payload) {
  await navigator.clipboard.writeText(p.markdown);
  toast("Copied");
}

function save(p: Payload) {
  const blob = new Blob([p.markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = p.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("On iPhone: tap Share → Save to Files");
}

async function openClaude(p: Payload) {
  await navigator.clipboard.writeText(
    `${summarize}\n\n---\n\n${p.markdown}`
  );
  window.open("https://claude.ai/new", "_blank");
  toast("Paste in Claude.ai with ⌘V");
}

function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  setTimeout(() => (toastEl.hidden = true), 1800);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

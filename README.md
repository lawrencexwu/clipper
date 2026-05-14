# Clipper

Personal web-content capture and analysis tool. Four surfaces, one extraction
core, one flat folder of markdown files in iCloud Drive.

## Surfaces

| Surface | Where it runs | Trigger |
|---|---|---|
| **Chrome extension (MV3)** | Mac + Windows desktop | Floating button on every page, side panel UI, keyboard shortcut, right-click menu |
| **Safari bookmarklet** | Mac Safari + iPhone Safari | Click the bookmark on an article; result tab opens with Copy / Save to Files / Open in Claude.ai |
| **iOS Shortcut** | iPhone share sheet | Safari Share → Clipper → saves directly to iCloud Drive |
| **Claude Code skill** | Claude Code CLI | "Clip this URL: …" — Claude runs the skill, file lands in iCloud |

All four output the same `YYYY-MM-DD-{slug}-{source}.md` format with a YAML
frontmatter block compatible with Obsidian. They land in the same flat
`iCloud Drive/Clipper/` folder.

## Frontmatter schema

```yaml
---
title: "Article title"
url: https://example.com/path
source: example.com
author: "Author name"
published: 2026-05-14
clipped: 2026-05-14T08:30:00+08:00
lang: en              # en | zh-Hant | zh-Hans | zh | ja | other
adapter: substack     # which adapter handled it
word_count: 1247
tags: []
---
```

## Repo layout

```
clipper/
├── shared/             # Extraction + markdown + prompts, imported by every surface
├── extension/          # Chrome MV3 extension
├── bookmarklet/        # Safari bookmarklet
├── ios-shortcut/       # iOS Shortcut JS payload + BUILD.md
├── claude-code-skill/  # ~/.claude/skills/clipper/ contents
├── fixtures/           # Synthetic HTML fixtures for adapter tests
└── CLAUDE.md           # Project memory for future sessions
```

The shared core (`shared/`) is the source of truth. Each surface bundles it
through its own build (esbuild for content scripts, bookmarklet, and the
skill; Vite for the side panel).

## Quick start (development)

```bash
npm install
npm test                  # Vitest, 47 tests
npm run typecheck         # tsc --noEmit
npm run build:extension   # → extension/dist/
npm run build:bookmarklet # → bookmarklet/dist/
npm run build:shortcut    # → ios-shortcut/dist/payload.js
npm run build:skill       # → claude-code-skill/clip.mjs
```

## Install the Chrome extension

1. `npm run build:extension`
2. Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. **Load unpacked** → pick `extension/dist/`
5. (Optional) `chrome://extensions/shortcuts` → set Cmd+Shift+K on
   "Open Clipper on the current tab" if it didn't bind automatically

Then visit any article and either:

- Click the floating ✂ button (bottom-right)
- Press **Cmd+Shift+K** (Mac) / **Ctrl+Shift+K** (Windows)
- Right-click → **Clip with Clipper**

The side panel will open with the extracted markdown. Set a clips folder
once in **Options** (gear icon in the side panel) and every subsequent
clip auto-saves there as a `.md` file.

### Options page

- **Clips folder** — pick a folder via the File System Access API. Stored as
  an IndexedDB handle; Chrome re-asks for write permission after browser
  restarts.
- **Anthropic API key** — optional `sk-ant-…` key. With it set, the AI
  action buttons stream responses inline; without it they hand off to
  Claude.ai via the clipboard.
- **archive.ph fallback** — when an extraction returns fewer than 200 words
  (server-side paywall), show a button to open the page through
  `archive.ph/newest/`. Off by default.
- **Hide FAB on these sites** — bare hostnames where the floating button
  should not appear. The keyboard shortcut and context menu still work
  there.
- **Action prompts** — override any of the five default prompts
  (Summarize / Explain / Steel-man / Extract / Falsify).

## Install the Safari bookmarklet

1. `npm run build:bookmarklet`
2. Upload `bookmarklet/dist/` to GitHub Pages (or any HTTPS host). Default
   expected URL is `https://lawrencexwu.github.io/clipper/`. Override at
   build time with `CLIPPER_BOOKMARKLET_HOST=https://your.host/ npm run
   build:bookmarklet`.
3. Open `https://your.host/setup.html` in Safari and follow the
   instructions: drag the link to the favorites bar on Mac, or paste the
   bookmarklet code into a renamed bookmark on iPhone (manual flow,
   iOS Safari doesn't allow drag-install).

Click the bookmark on any article. A new tab opens with the clipped
markdown plus three buttons: Copy, Save to Files (uses the iOS share sheet
on iPhone — pick iCloud Drive), Open in Claude.ai.

## Install the iOS Shortcut

`npm run build:shortcut` produces `ios-shortcut/dist/payload.js`.

Open `ios-shortcut/BUILD.md` and follow it step-by-step — five Shortcuts
actions, paste `payload.js` into one of them, enable "Show in Share Sheet"
restricted to Safari web pages, save the Shortcut as **Clipper**.

After install: Safari → Share → Clipper. The `.md` file appears in
`iCloud Drive/Clipper/`.

The binary `.shortcut` file is intentionally not checked in (it's
version-coupled across iOS releases); BUILD.md is the durable artifact.
Once it works on your device, export a copy as backup.

## Install the Claude Code skill

```bash
cp -r claude-code-skill ~/.claude/skills/clipper
cd ~/.claude/skills/clipper
npm install   # installs jsdom, @mozilla/readability, turndown
```

Then in any Claude Code session: *"clip this URL: <https://stratechery.com/...>"*.
Claude reads the skill's `SKILL.md` description, runs
`node ~/.claude/skills/clipper/clip.mjs <URL>`, parses the JSON status,
and reports the saved file path.

Override the destination folder with `CLIPPER_DIR=/path/to/folder`.

## Locked decisions (don't re-litigate)

- **No backend.** Everything client-side or on Lawrence's devices. Markdown
  files in iCloud / Dropbox are the source of truth.
- **AI default:** Claude.ai handoff via clipboard + new tab; optional
  Anthropic API key in options enables inline streaming with
  `claude-opus-4-7`, adaptive thinking, and `cache_control` on the article
  body so multi-action workflows hit the prompt cache.
- **Aggressive paywall mode on.** Personal use. Extract from rendered DOM
  regardless of CSS hiding / overlays. `archive.ph` fallback for
  server-gated content (off by default).
- **File naming:** `YYYY-MM-DD-{slug}-{source}.md`, single flat folder.
- **Per-site adapters v1:** `x.com`, `substack`, `nyt` + generic Readability
  fallback. Adapters tried in order, fall through to generic.
- **AI actions v1:** Summarize, Explain, Steel-man, Extract, Falsify.
  Plus Send to NotebookLM (manual: downloads `.md` + opens NotebookLM).
- **Languages:** English, Traditional Chinese, Japanese — plus
  best-effort Simplified detection.
- **State management:** plain `useState`. No Redux/Zustand. No auth.
  No telemetry.

## Tech stack

- TypeScript + Vite (extension side panel) / esbuild (everything else)
- React + Tailwind (side panel + options page)
- `@mozilla/readability` + per-site adapters
- `turndown` for HTML → Markdown
- `jsdom` for the Node side (skill + tests)
- `chrome.storage.local` for the clip index + settings
- File System Access API for direct folder writes
- Vitest

## Status

v1 daily-driver ready as of phase 10 — see `CLAUDE.md` for the full
build log and the per-phase "needs in-browser smoke test" items.

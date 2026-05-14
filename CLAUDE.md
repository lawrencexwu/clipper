# Clipper

Personal web-content capture and analysis tool for Lawrence. Side-loaded on his
own devices; not for distribution. Read this file at the start of every session.

## Summary

Four thin surfaces sharing one extraction core:

1. **Chrome extension (MV3)** — Mac + Windows desktop. FAB on every page + side panel.
2. **iOS Safari bookmarklet** — also works in Mac Safari. Saves to Files / iCloud.
3. **iOS Shortcut** — share-sheet integration on iPhone, saves to iCloud Drive.
4. **Claude Code skill** — `~/.claude/skills/clipper/`, clip by pasting a URL in Claude Code.

All four output the same markdown format (YAML frontmatter + content body) to the
same iCloud/Dropbox folder.

## Tech stack

- TypeScript + Vite
- React + Tailwind (side panel only)
- `@mozilla/readability` for generic extraction
- `turndown` for HTML→Markdown
- `jsdom` for the Node side (skill + tests)
- `chrome.storage.local` for the clip index
- File System Access API for direct folder writes on desktop
- Vitest for testing

## Repo structure

```
clipper/
├── shared/                  # Extraction + markdown + prompts (imported by all surfaces)
│   ├── extractor.ts
│   ├── adapters/            # x.ts, substack.ts, nyt.ts, generic.ts, index.ts (dispatcher)
│   ├── markdown.ts          # Turndown config
│   ├── frontmatter.ts       # YAML generation
│   ├── prompts.ts           # 5 action prompts as named exports
│   ├── slug.ts              # Filename slugification (handles CJK)
│   ├── lang.ts              # EN / 中 / 日 detection
│   ├── archive.ts           # archive.ph URL rewriter
│   └── __tests__/           # Vitest tests against fixtures
├── extension/               # Chrome MV3 extension
├── bookmarklet/             # Bookmarklet (Safari iOS + Mac)
├── ios-shortcut/            # Shortcut file + BUILD.md
├── claude-code-skill/       # SKILL.md + clip.ts
├── fixtures/                # Saved HTML snapshots for adapter tests
└── CLAUDE.md / README.md
```

Path alias: `@shared/*` → `shared/*` (configured in `tsconfig.json` and
`vite.config.ts`). Shared code is the source of truth — all surfaces import from
it. Don't duplicate extraction logic.

## Locked decisions (don't re-litigate)

- **No backend.** Everything client-side or on Lawrence's devices. Markdown files
  in iCloud/Dropbox are the source of truth.
- **AI default:** open Claude.ai in a new tab with prompt + clipped content via
  clipboard handoff. Optional Anthropic API key setting enables inline summaries.
- **Aggressive paywall mode on by default.** Personal use. Extract from rendered
  DOM regardless of CSS hiding/overlays. Optional `archive.ph` fallback for
  server-gated content (off by default).
- **File naming:** `YYYY-MM-DD-{slugified-title}-{source}.md`, single flat folder.
- **Per-site adapters v1:** `x.com`, `substack`, `nyt`, plus generic Readability
  fallback. Dispatcher tries domain-specific first, then generic.
- **AI actions v1:** Summarize, Explain, Steel-man, Extract, Falsify. Plus
  "Send to NotebookLM" (manual, downloads .md + opens NotebookLM).
- **Languages:** English, Traditional Chinese, Japanese.
- **State management:** plain `useState`. No Redux/Zustand. No auth. No telemetry.

## Frontmatter schema

```yaml
---
title: "Article title"
url: https://example.com/path
source: substack.com         # bare domain
author: "Author name"        # "" if not extractable
published: 2026-05-14        # "" if not extractable
clipped: 2026-05-14T08:30:00+08:00
lang: en                     # en | zh | ja | other
adapter: substack            # which adapter handled it
word_count: 1247
tags: []
---
```

## How to run

```bash
npm install
npm test              # Vitest, against fixtures
npm run typecheck     # tsc --noEmit
npm run build:extension
npm run build:bookmarklet
```

### Loading the extension unpacked

1. `npm run build:extension`
2. Chrome → `chrome://extensions` → enable "Developer mode"
3. "Load unpacked" → select `extension/dist/`

The build orchestrator (`extension/build.mjs`) produces:

- `background.js` (ESM service worker, esbuild)
- `content.js` (IIFE content script, esbuild)
- `sidepanel.html` + `assets/` (Vite + React + Tailwind)
- `manifest.json` (copied verbatim)

## Current phase

**Phase 2 build-complete.** Chrome MV3 extension assembled:

- `extension/manifest.json` — MV3 with `sidePanel`, `activeTab`, `scripting`,
  `storage`, content script on `<all_urls>`, ESM background worker
- `extension/src/content/content.ts` — draggable FAB, position persisted
  per-host via `chrome.storage.local["fab-pos:<host>"]`. Self-contained
  (no imports) so it bundles to a clean IIFE.
- `extension/src/background.ts` — `sidePanel.open` on icon click and on
  `open-side-panel` message from the FAB; bridges
  `chrome.scripting.executeScript` to return the active tab's
  `outerHTML + URL + title`.
- `extension/src/sidepanel/` — React + Tailwind side panel. On open it asks
  the background for the active tab's HTML, parses it with DOMParser, runs
  `extract()` from shared, and renders title/metadata/markdown with Copy
  and Download buttons.
- `extension/build.mjs` — orchestrator: esbuild for background (ESM) and
  content (IIFE), Vite for the side panel, then copies manifest.json.
- `npm run build:extension` ✅ — outputs `extension/dist/` ready for
  `chrome://extensions → Load unpacked`.

**Needs in-browser smoke test before Phase 3:** load unpacked, click FAB on
3 different blog posts, verify side panel shows clean MD, Copy/Download
work, FAB position persists per site. (Cannot run from sandbox; Lawrence
to verify on a real Chrome.)

**Next: Phase 3 — File System Access API integration.**

## Phases (high-level)

0. Bootstrap ✅
1. Shared extraction core (generic Readability, markdown, frontmatter, slug, lang, tests) ✅
2. Chrome extension MVP (FAB, side panel, copy/download) — build ✅, pending in-browser smoke test
3. File System Access API integration (auto-save to chosen folder)
4. AI actions (Claude.ai handoff + optional API key)
5. Per-site adapters (X, Substack, NYT, archive.ph)
6. Library + search (clip index, search/filter, tag editing)
7. Bookmarklet (Safari iOS + Mac)
8. iOS Shortcut
9. Claude Code skill
10. Polish (keyboard shortcut, context menu, hide list, README, screenshots)

## Working style

- Use `TodoWrite` to track sub-tasks within each phase.
- Ask before advancing phases. Show what's done, acceptance result, request greenlight.
- Commit at every phase boundary: `phase N: <summary>`.
- Test on real sites, not just fixtures. After fixtures pass, browse 5+ real
  sites per surface and find what breaks.
- Update this file at the end of each phase: what's done, what's next, gotchas.
- Don't pre-build for hypothetical needs.

## Gotchas / known issues

- **NYT byline not extracted by generic adapter.** The fixture uses
  `meta[name="byl"]` (NYT-specific) instead of `meta[name="author"]`. Generic
  Readability also misses it. Will be fixed by the NYT-specific adapter in
  Phase 5.
- **X/Twitter not usable via generic Readability.** The thread DOM has no
  prose container Readability recognises. Pipeline runs without crashing but
  output is empty / minimal. Per-site adapter is the fix (Phase 5).
- **Fixtures are synthetic.** They mimic real DOM structures but were authored
  for this repo, not scraped. After each adapter lands, re-test on 5+ live
  pages and capture failures.

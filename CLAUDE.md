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

**Phase 7 build-complete.** Safari bookmarklet:

- `bookmarklet/src/loader.ts` — the `javascript:` payload. Calls
  `window.open()` synchronously to preserve the user gesture (iOS Safari
  rule), then injects `<script src=…/main.js>` into the host page and
  hands the script the opened-window reference + a UUID via a global
  `window.__clipper.run(target, uuid)` hook.
- `bookmarklet/src/main.ts` — runs in the host-page context. Uses the
  shared `extract()` pipeline, then `postMessage`s the markdown +
  frontmatter + filename to the result tab. Retries every 250ms (up to
  ~5s) until acked or the target tab closes.
- `bookmarklet/result-page.html` + `bookmarklet/src/result.ts` — the
  result tab. Listens for the `clipper-payload` message, caches in
  `sessionStorage` keyed by the URL's UUID hash (so a refresh restores
  the view), shows title / metadata / raw markdown, with Copy / Save
  to Files / Open in Claude.ai buttons. The Save button triggers a
  blob download — on iOS Safari that opens the share sheet which
  includes "Save to Files" → iCloud Drive.
- `bookmarklet/setup-page.html` — the install page. Drag the link to
  the bookmarks bar on Mac; manual URL-paste instructions for iPhone.
- `bookmarklet/build.js` — esbuild-based orchestrator. Three IIFE
  bundles: `main.js` (with shared core), `result.js`, and the
  loader (minified, URL-encoded, wrapped as `javascript:`). The
  loader's host URL is injected at build time via `__HOST__` (override
  with `CLIPPER_BOOKMARKLET_HOST`).

Default hosting URL is `https://lawrencexwu.github.io/clipper/`. To
publish: copy `bookmarklet/dist/` to that GitHub Pages site.
Bookmarklet URL is **879 chars**, well under any browser limit.

**Acceptance (needs real-Safari verification):**

- Mac Safari: drag the link from `setup.html` to favorites bar. Visit
  an article. Click bookmark. New tab opens with the clipped markdown.
  Copy / Save / Claude.ai handoff all work.
- iPhone Safari: install via the manual paste instructions. Tap the
  bookmark on an article. New tab. Save → share sheet → Save to Files
  → iCloud Drive lands the `.md`.

**Next: Phase 8 — iOS Shortcut.**

---

**Phase 6 complete.** Library + search:

- `shared/frontmatter.ts` — new `parseFrontmatter(markdown)` round-trips
  every field `buildFrontmatter` emits (5 new tests). Unwraps quoted
  scalars, parses inline arrays, handles empty `published`.
- `extension/src/lib/library.ts` — clip index in `chrome.storage.local`
  under `library.clips`. CRUD: `addClip`, `removeClip`, `updateClipMeta`,
  `listClips`. Pure helpers: `applyFilters` (substring match across
  title/source/author/tags + source/lang filters), `uniqueValues` (chip
  bucket counts).
- `extension/src/lib/fs.ts` — `readClip(dir, filename)` opens the file and
  parses its frontmatter; `rewriteFrontmatter(dir, filename, nextFm)` reads,
  swaps the frontmatter block, and writes back, preserving the body.
- `extension/src/sidepanel/App.tsx` — header now has Current / Library
  tabs. Save flow appends `ClipMeta` to the index after a successful disk
  write. Library tab renders search input, source + lang filter chips
  with counts, and a list of clips (newest first via insertion order in
  the index). Clicking a row opens a viewer with the on-disk markdown,
  a tag editor (chip UI with `+` input, Save button appears when dirty),
  and a "Remove from library index" link.

**Acceptance (real-Chrome verification):**

- Clip 20+ articles across different sources. They appear in Library
  newest-first.
- Search filters by title / source / author / tag fragments.
- Source + lang filter chips narrow the list.
- Click a clip → loads markdown from disk → preview matches what got
  saved.
- Add a tag, click Save → file on disk has the new tag in frontmatter,
  list entry shows the chip.

**Next: Phase 7 — bookmarklet (Safari iOS + Mac).**

---

**Phase 5 complete.** Per-site adapters + archive.ph fallback:

- `shared/adapters/x.ts` — `x.com` / `twitter.com`. Walks
  `article[data-testid="tweet"]` chains filtered to the URL's handle.
  Output: numbered paragraphs (skips prepending a number when the tweet
  already starts with `N/`), images preserved as `<img>` (avatars/profile
  pics filtered), quote tweets as `<blockquote>@author: text</blockquote>`.
- `shared/adapters/substack.ts` — `*.substack.com` and any site that
  declares `<meta name="generator" content="Substack">`. Extracts from
  `.body.markup`, prepends `<h2>` subtitle if `.subtitle` is present,
  rewrites `.footnote-anchor` refs to `[^N]` with definitions appended
  (pass-through when no footnote markup).
- `shared/adapters/nyt.ts` — `nytimes.com`. Clones the doc, strips
  `[data-testid*=paywall]` / `[id*=gateway]` / `[class*=paywall|gateway]`
  before extracting `section[name="articleBody"]`. Byline from
  `meta[name="byl"]` (NYT-specific) or `[data-testid="byline"]`, stripping
  the leading "By".
- `shared/archive.ts` — `archivePhUrl()` rewrites to
  `https://archive.ph/newest/{url}`; `shouldOfferArchive(n)` thresholds at
  200 words.
- `shared/adapters/index.ts` — dispatcher registers x → substack → nyt,
  falls back to generic.
- `extension/src/sidepanel/App.tsx` — when extraction is sparse
  (<200 words) AND the archive fallback setting is on, shows a yellow
  banner with an "Open archive.ph" link.
- `extension/src/options/Options.tsx` — new "archive.ph fallback" section
  with a checkbox (off by default).

**Test coverage:** 11 new adapter tests, 41 total. Each adapter validated
end-to-end via `extract()` + against its fixture. URL matchers checked
for hostname edge cases (`nytimes.example.com` rejected, `www.x.com` and
`twitter.com` accepted, `bob.substack.com` and meta-generator-detected
custom domains both detected).

**Acceptance (needs real-Chrome verification on 5+ live pages each):**

- X: open a thread by the original author. Side panel should show
  numbered paragraphs, no replies from other users mixed in.
- Substack: open a free post on a `.substack.com` domain and a
  custom-domain Substack site. Both should show the substack adapter
  badge in the preview header.
- NYT: open a paywalled article. CSS-overlay paywalls should be stripped;
  server-gated content (truncated HTML) will return a short clip — toggle
  archive.ph fallback in options to get the "Open archive.ph" button.

**Next: Phase 6 — library + search.**

- `shared/prompts.ts` — 5 default action prompts (`summarize`, `explain`,
  `steelman`, `extract`, `falsify`) as named exports + `DEFAULTS` map +
  `PROMPT_LABELS`
- `extension/src/lib/settings.ts` — `chrome.storage.local` wrapper for the
  Anthropic API key + per-prompt overrides; `resolvePrompt(key)` returns the
  override or the default
- `extension/src/lib/ai.ts`
  - `claudeAiHandoff(prompt, markdown)` — copies `prompt\n\n---\n\nmarkdown`
    to clipboard, opens `https://claude.ai/new` in a new tab
  - `notebookLmHandoff(filename, markdown)` — downloads the `.md`, opens
    `https://notebooklm.google.com/`
  - `streamFromAnthropic(apiKey, prompt, markdown, {onDelta, signal})` —
    raw `fetch` to `api.anthropic.com/v1/messages` with `stream: true`,
    `thinking: {type: "adaptive"}`, `cache_control` on the article body so
    repeat actions on the same clip get cache hits. Headers include
    `anthropic-dangerous-direct-browser-access: true`. Model: `claude-opus-4-7`.
- `extension/src/sidepanel/App.tsx` — new AI button row (5 prompts +
  NotebookLM). No API key → Claude.ai handoff with toast. With API key →
  inline streaming panel in the side panel with Stop / Close buttons and
  token usage line at the bottom (input / output / cached). One in-flight
  stream at a time; new click aborts the previous.
- `extension/src/options/Options.tsx` — three new sections: Anthropic API key
  (password input with reveal/save/clear), 5 prompt-override text areas
  (per-prompt Save + Reset-to-default, "(overridden)" tag when active), and
  notes. Folder section unchanged.

**Acceptance (needs real-Chrome verification):**

- All 5 actions copy the right `{prompt}\n\n---\n\n{markdown}` payload to
  the clipboard and open Claude.ai in a new tab.
- Custom prompts entered in options are used by the actions.
- With an API key set, Summarize streams inline in the side panel and
  reports input / output / cached token usage at the end.
- NotebookLM downloads the `.md` and opens NotebookLM.

**Next: Phase 5 — per-site adapters (X, Substack, NYT, archive.ph fallback).**

## Phases (high-level)

0. Bootstrap ✅
1. Shared extraction core (generic Readability, markdown, frontmatter, slug, lang, tests) ✅
2. Chrome extension MVP (FAB, side panel, copy/download) — build ✅, pending in-browser smoke test
3. File System Access API integration (auto-save to chosen folder) — build ✅, pending in-browser smoke test
4. AI actions (Claude.ai handoff + optional API key) — build ✅, pending in-browser smoke test
5. Per-site adapters (X, Substack, NYT, archive.ph) — build ✅, pending in-browser smoke test
6. Library + search (clip index, search/filter, tag editing) — build ✅, pending in-browser smoke test
7. Bookmarklet (Safari iOS + Mac) — build ✅, pending in-Safari smoke test
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

- **Fixtures are synthetic.** They mimic real DOM structures but were authored
  for this repo, not scraped. After each adapter lands, re-test on 5+ live
  pages and capture failures.
- **Substack footnote conversion is best-effort.** Refs become `[^N]` and
  definitions are appended only when a `.footnote` / `.footnote-body`
  container is present in the body. Real Substack often renders footnote
  bodies in a separate wrapper outside `.body.markup` — when that happens we
  emit `[^N]` refs without definitions. Verify on a footnote-heavy post and
  refine the selector list as needed.
- **X quote tweets via nested `<article>`.** The adapter scans
  `article :scope article` for quotes, which works on the simple thread view.
  Real X often wraps quotes in non-`article` containers; if a thread with
  quotes loses them, capture the live DOM and add a selector.
- **NYT server-gated content.** The adapter only handles the CSS-hidden
  overlay case. Articles whose body is truncated server-side will produce a
  short clip — enable `archive.ph` fallback in options.

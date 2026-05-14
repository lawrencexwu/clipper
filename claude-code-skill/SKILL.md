---
name: clipper
description: "Use when the user asks to clip, save, or extract content from a URL (phrases like 'clip this article', 'save this URL', 'extract the content from https://...'). Fetches the page, extracts the main article content using Mozilla Readability and per-site adapters (X, Substack, NYT), then writes a clean markdown file with YAML frontmatter to the Clipper folder in iCloud Drive."
---

# Clipper

Run this skill when the user wants to save the content of a web page as a
markdown file. It produces the same `YYYY-MM-DD-{slug}-{source}.md` format
as the Chrome extension, iOS Shortcut, and Safari bookmarklet — so all
four surfaces drop into the same flat folder.

## Invocation

```bash
node ~/.claude/skills/clipper/clip.mjs <URL>
```

The script writes the markdown file and prints a single JSON object on
stdout. Parse it and report `filename` and `path` back to the user.

Override the destination folder with `CLIPPER_DIR`:

```bash
CLIPPER_DIR=/path/to/folder node ~/.claude/skills/clipper/clip.mjs <URL>
```

## Output

**Success** (exit 0) — JSON on stdout:

```json
{
  "ok": true,
  "path": "/Users/lawrence/Library/Mobile Documents/com~apple~CloudDocs/Clipper/2026-05-14-why-widgets-matter-doohickey.example.md",
  "filename": "2026-05-14-why-widgets-matter-doohickey.example.md",
  "title": "Why Widgets Matter",
  "source": "doohickey.example",
  "author": "Jane Author",
  "word_count": 337,
  "lang": "en",
  "adapter": "generic"
}
```

**Failure** (non-zero exit) — JSON on stderr:

```json
{ "ok": false, "error": "HTTP 404 fetching https://…" }
```

## Default folder

`~/Library/Mobile Documents/com~apple~CloudDocs/Clipper/` — the macOS
mount point for `iCloud Drive/Clipper/`. Files saved here sync across
all the user's Apple devices.

Filename collisions are resolved by appending `-2`, `-3`, …; the script
never overwrites an existing file.

## Install

```bash
cp -r /path/to/clipper/claude-code-skill ~/.claude/skills/clipper
cd ~/.claude/skills/clipper
npm install   # installs jsdom, @mozilla/readability, turndown
```

After install, `clip.mjs` is executable and self-contained except for
those three runtime dependencies (which `npm install` puts in
`node_modules/`).

## When NOT to use this skill

- The user pasted markdown or HTML directly, not a URL — just save it
  with the normal `Write` tool.
- The user wants to fetch a URL for analysis but doesn't want a file
  written — use `WebFetch` instead.
- The URL is behind a hard server-side paywall (NYT, WSJ, FT, etc.) — the
  fetch will return a stub. Tell the user and suggest the Chrome
  extension's archive.ph fallback.

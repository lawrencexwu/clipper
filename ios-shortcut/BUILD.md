# Build the Clipper iOS Shortcut

The Shortcuts app's binary `.shortcut` format is version-coupled across iOS
releases, so we don't check one into the repo. Instead these step-by-step
instructions let you (or future-you) rebuild the Shortcut from scratch in a
few minutes. The durable artifact is this file plus
`ios-shortcut/dist/payload.js`.

## What it does

Triggered from Safari's share sheet on an article, the Shortcut:

1. Hands the live Safari tab to a JS extraction payload (Mozilla Readability
   + per-site adapters + Turndown — the same shared core as the Chrome
   extension and bookmarklet).
2. Receives `{ filename, markdown }` JSON back.
3. Writes the `.md` file to `iCloud Drive/Clipper/` with the canonical
   `YYYY-MM-DD-{slug}-{source}.md` name. Shortcuts auto-resolves filename
   collisions.

## One-time setup

1. **Build the payload.** From the repo root: `npm run build:shortcut`. This
   produces `ios-shortcut/dist/payload.js` (~57KB minified). You'll paste it
   into a Shortcuts action below.
2. **Make sure `iCloud Drive/Clipper/` exists.** On iPhone: Files app →
   iCloud Drive → ⋯ → New Folder → "Clipper". (The Save File action can
   create it, but pre-creating avoids a permission prompt the first time.)

## Build the Shortcut (iPhone — easiest)

You can also do this on a Mac that's signed into the same iCloud account; the
Shortcut syncs to your iPhone automatically. Steps below assume iPhone.

1. Open **Shortcuts** → **All Shortcuts** tab → **+** in the top right.
2. Tap the title at the top (it reads "New Shortcut") and rename it to
   **Clipper**.
3. Tap the **(i)** info button at the bottom.
   - Toggle **Show in Share Sheet** on.
   - Tap **Share Sheet Types**. Turn **Safari web pages** on; turn
     everything else off. Done.
4. Tap **Add Action** and build this 6-step sequence (search by the action
   name in the action picker):

   | # | Action | Configuration |
   |---|---|---|
   | 1 | **Run JavaScript on Web Page** | *Input*: `Shortcut Input`. Tap the script field and paste the full contents of `ios-shortcut/dist/payload.js`. |
   | 2 | **Get Dictionary from Input** | *Input*: `JavaScript Result`. |
   | 3 | **Get Dictionary Value** | *Get* `Value` for `filename` from `Dictionary`. Long-press the output pill → **Rename Variable** → `filename`. |
   | 4 | **Get Dictionary Value** | *Get* `Value` for `markdown` from `Dictionary`. Rename the output variable to `markdown`. |
   | 5 | **Text** | Tap the text field and insert the `markdown` variable. (This step exists only to give the next action a "file" with a content type. Skip it if you're comfortable passing the markdown variable directly into Save File.) |
   | 6 | **Save File** | *File*: the `Text` output from step 5 (or the `markdown` variable). *Service*: `iCloud Drive`. *Destination Path*: tap the path field and set it to `Clipper/`. *Ask Where to Save*: **off**. *Overwrite If File Exists*: **off** (Shortcuts auto-appends `-2`, `-3`, …). Tap the action's **(⌄)** chevron → **Use Custom File Name** → on → set the file name to the `filename` variable. |

5. Tap **Done** in the top right to save.

## Use it

On an article in Safari: tap **Share** → scroll the second row of
share-sheet items → tap **Clipper**. The Shortcut shows a brief progress
indicator and the `.md` file lands in `iCloud Drive/Clipper/`. Verify by
opening the Files app.

## Updating the payload

Whenever `shared/` changes, re-run `npm run build:shortcut` and re-paste
`dist/payload.js` into the Shortcut's "Run JavaScript on Web Page" action.
There's no automation for in-place updating — Shortcuts doesn't have a
build pipeline.

## Troubleshooting

- **The Share Sheet doesn't show Clipper.** Long-press the Shortcut in the
  Shortcuts app → **Show in Share Sheet** must be on, and **Share Sheet
  Types** must include Safari web pages.
- **`JavaScript error: 'completion' is not defined`.** Make sure the
  pasted code is the full minified `payload.js` and that the action's
  input is set to **Shortcut Input** (not "Clipboard" or "Magic Variable").
- **Saves to `Shortcuts/` instead of `Clipper/`.** In the Save File action,
  set Destination Path to `Clipper/` and turn on **Use Custom File Name**.
- **Empty markdown.** The page may rely on heavy client-side rendering;
  the Shortcut runs the extractor against the current DOM at share-sheet
  time, so heavily lazy-loaded pages can be sparse. The Chrome extension's
  archive.ph fallback is not available here.

## Exporting the .shortcut file

After the Shortcut works, you can export it: in the Shortcuts app, tap and
hold the Clipper tile → **Share** → **Save to Files** → save into the repo
at `ios-shortcut/Clipper.shortcut`. The file is version-coupled — opening
it on a meaningfully older iOS may fail. Treat the export as a backup, not
the primary install method.

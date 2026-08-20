// Runs on claude.ai. When the side panel hands off a clip, it stores the
// payload in chrome.storage.local and opens claude.ai/new. This script
// picks the payload up, fills the composer, and sends it. Self-contained
// (no imports) so it bundles as an IIFE content script.

(() => {
  const KEY = "clipper.pendingHandoff";
  const MAX_AGE_MS = 90_000;
  const POLL_MS = 300;
  const TIMEOUT_MS = 20_000;

  try {
    if (!chrome.runtime || !chrome.runtime.id) return;
    chrome.storage.local.get(KEY, (r) => {
      if (chrome.runtime.lastError) return;
      const pending = r[KEY] as { text: string; ts: number } | undefined;
      if (!pending || !pending.text) return;
      if (Date.now() - pending.ts > MAX_AGE_MS) {
        chrome.storage.local.remove(KEY);
        return;
      }
      // Claim it now so the post-send navigation doesn't resend.
      chrome.storage.local.remove(KEY);
      waitForComposer(pending.text);
    });
  } catch {
    /* stale context after an extension reload — nothing to do */
  }

  function waitForComposer(text: string): void {
    const start = Date.now();
    const timer = setInterval(() => {
      const editor = findEditor();
      if (editor) {
        clearInterval(timer);
        fillAndSend(editor, text);
      } else if (Date.now() - start > TIMEOUT_MS) {
        clearInterval(timer);
        // Give up silently; the clipboard fallback still has the payload.
      }
    }, POLL_MS);
  }

  function findEditor(): HTMLElement | null {
    const selectors = [
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"]',
      "textarea",
    ];
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  function fillAndSend(editor: HTMLElement, text: string): void {
    editor.focus();
    let inserted = false;

    if (editor instanceof HTMLTextAreaElement) {
      editor.value = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      inserted = true;
    } else {
      try {
        // execCommand routes through the editor framework's input handling
        // (ProseMirror / React), which a raw textContent set bypasses.
        inserted = document.execCommand("insertText", false, text);
      } catch {
        inserted = false;
      }
      if (!inserted) {
        editor.textContent = text;
        editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        inserted = editor.textContent.length > 0;
      }
    }

    if (!inserted) return;
    setTimeout(() => clickSend(editor), 300);
  }

  function clickSend(editor: HTMLElement): void {
    const btn =
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Send message" i]'
      ) ||
      document.querySelector<HTMLButtonElement>(
        'button[aria-label*="send" i]'
      ) ||
      document.querySelector<HTMLButtonElement>(
        'button[data-testid="send-button"]'
      );
    if (btn && !btn.disabled) {
      btn.click();
      return;
    }
    // Fallback: Enter submits in the claude.ai composer.
    for (const type of ["keydown", "keyup"] as const) {
      editor.dispatchEvent(
        new KeyboardEvent(type, {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    }
  }
})();

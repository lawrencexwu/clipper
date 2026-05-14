// Content script: injects a draggable FAB. Self-contained (no imports) so it
// can be bundled as IIFE for content_scripts. Per-site position persisted via
// chrome.storage.local under key `fab-pos:<host>`.

(() => {
  if (window.top !== window) return; // top frame only
  if (document.getElementById("clipper-fab")) return;

  const host = location.hostname;
  const storageKey = `fab-pos:${host}`;
  const DEFAULT_RIGHT = 16;
  const DEFAULT_BOTTOM = 16;

  const fab = document.createElement("button");
  fab.id = "clipper-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Clip this page with Clipper");
  fab.title = "Clip this page";
  fab.textContent = "✂";

  Object.assign(fab.style, {
    position: "fixed",
    zIndex: "2147483647",
    right: `${DEFAULT_RIGHT}px`,
    bottom: `${DEFAULT_BOTTOM}px`,
    width: "44px",
    height: "44px",
    borderRadius: "22px",
    border: "none",
    background: "#111",
    color: "#fff",
    fontSize: "20px",
    lineHeight: "44px",
    textAlign: "center",
    cursor: "grab",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
    userSelect: "none",
    padding: "0",
  } as CSSStyleDeclaration);

  chrome.storage.local.get(storageKey, (result) => {
    const pos = result[storageKey] as { left: number; top: number } | undefined;
    if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
      fab.style.left = `${pos.left}px`;
      fab.style.top = `${pos.top}px`;
      fab.style.right = "auto";
      fab.style.bottom = "auto";
    }
  });

  let dragging = false;
  let moved = false;
  let offsetX = 0;
  let offsetY = 0;

  fab.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = false;
    const rect = fab.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    fab.setPointerCapture(e.pointerId);
    fab.style.cursor = "grabbing";
  });

  fab.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    moved = true;
    const left = Math.max(0, Math.min(window.innerWidth - 44, e.clientX - offsetX));
    const top = Math.max(0, Math.min(window.innerHeight - 44, e.clientY - offsetY));
    fab.style.left = `${left}px`;
    fab.style.top = `${top}px`;
    fab.style.right = "auto";
    fab.style.bottom = "auto";
  });

  fab.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    fab.style.cursor = "grab";
    fab.releasePointerCapture(e.pointerId);
    if (moved) {
      const left = parseInt(fab.style.left || "0", 10);
      const top = parseInt(fab.style.top || "0", 10);
      chrome.storage.local.set({ [storageKey]: { left, top } });
    }
  });

  fab.addEventListener("click", (e) => {
    if (moved) {
      e.preventDefault();
      moved = false;
      return;
    }
    chrome.runtime.sendMessage({ type: "open-side-panel" });
  });

  document.documentElement.appendChild(fab);
})();

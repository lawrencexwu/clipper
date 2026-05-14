// Tiny loader compiled to a `javascript:` bookmarklet URL.
//
// The bookmarklet must call `window.open` synchronously to preserve the
// user-gesture context (iOS Safari blocks popups from async script loads).
// The opened tab starts loading result.html immediately; meanwhile we inject
// the main bundle into the host page and ask it to postMessage the
// extracted markdown back to the result tab.

declare const __HOST__: string;

(() => {
  const HOST = __HOST__;
  const uuid =
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)) + Date.now().toString(36);

  const target = window.open(`${HOST}result.html#${uuid}`, "_blank");
  if (!target) {
    alert("Clipper: popup blocked — allow popups for this site.");
    return;
  }

  const s = document.createElement("script");
  s.src = `${HOST}main.js?v=${Date.now()}`;
  s.onload = () => {
    const api = (
      window as unknown as {
        __clipper?: { run: (target: Window, uuid: string) => void };
      }
    ).__clipper;
    if (api) api.run(target, uuid);
    else alert("Clipper: failed to initialize (no __clipper on window).");
  };
  s.onerror = () => {
    alert(`Clipper: failed to load main.js from ${HOST}`);
    target.close();
  };
  document.head.appendChild(s);
})();

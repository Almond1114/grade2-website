(() => {
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable) return;

  const prevent = (event) => event.preventDefault();

  // iOS Safari pinch zoom and system long-press gestures.
  document.addEventListener("gesturestart", prevent, { passive: false });
  document.addEventListener("gesturechange", prevent, { passive: false });
  document.addEventListener("gestureend", prevent, { passive: false });

  // Prevent double-tap zoom, selection handles, image dragging and context menus.
  document.addEventListener("dblclick", prevent, { passive: false });
  document.addEventListener("selectstart", prevent, { passive: false });
  document.addEventListener("dragstart", prevent, { passive: false });
  document.addEventListener("contextmenu", prevent, { passive: false });

  // Multi-touch must remain usable for moving and firing, but the browser must
  // never interpret it as page zooming or scrolling.
  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1 || document.body.classList.contains("touch-device")) {
      event.preventDefault();
    }
  }, { passive: false });
})();

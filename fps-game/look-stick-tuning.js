(() => {
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable || window.__neonRushLookStickDoubleSpeed) return;

  window.__neonRushLookStickDoubleSpeed = true;
  window.neonRushLookStickSpeedMultiplier = 2;

  const previousDispatchEvent = document.dispatchEvent.bind(document);
  document.dispatchEvent = (event) => {
    if (event instanceof MouseEvent && event.type === "mousemove" && !event.isTrusted) {
      const multiplier = window.neonRushLookStickSpeedMultiplier || 2;
      const scaledEvent = new MouseEvent("mousemove", {
        bubbles: event.bubbles,
        cancelable: event.cancelable,
      });

      try {
        Object.defineProperties(scaledEvent, {
          movementX: { value: event.movementX * multiplier },
          movementY: { value: event.movementY * multiplier },
        });
      } catch {
        Object.defineProperty(scaledEvent, "movementX", { value: event.movementX * multiplier });
        Object.defineProperty(scaledEvent, "movementY", { value: event.movementY * multiplier });
      }

      return previousDispatchEvent(scaledEvent);
    }

    return previousDispatchEvent(event);
  };
})();

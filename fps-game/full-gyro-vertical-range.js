(() => {
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable || window.__neonRushFullGyroVerticalRange) return;
  window.__neonRushFullGyroVerticalRange = true;

  // gyro-mode-selector.js intentionally stops at about 83 degrees to avoid a
  // pole flip. PointerLockControls itself can safely reach almost 90 degrees,
  // so extend and correct only the vertical movement while VR FULL is selected.
  const SOURCE_MAX_PITCH = 1.45;
  const TARGET_MAX_PITCH = Math.PI / 2 - 0.012;
  const VERTICAL_SCALE = TARGET_MAX_PITCH / SOURCE_MAX_PITCH;
  const previousDispatchEvent = document.dispatchEvent.bind(document);

  document.dispatchEvent = (event) => {
    const fullMode = window.__neonRushGyroSelection?.mode === "full";
    const gyroMouseMove = fullMode
      && event instanceof MouseEvent
      && event.type === "mousemove"
      && !event.isTrusted
      && Number.isFinite(event.movementY);

    if (!gyroMouseMove) return previousDispatchEvent(event);

    const extendedEvent = new MouseEvent("mousemove", {
      bubbles: event.bubbles,
      cancelable: event.cancelable,
    });

    // Device pitch and PointerLock mouse Y use opposite signs.
    // Invert only VR FULL's vertical axis; keep horizontal tracking unchanged.
    const correctedMovementY = -event.movementY * VERTICAL_SCALE;

    try {
      Object.defineProperties(extendedEvent, {
        movementX: { value: event.movementX },
        movementY: { value: correctedMovementY },
      });
    } catch {
      Object.defineProperty(extendedEvent, "movementX", { value: event.movementX });
      Object.defineProperty(extendedEvent, "movementY", { value: correctedMovementY });
    }

    return previousDispatchEvent(extendedEvent);
  };
})();

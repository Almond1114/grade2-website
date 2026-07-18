(() => {
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable || window.__neonRushDualHalfControls) return;

  const touchRoot = document.querySelector("#touch-controls");
  if (!touchRoot) return;

  window.__neonRushDualHalfControls = true;
  document.body.classList.add("dual-half-controls-enabled");

  const layer = document.createElement("div");
  layer.className = "dual-half-controls";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `
    <div class="dual-half-stick dual-half-move-stick">
      <div class="dual-half-stick-ring"></div>
      <div class="dual-half-stick-knob"></div>
    </div>
    <div class="dual-half-stick dual-half-look-stick">
      <div class="dual-half-stick-ring"></div>
      <div class="dual-half-stick-knob"></div>
    </div>
  `;
  document.body.appendChild(layer);

  const moveStick = layer.querySelector(".dual-half-move-stick");
  const moveKnob = moveStick.querySelector(".dual-half-stick-knob");
  const lookStick = layer.querySelector(".dual-half-look-stick");
  const lookKnob = lookStick.querySelector(".dual-half-stick-knob");

  const activeKeys = new Set();
  const movementKeys = new Set();

  let movePointerId = null;
  let lookPointerId = null;
  let moveOriginX = 0;
  let moveOriginY = 0;
  let lookOriginX = 0;
  let lookOriginY = 0;
  let moveRadius = 48;
  let lookRadius = 48;
  let lookX = 0;
  let lookY = 0;
  let lookAnimationId = 0;
  let lastLookFrame = performance.now();
  let dashTimer = 0;
  let autoDashing = false;

  const keyboardEvent = (type, code) => new KeyboardEvent(type, {
    code,
    key: code,
    bubbles: true,
    cancelable: true,
  });

  const pressKey = (code) => {
    if (activeKeys.has(code)) return;
    activeKeys.add(code);
    window.dispatchEvent(keyboardEvent("keydown", code));
  };

  const releaseKey = (code) => {
    if (!activeKeys.has(code)) return;
    activeKeys.delete(code);
    window.dispatchEvent(keyboardEvent("keyup", code));
  };

  const setMovementKey = (code, enabled) => {
    if (enabled) {
      movementKeys.add(code);
      pressKey(code);
    } else {
      movementKeys.delete(code);
      releaseKey(code);
    }
  };

  const releaseMovement = () => {
    for (const code of movementKeys) releaseKey(code);
    movementKeys.clear();
  };

  const stopDashCharge = () => {
    if (dashTimer) clearTimeout(dashTimer);
    dashTimer = 0;
    autoDashing = false;
    releaseKey("ShiftLeft");
    moveStick.classList.remove("charging", "dashing");
  };

  const startDashCharge = () => {
    if (dashTimer || autoDashing) return;
    moveStick.classList.add("charging");
    dashTimer = window.setTimeout(() => {
      dashTimer = 0;
      if (movePointerId === null || movementKeys.size === 0) return;
      autoDashing = true;
      moveStick.classList.remove("charging");
      moveStick.classList.add("dashing");
      pressKey("ShiftLeft");
      navigator.vibrate?.(12);
    }, 2000);
  };

  const dispatchLook = (movementX, movementY) => {
    const event = new MouseEvent("mousemove", { bubbles: true, cancelable: true });
    try {
      Object.defineProperties(event, {
        movementX: { value: movementX },
        movementY: { value: movementY },
      });
    } catch {
      Object.defineProperty(event, "movementX", { value: movementX });
      Object.defineProperty(event, "movementY", { value: movementY });
    }
    document.dispatchEvent(event);
  };

  const controlsAreActive = () => {
    if (innerWidth <= innerHeight) return false;
    if (!touchRoot.classList.contains("visible")) return false;
    if (document.body.classList.contains("landscape-required")) return false;
    if (document.querySelector(".touch-sensitivity-panel.open")) return false;
    return true;
  };

  const isInteractiveTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest([
      "button",
      "input",
      ".touch-button",
      ".touch-pause",
      ".touch-sensitivity-panel",
      ".touch-sensitivity-button",
      ".touch-landscape-gate",
      ".overlay.active",
    ].join(",")));
  };

  const positionStick = (stick, clientX, clientY) => {
    const size = stick.getBoundingClientRect().width || 132;
    stick.style.left = `${clientX}px`;
    stick.style.top = `${clientY}px`;
    stick.classList.add("active");
    return { x: clientX, y: clientY, radius: size * 0.34 };
  };

  const capturePointer = (target, pointerId) => {
    try {
      target?.setPointerCapture?.(pointerId);
    } catch {
      // Some mobile browsers reject capture from a document-level handler.
    }
  };

  const setKnobOffset = (knob, dx, dy) => {
    knob.style.transform = `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0)`;
  };

  const updateMovement = (clientX, clientY) => {
    let dx = clientX - moveOriginX;
    let dy = clientY - moveOriginY;
    const distance = Math.hypot(dx, dy);

    if (distance > moveRadius) {
      const scale = moveRadius / distance;
      dx *= scale;
      dy *= scale;
    }

    setKnobOffset(moveKnob, dx, dy);

    const normalizedX = dx / moveRadius;
    const normalizedY = dy / moveRadius;
    const magnitude = Math.min(1, Math.hypot(normalizedX, normalizedY));
    const deadZone = 0.17;

    setMovementKey("KeyA", normalizedX < -deadZone);
    setMovementKey("KeyD", normalizedX > deadZone);
    setMovementKey("KeyW", normalizedY < -deadZone);
    setMovementKey("KeyS", normalizedY > deadZone);

    if (magnitude > 0.24 && movementKeys.size > 0) startDashCharge();
    else stopDashCharge();
  };

  const updateLook = (clientX, clientY) => {
    let dx = clientX - lookOriginX;
    let dy = clientY - lookOriginY;
    const distance = Math.hypot(dx, dy);

    if (distance > lookRadius) {
      const scale = lookRadius / distance;
      dx *= scale;
      dy *= scale;
    }

    setKnobOffset(lookKnob, dx, dy);

    const rawX = dx / lookRadius;
    const rawY = dy / lookRadius;
    const magnitude = Math.min(1, Math.hypot(rawX, rawY));
    const deadZone = 0.12;
    const strength = magnitude <= deadZone ? 0 : (magnitude - deadZone) / (1 - deadZone);

    if (strength === 0 || magnitude === 0) {
      lookX = 0;
      lookY = 0;
    } else {
      lookX = (rawX / magnitude) * strength;
      lookY = (rawY / magnitude) * strength;
    }
  };

  const animateLook = (now) => {
    if (lookPointerId === null) {
      lookAnimationId = 0;
      return;
    }

    const frameScale = Math.min(1.8, Math.max(0.45, (now - lastLookFrame) / 16.667));
    lastLookFrame = now;

    // Existing mobile sensitivity, SENS, and the 2x tuning layer apply after this.
    dispatchLook(lookX * 5.1 * frameScale, lookY * 4.4 * frameScale);
    lookAnimationId = requestAnimationFrame(animateLook);
  };

  const resetMovement = () => {
    movePointerId = null;
    releaseMovement();
    stopDashCharge();
    setKnobOffset(moveKnob, 0, 0);
    moveStick.classList.remove("active");
  };

  const resetLook = () => {
    lookPointerId = null;
    lookX = 0;
    lookY = 0;
    setKnobOffset(lookKnob, 0, 0);
    lookStick.classList.remove("active");
    if (lookAnimationId) cancelAnimationFrame(lookAnimationId);
    lookAnimationId = 0;
  };

  const resetAll = () => {
    resetMovement();
    resetLook();
  };

  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    if (!controlsAreActive() || isInteractiveTarget(event.target)) return;

    const leftHalf = event.clientX < innerWidth / 2;

    if (leftHalf && movePointerId === null) {
      event.preventDefault();
      movePointerId = event.pointerId;
      const position = positionStick(moveStick, event.clientX, event.clientY);
      moveOriginX = position.x;
      moveOriginY = position.y;
      moveRadius = position.radius;
      updateMovement(event.clientX, event.clientY);
      capturePointer(event.target, event.pointerId);
      return;
    }

    if (!leftHalf && lookPointerId === null) {
      event.preventDefault();
      lookPointerId = event.pointerId;
      const position = positionStick(lookStick, event.clientX, event.clientY);
      lookOriginX = position.x;
      lookOriginY = position.y;
      lookRadius = position.radius;
      updateLook(event.clientX, event.clientY);
      lastLookFrame = performance.now();
      if (!lookAnimationId) lookAnimationId = requestAnimationFrame(animateLook);
      capturePointer(event.target, event.pointerId);
    }
  }, { capture: true, passive: false });

  document.addEventListener("pointermove", (event) => {
    if (event.pointerId === movePointerId) {
      event.preventDefault();
      updateMovement(event.clientX, event.clientY);
    } else if (event.pointerId === lookPointerId) {
      event.preventDefault();
      updateLook(event.clientX, event.clientY);
    }
  }, { capture: true, passive: false });

  const finishPointer = (event) => {
    if (event.pointerId === movePointerId) resetMovement();
    if (event.pointerId === lookPointerId) resetLook();
  };

  document.addEventListener("pointerup", finishPointer, true);
  document.addEventListener("pointercancel", finishPointer, true);

  const visibilityObserver = new MutationObserver(() => {
    if (!touchRoot.classList.contains("visible")) resetAll();
  });
  visibilityObserver.observe(touchRoot, { attributes: true, attributeFilter: ["class"] });

  addEventListener("blur", resetAll);
  addEventListener("orientationchange", resetAll);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetAll();
  });
})();

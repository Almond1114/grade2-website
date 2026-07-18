(() => {
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable) return;

  document.documentElement.classList.add("touch-capable");
  document.body.classList.add("touch-device");

  let fakePointerLockElement = null;
  const nativeRequestPointerLock = HTMLElement.prototype.requestPointerLock;
  const nativeExitPointerLock = document.exitPointerLock?.bind(document);

  const dispatchPointerLockChange = () => {
    queueMicrotask(() => document.dispatchEvent(new Event("pointerlockchange")));
  };

  const installFakePointerLock = () => {
    try {
      Object.defineProperty(document, "pointerLockElement", {
        configurable: true,
        get: () => fakePointerLockElement,
      });
    } catch {
      try {
        Object.defineProperty(Document.prototype, "pointerLockElement", {
          configurable: true,
          get: () => fakePointerLockElement,
        });
      } catch {
        return false;
      }
    }

    HTMLElement.prototype.requestPointerLock = function requestTouchPointerLock() {
      fakePointerLockElement = this;
      dispatchPointerLockChange();
      return Promise.resolve();
    };

    document.exitPointerLock = () => {
      fakePointerLockElement = null;
      dispatchPointerLockChange();
      return Promise.resolve();
    };

    return true;
  };

  const fakePointerLockInstalled = installFakePointerLock();
  if (!fakePointerLockInstalled) {
    if (nativeRequestPointerLock) HTMLElement.prototype.requestPointerLock = nativeRequestPointerLock;
    if (nativeExitPointerLock) document.exitPointerLock = nativeExitPointerLock;
  }

  const root = document.createElement("div");
  root.id = "touch-controls";
  root.className = "touch-controls";
  root.setAttribute("aria-label", "スマホ用ゲーム操作");
  root.innerHTML = `
    <div class="touch-look-zone" aria-label="視点操作エリア"></div>

    <div class="touch-left-cluster">
      <div class="touch-joystick" aria-label="移動スティック">
        <div class="touch-joystick-ring"></div>
        <div class="touch-joystick-knob"></div>
      </div>
      <button class="touch-button touch-slide" type="button" data-key="ControlLeft" aria-label="スライド">SLIDE</button>
    </div>

    <div class="touch-right-cluster">
      <button class="touch-button touch-aim" type="button" aria-label="集中照準">AIM</button>
      <button class="touch-button touch-reload" type="button" data-key="KeyR" aria-label="リロード">R</button>
      <button class="touch-button touch-weapon" type="button" aria-label="武器切替">SWAP</button>
      <button class="touch-button touch-overdrive" type="button" data-key="KeyF" aria-label="オーバードライブ">OD</button>
      <button class="touch-button touch-dash" type="button" data-key="KeyQ" aria-label="瞬間ダッシュ">DASH</button>
      <button class="touch-button touch-jump" type="button" data-key="Space" aria-label="ジャンプ">JUMP</button>
      <button class="touch-button touch-fire" type="button" aria-label="射撃"><span>FIRE</span></button>
    </div>

    <button class="touch-pause" type="button" aria-label="一時停止">Ⅱ</button>
  `;
  document.body.appendChild(root);

  const joystick = root.querySelector(".touch-joystick");
  const knob = root.querySelector(".touch-joystick-knob");
  const lookZone = root.querySelector(".touch-look-zone");
  const fireButton = root.querySelector(".touch-fire");
  const aimButton = root.querySelector(".touch-aim");
  const weaponButton = root.querySelector(".touch-weapon");
  const pauseButton = root.querySelector(".touch-pause");

  const activeKeys = new Set();
  const movementKeys = new Set();
  let joystickPointerId = null;
  let lookPointerId = null;
  let firePointerId = null;
  let lastLookX = 0;
  let lastLookY = 0;
  let aimActive = false;

  const vibrate = (duration = 8) => {
    if (navigator.vibrate) navigator.vibrate(duration);
  };

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

  const tapKey = (code, holdMs = 45) => {
    pressKey(code);
    window.setTimeout(() => releaseKey(code), holdMs);
  };

  const releaseMovement = () => {
    for (const code of movementKeys) releaseKey(code);
    movementKeys.clear();
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

  const updateJoystick = (clientX, clientY) => {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.34;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > maxRadius) {
      const scale = maxRadius / distance;
      dx *= scale;
      dy *= scale;
    }

    knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    const normalizedX = dx / maxRadius;
    const normalizedY = dy / maxRadius;
    const deadZone = 0.2;

    setMovementKey("KeyA", normalizedX < -deadZone);
    setMovementKey("KeyD", normalizedX > deadZone);
    setMovementKey("KeyW", normalizedY < -deadZone);
    setMovementKey("KeyS", normalizedY > deadZone);

    const sprinting = normalizedY < -0.72 && Math.hypot(normalizedX, normalizedY) > 0.78;
    if (sprinting) pressKey("ShiftLeft");
    else releaseKey("ShiftLeft");
  };

  const resetJoystick = () => {
    joystickPointerId = null;
    knob.style.transform = "translate3d(0, 0, 0)";
    releaseMovement();
    releaseKey("ShiftLeft");
  };

  joystick.addEventListener("pointerdown", (event) => {
    if (joystickPointerId !== null) return;
    event.preventDefault();
    joystickPointerId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    joystick.classList.add("active");
    updateJoystick(event.clientX, event.clientY);
  });

  joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== joystickPointerId) return;
    event.preventDefault();
    updateJoystick(event.clientX, event.clientY);
  });

  const finishJoystick = (event) => {
    if (event.pointerId !== joystickPointerId) return;
    joystick.classList.remove("active");
    resetJoystick();
  };
  joystick.addEventListener("pointerup", finishJoystick);
  joystick.addEventListener("pointercancel", finishJoystick);
  joystick.addEventListener("lostpointercapture", () => {
    joystick.classList.remove("active");
    resetJoystick();
  });

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

  lookZone.addEventListener("pointerdown", (event) => {
    if (lookPointerId !== null) return;
    event.preventDefault();
    lookPointerId = event.pointerId;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    lookZone.setPointerCapture(event.pointerId);
    lookZone.classList.add("active");
  });

  lookZone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== lookPointerId) return;
    event.preventDefault();
    const sensitivity = matchMedia("(orientation: portrait)").matches ? 1.18 : 1.05;
    const dx = (event.clientX - lastLookX) * sensitivity;
    const dy = (event.clientY - lastLookY) * sensitivity;
    lastLookX = event.clientX;
    lastLookY = event.clientY;
    dispatchLook(dx, dy);
  });

  const finishLook = (event) => {
    if (event.pointerId !== lookPointerId) return;
    lookPointerId = null;
    lookZone.classList.remove("active");
  };
  lookZone.addEventListener("pointerup", finishLook);
  lookZone.addEventListener("pointercancel", finishLook);
  lookZone.addEventListener("lostpointercapture", () => {
    lookPointerId = null;
    lookZone.classList.remove("active");
  });

  const dispatchMouseButton = (type, button) => {
    window.dispatchEvent(new MouseEvent(type, {
      button,
      buttons: type === "mousedown" ? (button === 0 ? 1 : 2) : 0,
      bubbles: true,
      cancelable: true,
    }));
  };

  fireButton.addEventListener("pointerdown", (event) => {
    if (firePointerId !== null) return;
    event.preventDefault();
    event.stopPropagation();
    firePointerId = event.pointerId;
    fireButton.setPointerCapture(event.pointerId);
    fireButton.classList.add("active");
    dispatchMouseButton("mousedown", 0);
    vibrate(6);
  });

  const finishFire = (event) => {
    if (event.pointerId !== firePointerId) return;
    firePointerId = null;
    fireButton.classList.remove("active");
    dispatchMouseButton("mouseup", 0);
  };
  fireButton.addEventListener("pointerup", finishFire);
  fireButton.addEventListener("pointercancel", finishFire);
  fireButton.addEventListener("lostpointercapture", () => {
    if (firePointerId === null) return;
    firePointerId = null;
    fireButton.classList.remove("active");
    dispatchMouseButton("mouseup", 0);
  });

  aimButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    aimActive = !aimActive;
    aimButton.classList.toggle("active", aimActive);
    dispatchMouseButton(aimActive ? "mousedown" : "mouseup", 2);
    vibrate(5);
  });

  weaponButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    }));
    weaponButton.classList.add("active");
    window.setTimeout(() => weaponButton.classList.remove("active"), 100);
    vibrate(7);
  });

  root.querySelectorAll("[data-key]").forEach((button) => {
    const code = button.dataset.key;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.add("active");
      tapKey(code);
      vibrate(code === "KeyQ" ? 12 : 7);
    });
    const clearActive = () => button.classList.remove("active");
    button.addEventListener("pointerup", clearActive);
    button.addEventListener("pointercancel", clearActive);
    button.addEventListener("pointerleave", clearActive);
  });

  pauseButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.exitPointerLock?.();
  });

  const updateVisibility = () => {
    const started = !document.querySelector("#start-screen")?.classList.contains("active");
    const paused = document.querySelector("#pause-screen")?.classList.contains("active");
    const upgrading = document.querySelector("#upgrade-screen")?.classList.contains("active");
    const gameOver = document.querySelector("#game-over-screen")?.classList.contains("active");
    root.classList.toggle("visible", started && !paused && !upgrading && !gameOver);
    if (!root.classList.contains("visible")) {
      resetJoystick();
      if (firePointerId !== null) dispatchMouseButton("mouseup", 0);
      firePointerId = null;
      fireButton.classList.remove("active");
    }
  };

  const observer = new MutationObserver(updateVisibility);
  ["#start-screen", "#pause-screen", "#upgrade-screen", "#game-over-screen"].forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) observer.observe(element, { attributes: true, attributeFilter: ["class"] });
  });

  const keepFakeLockAlive = () => {
    if (!fakePointerLockInstalled || !root.classList.contains("visible")) return;
    const canvas = document.querySelector("#game canvas");
    if (canvas && document.pointerLockElement !== canvas) {
      fakePointerLockElement = canvas;
      dispatchPointerLockChange();
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resetJoystick();
      dispatchMouseButton("mouseup", 0);
    } else {
      keepFakeLockAlive();
    }
  });

  window.addEventListener("orientationchange", () => {
    resetJoystick();
    window.setTimeout(keepFakeLockAlive, 250);
  });

  window.addEventListener("blur", () => {
    resetJoystick();
    dispatchMouseButton("mouseup", 0);
  });

  setInterval(keepFakeLockAlive, 800);
  updateVisibility();
})();

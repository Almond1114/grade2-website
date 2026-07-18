(() => {
  if (window.__neonRushSimpleControls) return;
  window.__neonRushSimpleControls = true;

  // Prevent the older floating look-stick layer from installing.
  window.__neonRushDualHalfControls = true;

  const SMG_NAME = "PULSE SMG";
  const nativeMap = Array.prototype.map;
  let smgInjected = false;

  Array.prototype.map = function patchedWeaponMap(callback, thisArg) {
    if (!smgInjected
      && this.length === 3
      && this.some((item) => item?.name === "VOLT RIFLE")
      && this.some((item) => item?.name === "NOVA SHOTGUN")
      && this.some((item) => item?.name === "ARC RAIL")) {
      this.push({
        name: SMG_NAME,
        mode: "AUTO",
        damage: 13,
        pellets: 1,
        fireRate: 17.5,
        magazine: 45,
        reload: 1.05,
        spread: 0.016,
        kick: 0.009,
        range: 72,
        automatic: true,
        color: 0x7dff9c,
      });
      smgInjected = true;
      queueMicrotask(() => {
        if (Array.prototype.map === patchedWeaponMap) Array.prototype.map = nativeMap;
      });
    }
    return nativeMap.call(this, callback, thisArg);
  };

  setTimeout(() => {
    if (Array.prototype.map !== nativeMap) Array.prototype.map = nativeMap;
  }, 8000);

  const weaponName = document.querySelector("#weapon-name");
  const ammo = document.querySelector("#ammo");
  let smgSoundTimer = 0;
  let smgAudioContext = null;

  const smgCanSound = () => weaponName?.textContent === SMG_NAME && Number(ammo?.textContent || 0) > 0;
  const stopSmgSound = () => {
    if (smgSoundTimer) clearInterval(smgSoundTimer);
    smgSoundTimer = 0;
  };
  const playSmgSound = () => {
    if (!smgCanSound()) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    smgAudioContext ||= new AudioContextClass();
    smgAudioContext.resume?.();
    const now = smgAudioContext.currentTime;
    const oscillator = smgAudioContext.createOscillator();
    const gain = smgAudioContext.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(260, now);
    oscillator.frequency.exponentialRampToValueAtTime(95, now + 0.035);
    gain.gain.setValueAtTime(0.022, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    oscillator.connect(gain).connect(smgAudioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.045);
  };

  addEventListener("mousedown", (event) => {
    if (event.button !== 0 || !smgCanSound()) return;
    stopSmgSound();
    playSmgSound();
    smgSoundTimer = setInterval(playSmgSound, 57);
  });
  addEventListener("mouseup", (event) => {
    if (event.button === 0) stopSmgSound();
  });
  addEventListener("blur", stopSmgSound);

  addEventListener("keydown", (event) => {
    if (event.code !== "Digit4" || event.repeat) return;
    let attempts = 0;
    const cycle = () => {
      if (weaponName?.textContent === SMG_NAME || attempts >= 4) return;
      attempts += 1;
      dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }));
      setTimeout(cycle, 20);
    };
    setTimeout(cycle, 0);
  });

  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable) return;

  const root = document.querySelector("#touch-controls");
  if (!root) return;
  document.body.classList.add("simple-touch-controls");

  const moveLayer = document.createElement("div");
  moveLayer.className = "simple-move-layer";
  moveLayer.innerHTML = `
    <div class="simple-move-stick">
      <div class="simple-move-ring"></div>
      <div class="simple-move-knob"></div>
    </div>
  `;
  document.body.appendChild(moveLayer);

  const moveStick = moveLayer.querySelector(".simple-move-stick");
  const moveKnob = moveLayer.querySelector(".simple-move-knob");
  const fireButton = root.querySelector(".touch-fire");
  const gyroButton = document.createElement("button");
  gyroButton.type = "button";
  gyroButton.className = "touch-gyro-button";
  gyroButton.textContent = "GYRO";
  gyroButton.setAttribute("aria-label", "ジャイロ照準を切り替え");
  root.appendChild(gyroButton);

  const activeKeys = new Set();
  const movementKeys = new Set();
  let moveId = null;
  let lookId = null;
  let moveX = 0;
  let moveY = 0;
  let moveRadius = 48;
  let lookX = 0;
  let lookY = 0;
  let dashTimer = 0;
  let autoAimId = null;
  let gyroEnabled = false;
  let gyroInstalled = false;
  let lastBeta = null;
  let lastGamma = null;

  const DRAG_SCALE = 0.58;
  const GYRO_SCALE = 0.32;
  const GYRO_KEY = "neonRushGyroEnabled";

  const keyEvent = (type, code) => new KeyboardEvent(type, {
    code,
    key: code,
    bubbles: true,
    cancelable: true,
  });
  const press = (code) => {
    if (activeKeys.has(code)) return;
    activeKeys.add(code);
    dispatchEvent(keyEvent("keydown", code));
  };
  const release = (code) => {
    if (!activeKeys.has(code)) return;
    activeKeys.delete(code);
    dispatchEvent(keyEvent("keyup", code));
  };
  const setMoveKey = (code, enabled) => {
    if (enabled) {
      movementKeys.add(code);
      press(code);
    } else {
      movementKeys.delete(code);
      release(code);
    }
  };
  const clearMoveKeys = () => {
    for (const code of movementKeys) release(code);
    movementKeys.clear();
  };
  const stopDash = () => {
    if (dashTimer) clearTimeout(dashTimer);
    dashTimer = 0;
    release("ShiftLeft");
    moveStick.classList.remove("charging", "dashing");
  };
  const chargeDash = () => {
    if (dashTimer || activeKeys.has("ShiftLeft")) return;
    moveStick.classList.add("charging");
    dashTimer = setTimeout(() => {
      dashTimer = 0;
      if (moveId === null || movementKeys.size === 0) return;
      moveStick.classList.remove("charging");
      moveStick.classList.add("dashing");
      press("ShiftLeft");
      navigator.vibrate?.(12);
    }, 2000);
  };

  const sendLook = (dx, dy) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;
    const event = new MouseEvent("mousemove", { bubbles: true, cancelable: true });
    try {
      Object.defineProperties(event, {
        movementX: { value: dx },
        movementY: { value: dy },
      });
    } catch {
      Object.defineProperty(event, "movementX", { value: dx });
      Object.defineProperty(event, "movementY", { value: dy });
    }
    document.dispatchEvent(event);
  };

  const mouseButton = (type, button) => {
    dispatchEvent(new MouseEvent(type, {
      button,
      buttons: type === "mousedown" ? (button === 0 ? 1 : 2) : 0,
      bubbles: true,
      cancelable: true,
    }));
  };

  const controlsActive = () => innerWidth > innerHeight
    && root.classList.contains("visible")
    && !document.body.classList.contains("landscape-required")
    && !document.querySelector(".touch-sensitivity-panel.open");

  const interactive = (target) => target instanceof Element && Boolean(target.closest([
    "button", "input", ".touch-button", ".touch-pause", ".touch-sensitivity-panel",
    ".touch-sensitivity-button", ".touch-gyro-button", ".touch-landscape-gate", ".overlay.active",
  ].join(",")));

  const updateMove = (clientX, clientY) => {
    let dx = clientX - moveX;
    let dy = clientY - moveY;
    const distance = Math.hypot(dx, dy);
    if (distance > moveRadius) {
      const scale = moveRadius / distance;
      dx *= scale;
      dy *= scale;
    }
    moveKnob.style.transform = `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0)`;
    const nx = dx / moveRadius;
    const ny = dy / moveRadius;
    const dead = 0.17;
    setMoveKey("KeyA", nx < -dead);
    setMoveKey("KeyD", nx > dead);
    setMoveKey("KeyW", ny < -dead);
    setMoveKey("KeyS", ny > dead);
    if (Math.hypot(nx, ny) > 0.24 && movementKeys.size) chargeDash();
    else stopDash();
  };

  const resetMove = () => {
    moveId = null;
    clearMoveKeys();
    stopDash();
    moveKnob.style.transform = "translate3d(-50%, -50%, 0)";
    moveStick.classList.remove("active");
  };
  const resetLook = () => {
    lookId = null;
    lookX = 0;
    lookY = 0;
  };

  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || !controlsActive() || interactive(event.target)) return;
    if (event.clientX < innerWidth / 2 && moveId === null) {
      event.preventDefault();
      moveId = event.pointerId;
      moveX = event.clientX;
      moveY = event.clientY;
      moveStick.style.left = `${moveX}px`;
      moveStick.style.top = `${moveY}px`;
      moveStick.classList.add("active");
      moveRadius = (moveStick.getBoundingClientRect().width || 132) * 0.34;
      updateMove(event.clientX, event.clientY);
      event.target.setPointerCapture?.(event.pointerId);
    } else if (event.clientX >= innerWidth / 2 && lookId === null) {
      event.preventDefault();
      lookId = event.pointerId;
      lookX = event.clientX;
      lookY = event.clientY;
      event.target.setPointerCapture?.(event.pointerId);
    }
  }, { capture: true, passive: false });

  document.addEventListener("pointermove", (event) => {
    if (event.pointerId === moveId) {
      event.preventDefault();
      updateMove(event.clientX, event.clientY);
    } else if (event.pointerId === lookId) {
      event.preventDefault();
      const dx = (event.clientX - lookX) * DRAG_SCALE;
      const dy = (event.clientY - lookY) * DRAG_SCALE;
      lookX = event.clientX;
      lookY = event.clientY;
      sendLook(dx, dy);
    }
  }, { capture: true, passive: false });

  const finish = (event) => {
    if (event.pointerId === moveId) resetMove();
    if (event.pointerId === lookId) resetLook();
  };
  document.addEventListener("pointerup", finish, true);
  document.addEventListener("pointercancel", finish, true);

  if (fireButton) {
    const startAim = (event) => {
      if (autoAimId !== null) return;
      autoAimId = event.pointerId;
      mouseButton("mousedown", 2);
    };
    const stopAim = (event) => {
      if (event && event.pointerId !== autoAimId) return;
      if (autoAimId === null) return;
      autoAimId = null;
      mouseButton("mouseup", 2);
    };
    fireButton.addEventListener("pointerdown", startAim);
    fireButton.addEventListener("pointerup", stopAim);
    fireButton.addEventListener("pointercancel", stopAim);
    fireButton.addEventListener("lostpointercapture", () => stopAim(null));
  }

  const resetGyro = () => {
    lastBeta = null;
    lastGamma = null;
  };
  const wrap = (value) => value > 180 ? value - 360 : value < -180 ? value + 360 : value;
  const onOrientation = (event) => {
    if (!gyroEnabled || !controlsActive()) {
      resetGyro();
      return;
    }
    const beta = Number(event.beta);
    const gamma = Number(event.gamma);
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    if (lastBeta === null || lastGamma === null) {
      lastBeta = beta;
      lastGamma = gamma;
      return;
    }
    const db = wrap(beta - lastBeta);
    const dg = wrap(gamma - lastGamma);
    lastBeta = beta;
    lastGamma = gamma;
    if (Math.abs(db) > 12 || Math.abs(dg) > 12) return;
    const angle = Number(screen.orientation?.angle ?? window.orientation ?? 0);
    let dx = angle === 90 ? -db : angle === 270 || angle === -90 ? db : dg;
    let dy = angle === 90 ? dg : angle === 270 || angle === -90 ? -dg : db;
    if (Math.abs(dx) < 0.035) dx = 0;
    if (Math.abs(dy) < 0.035) dy = 0;
    sendLook(dx * GYRO_SCALE, dy * GYRO_SCALE);
  };
  const setGyro = (enabled) => {
    gyroEnabled = Boolean(enabled);
    if (gyroEnabled && !gyroInstalled) {
      addEventListener("deviceorientation", onOrientation, true);
      gyroInstalled = true;
    }
    localStorage.setItem(GYRO_KEY, gyroEnabled ? "1" : "0");
    gyroButton.classList.toggle("active", gyroEnabled);
    gyroButton.textContent = gyroEnabled ? "GYRO ON" : "GYRO";
    gyroButton.setAttribute("aria-pressed", String(gyroEnabled));
    resetGyro();
  };
  const toggleGyro = async () => {
    if (!("DeviceOrientationEvent" in window)) return;
    if (gyroEnabled) {
      setGyro(false);
      return;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") {
          gyroButton.textContent = "DENIED";
          return;
        }
      }
      setGyro(true);
      navigator.vibrate?.(8);
    } catch {
      gyroButton.textContent = "DENIED";
    }
  };
  gyroButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleGyro();
  });

  const resetAll = () => {
    resetMove();
    resetLook();
    resetGyro();
    if (autoAimId !== null) {
      autoAimId = null;
      mouseButton("mouseup", 2);
    }
  };

  new MutationObserver(() => {
    if (!root.classList.contains("visible")) resetAll();
  }).observe(root, { attributes: true, attributeFilter: ["class"] });

  if (!("DeviceOrientationEvent" in window)) gyroButton.hidden = true;
  else if (localStorage.getItem(GYRO_KEY) === "1" && typeof DeviceOrientationEvent.requestPermission !== "function") setGyro(true);

  addEventListener("blur", resetAll);
  addEventListener("orientationchange", resetAll);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetAll();
  });
})();

(() => {
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable || window.__neonRushGyroModeSelector) return;
  window.__neonRushGyroModeSelector = true;

  const root = document.querySelector("#touch-controls");
  const startScreen = document.querySelector("#start-screen");
  const heroCard = startScreen?.querySelector(".hero-card");
  const startButton = document.querySelector("#start-button");
  if (!root || !heroCard || !startButton) return;

  document.body.classList.add("gyro-mode-selection-enabled");
  root.querySelector(".touch-gyro-button")?.remove();

  const state = window.__neonRushGyroSelection || {
    mode: "unselected",
    permission: "unknown",
    sensorReady: false,
  };
  state.fullYaw = 0;
  state.fullPitch = 0;
  window.__neonRushGyroSelection = state;

  const supportsGyro = "DeviceOrientationEvent" in window;
  const savedPreference = localStorage.getItem("neonRushGyroModePreference") || "touch";
  const DEG_TO_RAD = Math.PI / 180;
  const TWO_PI = Math.PI * 2;
  const POINTER_ROTATION_PER_PIXEL = 0.002 * 0.9;
  const BASE_TOUCH_MULTIPLIER = 1.55 * 2;
  const FULL_MAX_PITCH = Math.PI / 2 - 0.015;

  let orientationInstalled = false;
  let lastBeta = null;
  let lastGamma = null;
  let filteredX = 0;
  let filteredY = 0;
  let firstSensorTimer = 0;

  let fullOriginBasis = null;
  let fullAppliedYaw = 0;
  let fullAppliedPitch = 0;
  let fullFilteredYaw = 0;
  let fullFilteredPitch = 0;
  let fullStableYaw = 0;
  let lastFullTapTime = 0;
  let lastFullTapX = 0;
  let lastFullTapY = 0;

  const selector = document.createElement("section");
  selector.className = "gyro-mode-selector";
  selector.setAttribute("aria-label", "操作モード選択");
  selector.innerHTML = `
    <div class="gyro-mode-heading">
      <div>
        <span>CONTROL SETUP</span>
        <strong>操作モードを選択</strong>
      </div>
      <small>ゲーム開始前に設定します</small>
    </div>
    <div class="gyro-mode-options">
      <button type="button" data-gyro-mode="touch">
        <b>TOUCH</b>
        <strong>タッチのみ</strong>
        <span>右半分のドラッグだけで視点操作</span>
      </button>
      <button type="button" data-gyro-mode="fine" ${supportsGyro ? "" : "disabled"}>
        <b>FINE</b>
        <strong>微調整ジャイロ</strong>
        <span>ドラッグ＋小さな傾きで精密照準</span>
      </button>
      <button type="button" data-gyro-mode="full" ${supportsGyro ? "" : "disabled"}>
        <b>VR FULL</b>
        <strong>フルジャイロ</strong>
        <span>端末を向けた方向へ上下左右が追従</span>
      </button>
    </div>
    <div class="gyro-mode-status" role="status" aria-live="polite">
      <i></i><span>操作モードを1つ選んでください。</span>
    </div>
  `;
  heroCard.insertBefore(selector, startButton);

  const modeButtons = [...selector.querySelectorAll("[data-gyro-mode]")];
  const status = selector.querySelector(".gyro-mode-status");
  const statusText = status.querySelector("span");
  const savedButton = selector.querySelector(`[data-gyro-mode="${savedPreference}"]`);
  savedButton?.classList.add("previous");

  const originalStartText = startButton.textContent;
  startButton.disabled = true;
  startButton.textContent = "操作モードを選択";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

  const setStatus = (kind, text) => {
    status.dataset.kind = kind;
    statusText.textContent = text;
  };

  const updateButtons = () => {
    modeButtons.forEach((button) => {
      button.classList.toggle("selected", button.dataset.gyroMode === state.mode);
      button.setAttribute("aria-pressed", String(button.dataset.gyroMode === state.mode));
    });
  };

  const updateStartAvailability = () => {
    const ready = state.mode === "touch" || ((state.mode === "fine" || state.mode === "full") && state.sensorReady);
    startButton.disabled = !ready;
    startButton.textContent = ready ? originalStartText : (state.mode === "touch" ? originalStartText : "端末を少し動かしてください");
  };

  const resetSensorOrigin = () => {
    lastBeta = null;
    lastGamma = null;
    filteredX = 0;
    filteredY = 0;
    fullOriginBasis = null;
    fullAppliedYaw = 0;
    fullAppliedPitch = 0;
    fullFilteredYaw = 0;
    fullFilteredPitch = 0;
    fullStableYaw = 0;
    state.fullYaw = 0;
    state.fullPitch = 0;
  };
  state.recenter = resetSensorOrigin;

  const sendLook = (dx, dy) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return;
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

  const controlsAreActive = () => innerWidth > innerHeight
    && root.classList.contains("visible")
    && !document.body.classList.contains("landscape-required");

  const wrapDegrees = (value) => {
    if (value > 180) return value - 360;
    if (value < -180) return value + 360;
    return value;
  };

  const wrapRadians = (value) => {
    while (value > Math.PI) value -= TWO_PI;
    while (value < -Math.PI) value += TWO_PI;
    return value;
  };

  const unwrapNear = (value, reference) => value + Math.round((reference - value) / TWO_PI) * TWO_PI;

  const quatMultiply = (a, b) => ({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });

  const quatConjugate = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

  const quatNormalize = (q) => {
    const length = Math.hypot(q.x, q.y, q.z, q.w) || 1;
    return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
  };

  const quatFromAxisAngle = (x, y, z, angle) => {
    const half = angle / 2;
    const sine = Math.sin(half);
    return { x: x * sine, y: y * sine, z: z * sine, w: Math.cos(half) };
  };

  const quatFromEulerYXZ = (x, y, z) => {
    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(z / 2);
    return {
      x: s1 * c2 * c3 + c1 * s2 * s3,
      y: c1 * s2 * c3 - s1 * c2 * s3,
      z: c1 * c2 * s3 - s1 * s2 * c3,
      w: c1 * c2 * c3 + s1 * s2 * s3,
    };
  };

  const deviceQuaternion = (alpha, beta, gamma) => {
    const screenAngle = Number(screen.orientation?.angle ?? window.orientation ?? 0) * DEG_TO_RAD;
    let quaternion = quatFromEulerYXZ(beta * DEG_TO_RAD, alpha * DEG_TO_RAD, -gamma * DEG_TO_RAD);
    quaternion = quatMultiply(quaternion, quatFromAxisAngle(1, 0, 0, -Math.PI / 2));
    quaternion = quatMultiply(quaternion, quatFromAxisAngle(0, 0, 1, -screenAngle));
    return quatNormalize(quaternion);
  };

  const rotateVector = (q, vector) => {
    const rotated = quatMultiply(quatMultiply(q, { ...vector, w: 0 }), quatConjugate(q));
    return { x: rotated.x, y: rotated.y, z: rotated.z };
  };

  const fullPixelsPerRadian = () => {
    const selectedSensitivity = clamp(Number(window.neonRushTouchSensitivityMultiplier) || 1, 0.5, 3);
    const totalMultiplier = BASE_TOUCH_MULTIPLIER * selectedSensitivity;
    return 1 / (POINTER_ROTATION_PER_PIXEL * totalMultiplier);
  };

  const setFullOrigin = (quaternion) => {
    fullOriginBasis = {
      right: rotateVector(quaternion, { x: 1, y: 0, z: 0 }),
      up: rotateVector(quaternion, { x: 0, y: 1, z: 0 }),
      forward: rotateVector(quaternion, { x: 0, y: 0, z: -1 }),
    };
    fullAppliedYaw = 0;
    fullAppliedPitch = 0;
    fullFilteredYaw = 0;
    fullFilteredPitch = 0;
    fullStableYaw = 0;
    state.fullYaw = 0;
    state.fullPitch = 0;
  };

  const applyFullOrientation = (currentQuaternion) => {
    if (!fullOriginBasis) {
      setFullOrigin(currentQuaternion);
      return;
    }

    const forward = rotateVector(currentQuaternion, { x: 0, y: 0, z: -1 });
    const localX = clamp(dot(forward, fullOriginBasis.right), -1, 1);
    const localY = clamp(dot(forward, fullOriginBasis.up), -1, 1);
    const localZ = clamp(dot(forward, fullOriginBasis.forward), -1, 1);
    const horizontalLength = Math.hypot(localX, localZ);

    let targetYaw = horizontalLength > 0.075 ? Math.atan2(localX, localZ) : fullStableYaw;
    const targetPitch = clamp(Math.atan2(localY, Math.max(0.0001, horizontalLength)), -FULL_MAX_PITCH, FULL_MAX_PITCH);

    targetYaw = unwrapNear(targetYaw, fullFilteredYaw);
    if (horizontalLength > 0.075) fullStableYaw = targetYaw;

    fullFilteredYaw += (targetYaw - fullFilteredYaw) * 0.42;
    fullFilteredPitch += (targetPitch - fullFilteredPitch) * 0.42;
    state.fullYaw = fullFilteredYaw;
    state.fullPitch = fullFilteredPitch;

    if (!controlsAreActive()) return;

    const yawStep = clamp(wrapRadians(fullFilteredYaw - fullAppliedYaw), -0.3, 0.3);
    const pitchStep = clamp(fullFilteredPitch - fullAppliedPitch, -0.24, 0.24);
    const pixelsPerRadian = fullPixelsPerRadian();

    // PointerLock subtracts movementX from yaw and movementY from pitch.
    // Positive local yaw means the phone points right, so send positive X.
    // Positive local pitch means the phone points up, so send negative Y.
    sendLook(yawStep * pixelsPerRadian, -pitchStep * pixelsPerRadian);
    fullAppliedYaw += yawStep;
    fullAppliedPitch += pitchStep;
  };

  const markSensorReady = () => {
    if (state.sensorReady) return;
    state.sensorReady = true;
    clearTimeout(firstSensorTimer);
    setStatus("ready", state.mode === "full"
      ? "VR FULLを確認しました。正面を基準に、端末を向けた方向へ上下左右が追従します。右半分のダブルタップで正面補正できます。"
      : "微調整ジャイロを確認しました。ドラッグと組み合わせて使用できます。");
    updateStartAvailability();
    navigator.vibrate?.(10);
  };

  const updateFineGyro = (beta, gamma) => {
    if (lastBeta === null || lastGamma === null) {
      lastBeta = beta;
      lastGamma = gamma;
      markSensorReady();
      return;
    }

    const deltaBeta = wrapDegrees(beta - lastBeta);
    const deltaGamma = wrapDegrees(gamma - lastGamma);
    lastBeta = beta;
    lastGamma = gamma;
    if (Math.abs(deltaBeta) > 12 || Math.abs(deltaGamma) > 12) {
      lastBeta = null;
      lastGamma = null;
      return;
    }

    const angle = Number(screen.orientation?.angle ?? window.orientation ?? 0);
    let rawX;
    let rawY;
    if (angle === 90) {
      rawX = -deltaBeta;
      rawY = deltaGamma;
    } else if (angle === 270 || angle === -90) {
      rawX = deltaBeta;
      rawY = -deltaGamma;
    } else {
      rawX = deltaGamma;
      rawY = deltaBeta;
    }

    rawX = Math.abs(rawX) < 0.045 ? 0 : clamp(rawX, -1.8, 1.8);
    rawY = Math.abs(rawY) < 0.045 ? 0 : clamp(rawY, -1.8, 1.8);
    filteredX = filteredX * 0.72 + rawX * 0.28;
    filteredY = filteredY * 0.72 + rawY * 0.28;
    if (controlsAreActive()) sendLook(filteredX * 0.18, filteredY * 0.18);
  };

  const onOrientation = (event) => {
    if (state.mode !== "fine" && state.mode !== "full") {
      resetSensorOrigin();
      return;
    }

    const beta = Number(event.beta);
    const gamma = Number(event.gamma);
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

    if (state.mode === "fine") {
      updateFineGyro(beta, gamma);
      return;
    }

    const eventAlpha = Number(event.alpha);
    const compassHeading = Number(event.webkitCompassHeading);
    const alpha = Number.isFinite(eventAlpha)
      ? eventAlpha
      : (Number.isFinite(compassHeading) ? 360 - compassHeading : 0);

    const currentQuaternion = deviceQuaternion(alpha, beta, gamma);
    if (!fullOriginBasis) {
      setFullOrigin(currentQuaternion);
      markSensorReady();
      return;
    }
    applyFullOrientation(currentQuaternion);
  };

  const installOrientation = () => {
    if (orientationInstalled) return;
    addEventListener("deviceorientation", onOrientation, true);
    orientationInstalled = true;
  };

  const selectTouch = () => {
    state.mode = "touch";
    state.permission = "not-needed";
    state.sensorReady = true;
    localStorage.setItem("neonRushGyroModePreference", "touch");
    clearTimeout(firstSensorTimer);
    resetSensorOrigin();
    updateButtons();
    setStatus("ready", "タッチ操作で開始できます。右半分を動かした距離だけ視点が動きます。");
    updateStartAvailability();
  };

  const selectGyro = async (mode) => {
    state.mode = mode;
    state.sensorReady = false;
    state.permission = "requesting";
    updateButtons();
    updateStartAvailability();
    setStatus("waiting", "モーションセンサーの利用許可を確認しています…");

    if (!supportsGyro) {
      state.mode = "unselected";
      state.permission = "unsupported";
      setStatus("error", "この端末またはブラウザはジャイロ操作に対応していません。");
      updateButtons();
      updateStartAvailability();
      return;
    }

    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") {
          state.mode = "unselected";
          state.permission = "denied";
          setStatus("error", "センサーの許可が拒否されました。もう一度選ぶか、タッチのみを選んでください。");
          updateButtons();
          updateStartAvailability();
          return;
        }
      }

      state.permission = "granted";
      localStorage.setItem("neonRushGyroModePreference", mode);
      installOrientation();
      resetSensorOrigin();
      setStatus("waiting", mode === "full"
        ? "許可されました。端末を正面に構え、上下左右へ少し向けてください。"
        : "許可されました。端末を上下左右へ少し動かしてセンサーを確認してください。");
      firstSensorTimer = window.setTimeout(() => {
        if (!state.sensorReady && (state.mode === "fine" || state.mode === "full")) {
          setStatus("error", "センサー信号を確認できません。Safariのモーションと画面の向きのアクセス設定を確認するか、タッチのみを選んでください。");
        }
      }, 3500);
    } catch {
      state.mode = "unselected";
      state.permission = "error";
      setStatus("error", "センサー許可を開始できませんでした。Safariでページを開き直して再度選んでください。");
      updateButtons();
      updateStartAvailability();
    }
  };

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.gyroMode;
      if (mode === "touch") selectTouch();
      else selectGyro(mode);
    });
  });

  const isInteractiveControl = (target) => target instanceof Element && Boolean(target.closest([
    "button", "input", ".touch-button", ".touch-pause", ".touch-sensitivity-panel",
    ".touch-sensitivity-button", ".touch-landscape-gate", ".overlay.active",
  ].join(",")));

  addEventListener("pointerdown", (event) => {
    if (state.mode !== "full" || event.pointerType === "mouse" || !controlsAreActive()) return;
    if (event.clientX < innerWidth / 2 || isInteractiveControl(event.target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const elapsed = event.timeStamp - lastFullTapTime;
    const nearby = Math.hypot(event.clientX - lastFullTapX, event.clientY - lastFullTapY) < 56;
    if (elapsed > 0 && elapsed < 340 && nearby) {
      resetSensorOrigin();
      lastFullTapTime = 0;
      navigator.vibrate?.([8, 35, 8]);
    } else {
      lastFullTapTime = event.timeStamp;
      lastFullTapX = event.clientX;
      lastFullTapY = event.clientY;
    }
  }, { capture: true, passive: false });

  startButton.addEventListener("click", resetSensorOrigin, true);
  document.querySelector("#resume-button")?.addEventListener("click", resetSensorOrigin, true);
  document.querySelector("#restart-button")?.addEventListener("click", resetSensorOrigin, true);
  addEventListener("orientationchange", () => setTimeout(resetSensorOrigin, 180));
  addEventListener("blur", resetSensorOrigin);

  if (!supportsGyro) {
    setStatus("info", "この端末ではタッチのみ利用できます。");
  } else if (savedPreference === "fine" || savedPreference === "full") {
    setStatus("info", `前回は${savedPreference === "full" ? "VR風フルジャイロ" : "微調整ジャイロ"}でした。今回使うモードを選んでください。`);
  }
})();
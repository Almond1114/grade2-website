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
  window.__neonRushGyroSelection = state;

  const supportsGyro = "DeviceOrientationEvent" in window;
  const savedPreference = localStorage.getItem("neonRushGyroModePreference") || "touch";
  let orientationInstalled = false;
  let lastBeta = null;
  let lastGamma = null;
  let filteredX = 0;
  let filteredY = 0;
  let firstSensorTimer = 0;

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
        <b>FULL</b>
        <strong>フルジャイロ</strong>
        <span>上下左右を傾きで大きく操作</span>
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
  };

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

  const wrapDelta = (value) => {
    if (value > 180) return value - 360;
    if (value < -180) return value + 360;
    return value;
  };

  const markSensorReady = () => {
    if (state.sensorReady) return;
    state.sensorReady = true;
    clearTimeout(firstSensorTimer);
    setStatus("ready", state.mode === "full"
      ? "フルジャイロを確認しました。上下左右に端末を傾けて操作できます。"
      : "微調整ジャイロを確認しました。ドラッグと組み合わせて使用できます。");
    updateStartAvailability();
    navigator.vibrate?.(10);
  };

  const onOrientation = (event) => {
    if (state.mode !== "fine" && state.mode !== "full") {
      resetSensorOrigin();
      return;
    }

    const beta = Number(event.beta);
    const gamma = Number(event.gamma);
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

    markSensorReady();

    if (lastBeta === null || lastGamma === null) {
      lastBeta = beta;
      lastGamma = gamma;
      return;
    }

    const deltaBeta = wrapDelta(beta - lastBeta);
    const deltaGamma = wrapDelta(gamma - lastGamma);
    lastBeta = beta;
    lastGamma = gamma;

    const maxJump = state.mode === "full" ? 20 : 12;
    if (Math.abs(deltaBeta) > maxJump || Math.abs(deltaGamma) > maxJump) {
      resetSensorOrigin();
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

    const fine = state.mode === "fine";
    const deadZone = fine ? 0.045 : 0.012;
    const scale = fine ? 0.18 : 0.62;
    const clamp = fine ? 1.8 : 5.5;
    const smoothing = fine ? 0.72 : 0.48;

    rawX = Math.abs(rawX) < deadZone ? 0 : Math.max(-clamp, Math.min(clamp, rawX));
    rawY = Math.abs(rawY) < deadZone ? 0 : Math.max(-clamp, Math.min(clamp, rawY));
    filteredX = filteredX * smoothing + rawX * (1 - smoothing);
    filteredY = filteredY * smoothing + rawY * (1 - smoothing);

    if (controlsAreActive()) sendLook(filteredX * scale, filteredY * scale);
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
      setStatus("waiting", "許可されました。端末を上下左右へ少し動かしてセンサーを確認してください。");
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

  startButton.addEventListener("click", resetSensorOrigin, true);
  document.querySelector("#resume-button")?.addEventListener("click", resetSensorOrigin, true);
  document.querySelector("#restart-button")?.addEventListener("click", resetSensorOrigin, true);
  addEventListener("orientationchange", () => setTimeout(resetSensorOrigin, 120));
  addEventListener("blur", resetSensorOrigin);

  if (!supportsGyro) {
    setStatus("info", "この端末ではタッチのみ利用できます。");
  } else if (savedPreference === "fine" || savedPreference === "full") {
    setStatus("info", `前回は${savedPreference === "full" ? "フルジャイロ" : "微調整ジャイロ"}でした。今回使うモードを選んでください。`);
  }
})();

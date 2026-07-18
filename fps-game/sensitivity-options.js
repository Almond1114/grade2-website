(() => {
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable) return;

  const STORAGE_KEY = "neonRushTouchSensitivityMultiplier";
  const MIN = 0.5;
  const MAX = 3;
  const STEP = 0.05;
  const clamp = (value) => Math.min(MAX, Math.max(MIN, value));

  let multiplier = clamp(Number.parseFloat(localStorage.getItem(STORAGE_KEY) || "1") || 1);
  window.neonRushTouchSensitivityMultiplier = multiplier;

  // touch-fixes.js already applies the base mobile boost. This wrapper adds the
  // player-selected multiplier only to synthetic touch-look mouse events.
  const previousDispatchEvent = document.dispatchEvent.bind(document);
  document.dispatchEvent = (event) => {
    if (event instanceof MouseEvent && event.type === "mousemove" && !event.isTrusted) {
      const scaledEvent = new MouseEvent("mousemove", {
        bubbles: event.bubbles,
        cancelable: event.cancelable,
      });
      const scale = window.neonRushTouchSensitivityMultiplier || 1;
      try {
        Object.defineProperties(scaledEvent, {
          movementX: { value: event.movementX * scale },
          movementY: { value: event.movementY * scale },
        });
      } catch {
        Object.defineProperty(scaledEvent, "movementX", { value: event.movementX * scale });
        Object.defineProperty(scaledEvent, "movementY", { value: event.movementY * scale });
      }
      return previousDispatchEvent(scaledEvent);
    }
    return previousDispatchEvent(event);
  };

  const root = document.querySelector("#touch-controls");
  if (!root) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "touch-sensitivity-button";
  button.textContent = "SENS";
  button.setAttribute("aria-label", "視点感度設定");
  button.setAttribute("aria-expanded", "false");

  const panel = document.createElement("section");
  panel.className = "touch-sensitivity-panel";
  panel.setAttribute("aria-label", "視点感度設定パネル");
  panel.innerHTML = `
    <div class="touch-sensitivity-head">
      <strong>視点感度倍率</strong>
      <output class="touch-sensitivity-value">1.00×</output>
    </div>
    <input class="touch-sensitivity-range" type="range" min="${MIN}" max="${MAX}" step="${STEP}" value="${multiplier}" aria-label="視点感度倍率" />
    <div class="touch-sensitivity-scale"><span>0.50×</span><span>3.00×</span></div>
    <div class="touch-sensitivity-presets" aria-label="感度プリセット">
      <button type="button" data-sensitivity="1">1.0×</button>
      <button type="button" data-sensitivity="1.5">1.5×</button>
      <button type="button" data-sensitivity="2">2.0×</button>
      <button type="button" data-sensitivity="3">3.0×</button>
    </div>
    <p class="touch-sensitivity-note">現在のスマホ視点感度に追加で掛かる倍率です。設定はこの端末に保存されます。</p>
  `;

  root.append(button, panel);

  const range = panel.querySelector(".touch-sensitivity-range");
  const output = panel.querySelector(".touch-sensitivity-value");
  const presets = [...panel.querySelectorAll("[data-sensitivity]")];

  const updateSelectedPreset = () => {
    presets.forEach((preset) => {
      preset.classList.toggle("selected", Math.abs(Number(preset.dataset.sensitivity) - multiplier) < 0.001);
    });
  };

  const setMultiplier = (value) => {
    multiplier = Math.round(clamp(Number(value)) / STEP) * STEP;
    window.neonRushTouchSensitivityMultiplier = multiplier;
    localStorage.setItem(STORAGE_KEY, String(multiplier));
    range.value = String(multiplier);
    output.textContent = `${multiplier.toFixed(2)}×`;
    updateSelectedPreset();
  };

  const setOpen = (open) => {
    panel.classList.toggle("open", open);
    button.classList.toggle("active", open);
    button.setAttribute("aria-expanded", String(open));
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!panel.classList.contains("open"));
  });

  panel.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  range.addEventListener("input", () => setMultiplier(range.value));

  presets.forEach((preset) => {
    preset.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMultiplier(preset.dataset.sensitivity);
      navigator.vibrate?.(5);
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!panel.classList.contains("open")) return;
    if (panel.contains(event.target) || button.contains(event.target)) return;
    setOpen(false);
  }, true);

  window.addEventListener("orientationchange", () => setOpen(false));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) setOpen(false);
  });

  setMultiplier(multiplier);
})();

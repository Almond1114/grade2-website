(() => {
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable) return;

  const touchRoot = document.querySelector("#touch-controls");
  const rightCluster = touchRoot?.querySelector(".touch-right-cluster");
  const startButton = document.querySelector("#start-button");
  const resumeButton = document.querySelector("#resume-button");
  const startScreen = document.querySelector("#start-screen");

  const gate = document.createElement("section");
  gate.className = "touch-landscape-gate";
  gate.setAttribute("aria-live", "polite");
  gate.innerHTML = `
    <div class="touch-landscape-card">
      <div class="touch-landscape-phone" aria-hidden="true"></div>
      <strong>端末を横向きにしてください</strong>
      <p>NEON RUSHは横画面専用です。横向きになるとスタートできます。</p>
    </div>
  `;
  document.body.appendChild(gate);

  const heroCard = startScreen?.querySelector(".hero-card");
  const existingExplanation = heroCard?.querySelector(".overdrive-explainer");
  if (heroCard && !existingExplanation) {
    const explanation = document.createElement("p");
    explanation.className = "overdrive-explainer";
    explanation.innerHTML = "<strong>OVERDRIVE</strong>：紫のゲージが100%になったらODボタンで発動。約7.5秒間、移動速度・連射速度・ダメージが強化されます。";
    heroCard.insertBefore(explanation, startButton);
  }

  const isPortrait = () => innerHeight >= innerWidth;

  const updateOrientationGate = () => {
    const portrait = isPortrait();
    gate.classList.toggle("active", portrait);
    document.body.classList.toggle("landscape-required", portrait);

    if (startButton) startButton.disabled = portrait;
    if (resumeButton) resumeButton.disabled = portrait;

    const gameStarted = startScreen && !startScreen.classList.contains("active");
    if (portrait && gameStarted) {
      document.exitPointerLock?.();
    }
  };

  if (rightCluster) {
    const stick = document.createElement("div");
    stick.className = "touch-look-stick";
    stick.setAttribute("aria-label", "視点移動スティック");
    stick.innerHTML = `
      <div class="touch-look-stick-ring"></div>
      <div class="touch-look-stick-knob"></div>
    `;
    rightCluster.appendChild(stick);

    const knob = stick.querySelector(".touch-look-stick-knob");
    let pointerId = null;
    let lookX = 0;
    let lookY = 0;
    let animationId = 0;
    let lastFrame = performance.now();

    const dispatchLook = (movementX, movementY) => {
      const event = new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
      });
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

    const animateLook = (now) => {
      if (pointerId === null) {
        animationId = 0;
        return;
      }

      const frameScale = Math.min(1.8, Math.max(0.45, (now - lastFrame) / 16.667));
      lastFrame = now;

      // Base speed is intentionally moderate. touch-fixes.js and the SENS setting
      // apply their multipliers after this analog-stick value.
      dispatchLook(lookX * 5.1 * frameScale, lookY * 4.4 * frameScale);
      animationId = requestAnimationFrame(animateLook);
    };

    const updateStick = (clientX, clientY) => {
      const rect = stick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = rect.width * 0.33;
      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance > radius) {
        const scale = radius / distance;
        dx *= scale;
        dy *= scale;
      }

      knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;

      const rawX = dx / radius;
      const rawY = dy / radius;
      const magnitude = Math.min(1, Math.hypot(rawX, rawY));
      const deadZone = 0.13;
      const strength = magnitude <= deadZone ? 0 : (magnitude - deadZone) / (1 - deadZone);

      if (strength === 0 || magnitude === 0) {
        lookX = 0;
        lookY = 0;
      } else {
        lookX = (rawX / magnitude) * strength;
        lookY = (rawY / magnitude) * strength;
      }
    };

    const resetStick = () => {
      pointerId = null;
      lookX = 0;
      lookY = 0;
      knob.style.transform = "translate3d(0, 0, 0)";
      stick.classList.remove("active");
      if (animationId) cancelAnimationFrame(animationId);
      animationId = 0;
    };

    stick.addEventListener("pointerdown", (event) => {
      if (pointerId !== null || isPortrait()) return;
      event.preventDefault();
      event.stopPropagation();
      pointerId = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      stick.classList.add("active");
      updateStick(event.clientX, event.clientY);
      lastFrame = performance.now();
      if (!animationId) animationId = requestAnimationFrame(animateLook);
    });

    stick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      updateStick(event.clientX, event.clientY);
    });

    const finishStick = (event) => {
      if (event.pointerId !== pointerId) return;
      resetStick();
    };

    stick.addEventListener("pointerup", finishStick);
    stick.addEventListener("pointercancel", finishStick);
    stick.addEventListener("lostpointercapture", resetStick);
    addEventListener("blur", resetStick);
    addEventListener("orientationchange", resetStick);
  }

  addEventListener("resize", updateOrientationGate);
  addEventListener("orientationchange", () => setTimeout(updateOrientationGate, 80));
  updateOrientationGate();
})();

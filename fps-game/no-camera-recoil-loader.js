import * as THREE from "three";

// Keep visual weapon kick, muzzle flash and spread, but prevent the shot itself
// from pushing the player's camera upward. Mouse/touch/gyro look input still
// passes through normally.
const cameraRotations = new WeakSet();
const xDescriptor = Object.getOwnPropertyDescriptor(THREE.Euler.prototype, "x");
const orderDescriptor = Object.getOwnPropertyDescriptor(THREE.Euler.prototype, "order");

if (!xDescriptor?.get || !xDescriptor?.set || !orderDescriptor?.get || !orderDescriptor?.set) {
  await import("./main.js?v=16");
} else {
  let insideLookEvent = false;

  document.addEventListener("mousemove", () => {
    insideLookEvent = true;
    queueMicrotask(() => {
      insideLookEvent = false;
    });
  }, true);

  Object.defineProperty(THREE.Euler.prototype, "order", {
    configurable: orderDescriptor.configurable,
    enumerable: orderDescriptor.enumerable,
    get: orderDescriptor.get,
    set(value) {
      orderDescriptor.set.call(this, value);
      if (value === "YXZ") cameraRotations.add(this);
    },
  });

  Object.defineProperty(THREE.Euler.prototype, "x", {
    configurable: xDescriptor.configurable,
    enumerable: xDescriptor.enumerable,
    get: xDescriptor.get,
    set(value) {
      const current = xDescriptor.get.call(this);
      const upwardRecoil = cameraRotations.has(this)
        && !insideLookEvent
        && document.querySelector("#hud:not(.hidden)")
        && Number.isFinite(value)
        && value < current
        && current - value <= 0.12;

      if (upwardRecoil) return;
      xDescriptor.set.call(this, value);
    },
  });

  await import("./main.js?v=16");
}

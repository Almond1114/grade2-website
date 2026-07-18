(() => {
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  if (!touchCapable) return;

  // The previous in-game gyro toggle must not auto-enable before the player
  // chooses a control mode on the start screen.
  try {
    localStorage.setItem("neonRushGyroEnabled", "0");
  } catch {
    // Storage can be unavailable in private browsing; selection still works.
  }

  window.__neonRushGyroSelection = {
    mode: "unselected",
    permission: "unknown",
    sensorReady: false,
  };
})();

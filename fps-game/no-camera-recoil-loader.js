// Load the game normally, changing only the single line that pushes the camera
// upward after each shot. This avoids patching THREE.Euler globally, which can
// interfere with mobile pointer-lock and cause the pause overlay to reopen.
const mainUrl = new URL("./main.js?v=17", import.meta.url);
const response = await fetch(mainUrl, { cache: "no-store" });
if (!response.ok) throw new Error(`main.js load failed: ${response.status}`);

const recoilLine = "  camera.rotation.x = Math.max(-1.45, camera.rotation.x - weapon.kick * (input.aim ? 0.55 : 0.85));";
const source = await response.text();

if (!source.includes(recoilLine)) {
  console.warn("NEON RUSH: camera recoil line was not found; loading the original game module.");
  await import(mainUrl.href);
} else {
  const patchedSource = source.replace(
    recoilLine,
    "  // Camera recoil disabled: keep aim fixed while preserving visual weapon kick.",
  );
  const moduleUrl = URL.createObjectURL(new Blob([patchedSource], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

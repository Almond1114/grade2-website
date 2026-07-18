import * as THREE from "three";

// Add lightweight neon edge lines to arena boxes before main.js builds the stage.
// Direct scene-added BoxGeometry meshes are the arena walls and cover objects;
// decorative top strips and instanced background towers are skipped.
const originalSceneAdd = THREE.Scene.prototype.add;
const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1), 12);

const materials = {
  coverCrisp: new THREE.LineBasicMaterial({
    color: 0x72f5ff,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    toneMapped: false,
  }),
  coverGlow: new THREE.LineBasicMaterial({
    color: 0x2bdcff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }),
  boundaryCrisp: new THREE.LineBasicMaterial({
    color: 0x8294ff,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    toneMapped: false,
  }),
  boundaryGlow: new THREE.LineBasicMaterial({
    color: 0x536dff,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }),
};

function attachNeonOutline(mesh) {
  if (!mesh?.isMesh || mesh.isInstancedMesh || mesh.geometry?.type !== "BoxGeometry") return;
  if (mesh.userData.neonObstacleOutline) return;
  if (mesh.scale.y < 0.18) return;
  if (Math.max(mesh.scale.x, mesh.scale.z) < 2) return;

  const boundary = Math.max(mesh.scale.x, mesh.scale.z) > 70;
  const crisp = new THREE.LineSegments(
    edgeGeometry,
    boundary ? materials.boundaryCrisp : materials.coverCrisp,
  );
  const glow = new THREE.LineSegments(
    edgeGeometry,
    boundary ? materials.boundaryGlow : materials.coverGlow,
  );

  crisp.name = "neon-obstacle-edge";
  glow.name = "neon-obstacle-glow";
  crisp.scale.setScalar(1.0015);
  glow.scale.setScalar(1.006);
  crisp.renderOrder = 5;
  glow.renderOrder = 4;
  crisp.raycast = () => {};
  glow.raycast = () => {};

  mesh.userData.neonObstacleOutline = true;
  mesh.add(glow, crisp);
}

THREE.Scene.prototype.add = function addWithNeonObstacleEdges(...objects) {
  objects.forEach(attachNeonOutline);
  return originalSceneAdd.apply(this, objects);
};

// Load the game only after the Scene patch is active.
await import("./main.js");

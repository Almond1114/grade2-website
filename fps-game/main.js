import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const $ = (selector) => document.querySelector(selector);
const gameRoot = $("#game");
const hud = $("#hud");
const startScreen = $("#start-screen");
const pauseScreen = $("#pause-screen");
const upgradeScreen = $("#upgrade-screen");
const gameOverScreen = $("#game-over-screen");
const startButton = $("#start-button");
const resumeButton = $("#resume-button");
const restartButton = $("#restart-button");
const upgradeOptions = $("#upgrade-options");
const announcement = $("#announcement");
const toast = $("#toast");
const crosshair = $("#crosshair");
const hitmarker = $("#hitmarker");
const damageVignette = $("#damage-vignette");
const overdriveVignette = $("#overdrive-vignette");

const ui = {
  score: $("#score"),
  wave: $("#wave"),
  combo: $("#combo"),
  fps: $("#fps"),
  renderScale: $("#render-scale"),
  best: $("#best-score"),
  healthText: $("#health-text"),
  healthBar: $("#health-bar"),
  dashText: $("#dash-text"),
  dashBar: $("#dash-bar"),
  overdriveText: $("#overdrive-text"),
  overdriveBar: $("#overdrive-bar"),
  weaponName: $("#weapon-name"),
  ammo: $("#ammo"),
  magazine: $("#magazine"),
  weaponMode: $("#weapon-mode"),
  finalScore: $("#final-score"),
  finalWave: $("#final-wave"),
  finalKills: $("#final-kills"),
};

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
  stencil: false,
  depth: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.tabIndex = 0;
gameRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050e);
scene.fog = new THREE.FogExp2(0x050817, 0.012);

const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.05, 220);
camera.rotation.order = "YXZ";
scene.add(camera);

const controls = new PointerLockControls(camera, renderer.domElement);
controls.pointerSpeed = 0.9;

scene.add(new THREE.HemisphereLight(0x7adfff, 0x090514, 1.5));
const keyLight = new THREE.DirectionalLight(0x8ec9ff, 2.2);
keyLight.position.set(12, 22, 8);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xff4fd8, 1.2);
rimLight.position.set(-16, 8, -14);
scene.add(rimLight);

const ARENA_HALF = 48;
const PLAYER_EYE = 1.72;
const PLAYER_RADIUS = 0.43;
const FIXED_STEP = 1 / 60;
const MAX_ENEMIES = 56;

const tmp = {
  v1: new THREE.Vector3(),
  v2: new THREE.Vector3(),
  v3: new THREE.Vector3(),
  forward: new THREE.Vector3(),
  right: new THREE.Vector3(),
  matrix: new THREE.Matrix4(),
  quat: new THREE.Quaternion(),
  scale: new THREE.Vector3(),
  color: new THREE.Color(),
};

const input = {
  keys: new Set(),
  fire: false,
  firePressed: false,
  aim: false,
  jumpPressed: false,
  slidePressed: false,
  dashPressed: false,
  mouseX: 0,
  mouseY: 0,
};

const state = {
  started: false,
  gameOver: false,
  pausedForUpgrade: false,
  wave: 0,
  phase: "idle",
  spawnRemaining: 0,
  spawnTimer: 0,
  clearTimer: 0,
  score: 0,
  best: Number(localStorage.getItem("neonRushBest") || 0),
  kills: 0,
  combo: 1,
  comboTimer: 0,
  maxHealth: 100,
  health: 100,
  overdrive: 0,
  overdriveActive: 0,
  damageFlash: 0,
  uiTimer: 0,
  announcementToken: 0,
  toastToken: 0,
  stats: createBaseStats(),
};

function createBaseStats() {
  return {
    damage: 1,
    fireRate: 1,
    moveSpeed: 1,
    reloadSpeed: 1,
    dashCooldown: 2.35,
    overdriveDuration: 7.5,
    damageReduction: 0,
    healOnKill: 0,
  };
}

const player = {
  position: new THREE.Vector3(0, 0, 18),
  velocity: new THREE.Vector3(),
  grounded: true,
  eyeHeight: PLAYER_EYE,
  slideTimer: 0,
  dashCooldown: 0,
  invulnerable: 0,
  stepTime: 0,
};

const WEAPONS = [
  {
    name: "VOLT RIFLE",
    mode: "AUTO",
    damage: 23,
    pellets: 1,
    fireRate: 10.5,
    magazine: 32,
    reload: 1.25,
    spread: 0.008,
    kick: 0.014,
    range: 100,
    automatic: true,
    color: 0x5df3ff,
  },
  {
    name: "NOVA SHOTGUN",
    mode: "PUMP",
    damage: 14,
    pellets: 9,
    fireRate: 1.25,
    magazine: 8,
    reload: 1.55,
    spread: 0.072,
    kick: 0.055,
    range: 46,
    automatic: false,
    color: 0xffa54d,
  },
  {
    name: "ARC RAIL",
    mode: "PIERCE",
    damage: 112,
    pellets: 1,
    fireRate: 0.82,
    magazine: 5,
    reload: 1.9,
    spread: 0.0015,
    kick: 0.08,
    range: 130,
    automatic: false,
    pierce: true,
    color: 0xff59e8,
  },
];

let weaponStates = WEAPONS.map((weapon) => ({
  ammo: weapon.magazine,
  cooldown: 0,
  reloading: false,
  reloadTimer: 0,
}));
let currentWeapon = 0;

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitSphere = new THREE.SphereGeometry(1, 12, 8);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
const materials = new Map();
const colliders = [];
const worldRayMeshes = [];
const shootables = [];
const barrels = [];
const enemies = [];
const enemyHitMeshes = [];
const pickups = [];
const spawnPoints = [];

function arenaMaterial(color, emissive = 0x07101c) {
  const key = `${color}:${emissive}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 0.38,
      metalness: 0.72,
      roughness: 0.3,
    }));
  }
  return materials.get(key);
}

function addBox(x, y, z, width, height, depth, color = 0x18263c, collider = true) {
  const mesh = new THREE.Mesh(unitBox, arenaMaterial(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  mesh.updateMatrixWorld(true);
  scene.add(mesh);
  worldRayMeshes.push(mesh);
  shootables.push(mesh);
  if (collider) {
    colliders.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
    });
  }
  return mesh;
}

function buildArena() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(112, 112),
    new THREE.MeshStandardMaterial({
      color: 0x080d18,
      metalness: 0.55,
      roughness: 0.52,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);
  worldRayMeshes.push(floor);
  shootables.push(floor);

  const grid = new THREE.GridHelper(104, 52, 0x24d8f0, 0x172a46);
  grid.position.y = 0.01;
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  scene.add(grid);

  addBox(0, 2.5, -50, 102, 5, 2, 0x17223b);
  addBox(0, 2.5, 50, 102, 5, 2, 0x17223b);
  addBox(-50, 2.5, 0, 2, 5, 102, 0x17223b);
  addBox(50, 2.5, 0, 2, 5, 102, 0x17223b);

  const coverLayout = [
    [-18, -15, 9, 2.8, 3.2], [18, -15, 9, 2.8, 3.2],
    [-18, 15, 9, 2.8, 3.2], [18, 15, 9, 2.8, 3.2],
    [0, 0, 4.5, 3.2, 13],
    [-9, 0, 3, 2.4, 6], [9, 0, 3, 2.4, 6],
    [0, -27, 15, 2.1, 2.3], [0, 27, 15, 2.1, 2.3],
    [-31, 0, 2.4, 3.5, 13], [31, 0, 2.4, 3.5, 13],
  ];

  for (const [x, z, width, height, depth] of coverLayout) {
    addBox(x, height / 2, z, width, height, depth, 0x14243d);
    const strip = addBox(x, height + 0.04, z, Math.max(0.7, width * 0.86), 0.08, Math.max(0.7, depth * 0.86), 0x55eaff, false);
    strip.material = arenaMaterial(0x59f3ff, 0x31c6dd);
  }

  const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
  const towerMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b1020,
    emissive: 0x160f35,
    emissiveIntensity: 0.5,
    roughness: 0.4,
    metalness: 0.7,
  });
  const towers = new THREE.InstancedMesh(towerGeometry, towerMaterial, 80);
  for (let i = 0; i < 80; i += 1) {
    const angle = (i / 80) * Math.PI * 2;
    const radius = 58 + Math.random() * 34;
    const height = 7 + Math.random() * 35;
    tmp.matrix.compose(
      new THREE.Vector3(Math.cos(angle) * radius, height / 2 - 1, Math.sin(angle) * radius),
      tmp.quat.identity(),
      new THREE.Vector3(3 + Math.random() * 5, height, 3 + Math.random() * 5),
    );
    towers.setMatrixAt(i, tmp.matrix);
  }
  scene.add(towers);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(1200 * 3);
  for (let i = 0; i < 1200; i += 1) {
    const radius = 45 + Math.random() * 145;
    const angle = Math.random() * Math.PI * 2;
    starPositions[i * 3] = Math.cos(angle) * radius;
    starPositions[i * 3 + 1] = 12 + Math.random() * 95;
    starPositions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0x8abfff, size: 0.18, transparent: true, opacity: 0.72 }),
  ));

  const spawnRadius = 42;
  for (let i = 0; i < 20; i += 1) {
    const angle = (i / 20) * Math.PI * 2;
    spawnPoints.push(new THREE.Vector3(Math.cos(angle) * spawnRadius, 0, Math.sin(angle) * spawnRadius));
  }

  const barrelPositions = [
    [-12, -10], [12, -10], [-12, 10], [12, 10],
    [-29, -20], [29, -20], [-29, 20], [29, 20],
  ];
  barrelPositions.forEach(([x, z]) => createBarrel(x, z));
}

function createBarrel(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xff725c,
    emissive: 0xff214d,
    emissiveIntensity: 1.5,
    metalness: 0.45,
    roughness: 0.2,
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.45, 12), coreMaterial);
  core.position.y = 0.74;
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffb45e });
  const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 7, 18), ringMaterial);
  topRing.rotation.x = Math.PI / 2;
  topRing.position.y = 1.25;
  const bottomRing = topRing.clone();
  bottomRing.position.y = 0.25;
  group.add(core, topRing, bottomRing);
  scene.add(group);

  const barrel = { group, core, hp: 45, active: true };
  core.userData.barrel = barrel;
  barrels.push(barrel);
  shootables.push(core);
}

buildArena();

function circleHitsCollider(x, z, radius) {
  if (Math.abs(x) + radius > ARENA_HALF || Math.abs(z) + radius > ARENA_HALF) return true;
  for (const collider of colliders) {
    const closestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
    const closestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

function removeShootable(mesh) {
  const index = shootables.indexOf(mesh);
  if (index >= 0) shootables.splice(index, 1);
}

function addShootable(mesh) {
  if (!shootables.includes(mesh)) shootables.push(mesh);
}

class ImpactPool {
  constructor(count = 88) {
    this.items = [];
    const geometry = new THREE.IcosahedronGeometry(0.07, 0);
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: 0x7ef8ff, transparent: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      scene.add(mesh);
      this.items.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 0 });
    }
  }

  spawn(position, color = 0x7ef8ff, count = 5, power = 4) {
    let spawned = 0;
    for (const item of this.items) {
      if (item.life > 0) continue;
      item.life = item.maxLife = 0.22 + Math.random() * 0.28;
      item.mesh.visible = true;
      item.mesh.position.copy(position);
      item.mesh.material.color.setHex(color);
      item.mesh.material.opacity = 1;
      item.mesh.scale.setScalar(0.55 + Math.random() * 1.25);
      item.velocity.set(
        (Math.random() - 0.5) * power,
        Math.random() * power,
        (Math.random() - 0.5) * power,
      );
      spawned += 1;
      if (spawned >= count) break;
    }
  }

  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.mesh.visible = false;
        continue;
      }
      item.velocity.y -= 8 * dt;
      item.mesh.position.addScaledVector(item.velocity, dt);
      item.mesh.material.opacity = item.life / item.maxLife;
    }
  }
}

class TracerPool {
  constructor(count = 36) {
    this.items = [];
    for (let i = 0; i < count; i += 1) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const material = new THREE.LineBasicMaterial({ color: 0x69f5ff, transparent: true, opacity: 1 });
      const line = new THREE.Line(geometry, material);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.items.push({ line, life: 0, maxLife: 0 });
    }
  }

  spawn(start, end, color, duration = 0.055) {
    const item = this.items.find((candidate) => candidate.life <= 0) || this.items[0];
    item.life = item.maxLife = duration;
    item.line.visible = true;
    item.line.material.color.setHex(color);
    item.line.material.opacity = 1;
    const attribute = item.line.geometry.attributes.position;
    attribute.setXYZ(0, start.x, start.y, start.z);
    attribute.setXYZ(1, end.x, end.y, end.z);
    attribute.needsUpdate = true;
  }

  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.line.visible = false;
      } else {
        item.line.material.opacity = item.life / item.maxLife;
      }
    }
  }
}

class ShockwavePool {
  constructor(count = 14) {
    this.items = [];
    const geometry = new THREE.RingGeometry(0.72, 0.9, 40);
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x68efff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      this.items.push({ mesh, life: 0, maxLife: 0, maxScale: 1 });
    }
  }

  spawn(position, color = 0x68efff, maxScale = 8, life = 0.45) {
    const item = this.items.find((candidate) => candidate.life <= 0) || this.items[0];
    item.life = item.maxLife = life;
    item.maxScale = maxScale;
    item.mesh.visible = true;
    item.mesh.position.copy(position);
    item.mesh.position.y += 0.05;
    item.mesh.scale.setScalar(0.2);
    item.mesh.material.color.setHex(color);
    item.mesh.material.opacity = 0.85;
  }

  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.mesh.visible = false;
        continue;
      }
      const progress = 1 - item.life / item.maxLife;
      item.mesh.scale.setScalar(THREE.MathUtils.lerp(0.2, item.maxScale, progress));
      item.mesh.material.opacity = (1 - progress) * 0.8;
    }
  }
}

const impacts = new ImpactPool();
const tracers = new TracerPool();
const shockwaves = new ShockwavePool();

const MAX_PROJECTILES = 96;
const projectileGeometry = new THREE.SphereGeometry(0.12, 8, 6);
const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff55d7 });
const projectileMesh = new THREE.InstancedMesh(projectileGeometry, projectileMaterial, MAX_PROJECTILES);
projectileMesh.frustumCulled = false;
scene.add(projectileMesh);
const projectileSlots = Array.from({ length: MAX_PROJECTILES }, () => ({
  active: false,
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  life: 0,
  damage: 0,
}));

function hideProjectileInstance(index) {
  tmp.matrix.compose(tmp.v1.set(0, -1000, 0), tmp.quat.identity(), tmp.scale.setScalar(0));
  projectileMesh.setMatrixAt(index, tmp.matrix);
}
for (let i = 0; i < MAX_PROJECTILES; i += 1) hideProjectileInstance(i);
projectileMesh.instanceMatrix.needsUpdate = true;

function spawnEnemyProjectile(origin, target, damage, speed = 16) {
  const slot = projectileSlots.find((candidate) => !candidate.active);
  if (!slot) return;
  slot.active = true;
  slot.position.copy(origin);
  slot.velocity.copy(target).sub(origin).normalize().multiplyScalar(speed);
  slot.life = 4.5;
  slot.damage = damage;
}

function clearProjectiles() {
  projectileSlots.forEach((slot, index) => {
    slot.active = false;
    hideProjectileInstance(index);
  });
  projectileMesh.instanceMatrix.needsUpdate = true;
}

function updateProjectiles(dt) {
  for (let i = 0; i < projectileSlots.length; i += 1) {
    const slot = projectileSlots[i];
    if (!slot.active) {
      hideProjectileInstance(i);
      continue;
    }

    slot.life -= dt;
    slot.position.addScaledVector(slot.velocity, dt);
    const playerTarget = tmp.v1.copy(player.position);
    playerTarget.y += player.eyeHeight * 0.72;

    if (slot.life <= 0 || circleHitsCollider(slot.position.x, slot.position.z, 0.08)) {
      slot.active = false;
      hideProjectileInstance(i);
      continue;
    }

    if (slot.position.distanceToSquared(playerTarget) < 0.58 * 0.58) {
      impacts.spawn(slot.position, 0xff5fd7, 6, 3);
      hurtPlayer(slot.damage);
      slot.active = false;
      hideProjectileInstance(i);
      continue;
    }

    tmp.matrix.compose(slot.position, tmp.quat.identity(), tmp.scale.setScalar(1));
    projectileMesh.setMatrixAt(i, tmp.matrix);
  }
  projectileMesh.instanceMatrix.needsUpdate = true;
}

const enemyGeometry = {
  runnerBody: new THREE.BoxGeometry(0.78, 1.05, 0.58),
  runnerHead: new THREE.IcosahedronGeometry(0.34, 1),
  droneBody: new THREE.OctahedronGeometry(0.68, 0),
  droneHead: new THREE.SphereGeometry(0.24, 10, 7),
  bruteBody: new THREE.BoxGeometry(1.45, 1.7, 1.1),
  bruteHead: new THREE.IcosahedronGeometry(0.48, 1),
};

function enemyMaterials(type) {
  const palettes = {
    runner: [0x203b4e, 0x36e4ff],
    drone: [0x3d254e, 0xff5adf],
    brute: [0x4a3024, 0xff9b4a],
  };
  const [base, glow] = palettes[type];
  return {
    body: new THREE.MeshStandardMaterial({
      color: base,
      emissive: glow,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.7,
    }),
    head: new THREE.MeshStandardMaterial({
      color: glow,
      emissive: glow,
      emissiveIntensity: 1.45,
      roughness: 0.15,
      metalness: 0.45,
    }),
  };
}

function chooseEnemyType() {
  const roll = Math.random();
  if (state.wave >= 5 && roll < 0.16) return "brute";
  if (state.wave >= 2 && roll < 0.43) return "drone";
  return "runner";
}

function spawnEnemy() {
  if (enemies.length >= MAX_ENEMIES) return;
  const type = chooseEnemyType();
  const point = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  const group = new THREE.Group();
  group.position.copy(point);
  const mats = enemyMaterials(type);

  let body;
  let head;
  let baseHealth;
  let speed;
  let radius;
  let centerY;

  if (type === "drone") {
    body = new THREE.Mesh(enemyGeometry.droneBody, mats.body);
    body.position.y = 2.2;
    head = new THREE.Mesh(enemyGeometry.droneHead, mats.head);
    head.position.y = 2.2;
    head.position.z = -0.56;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.045, 7, 24),
      new THREE.MeshBasicMaterial({ color: 0xff65df }),
    );
    ring.position.y = 2.2;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    baseHealth = 60;
    speed = 4.4;
    radius = 0.65;
    centerY = 2.2;
  } else if (type === "brute") {
    body = new THREE.Mesh(enemyGeometry.bruteBody, mats.body);
    body.position.y = 1.05;
    head = new THREE.Mesh(enemyGeometry.bruteHead, mats.head);
    head.position.y = 2.15;
    baseHealth = 260;
    speed = 2.15;
    radius = 0.88;
    centerY = 1.2;
  } else {
    body = new THREE.Mesh(enemyGeometry.runnerBody, mats.body);
    body.position.y = 0.78;
    head = new THREE.Mesh(enemyGeometry.runnerHead, mats.head);
    head.position.y = 1.48;
    baseHealth = 82;
    speed = 5.5;
    radius = 0.52;
    centerY = 0.95;
  }

  group.add(body, head);
  scene.add(group);

  const healthScale = 1 + Math.max(0, state.wave - 1) * 0.105;
  const enemy = {
    type,
    group,
    body,
    head,
    bodyMaterial: mats.body,
    headMaterial: mats.head,
    hp: baseHealth * healthScale,
    maxHp: baseHealth * healthScale,
    speed: speed * (1 + Math.min(state.wave, 20) * 0.012),
    radius,
    centerY,
    attackTimer: Math.random(),
    strafeDirection: Math.random() < 0.5 ? -1 : 1,
    phase: Math.random() * Math.PI * 2,
    flash: 0,
  };

  body.userData.enemy = enemy;
  body.userData.hitZone = "body";
  head.userData.enemy = enemy;
  head.userData.hitZone = "head";
  enemies.push(enemy);
  enemyHitMeshes.push(body, head);
  shootables.push(body, head);
}

function removeEnemy(enemy) {
  scene.remove(enemy.group);
  for (const mesh of [enemy.body, enemy.head]) {
    removeShootable(mesh);
    const hitIndex = enemyHitMeshes.indexOf(mesh);
    if (hitIndex >= 0) enemyHitMeshes.splice(hitIndex, 1);
  }
  const index = enemies.indexOf(enemy);
  if (index >= 0) enemies.splice(index, 1);
}

function clearEnemies() {
  while (enemies.length) removeEnemy(enemies[0]);
}

function damageEnemy(enemy, amount, hitPoint, headshot = false) {
  if (!enemy || !enemies.includes(enemy)) return false;
  enemy.hp -= amount * (headshot ? 1.85 : 1);
  enemy.flash = 0.1;
  impacts.spawn(hitPoint, headshot ? 0xffd971 : 0x71f6ff, headshot ? 8 : 4, headshot ? 5 : 3.5);
  showHitmarker(headshot);
  audio.hit(headshot);

  if (enemy.hp > 0) return false;

  const position = enemy.group.position.clone();
  position.y += enemy.centerY;
  const baseScore = enemy.type === "brute" ? 500 : enemy.type === "drone" ? 220 : 140;
  state.combo = state.comboTimer > 0 ? Math.min(5, state.combo + 0.22) : 1;
  state.comboTimer = 3.6;
  state.score += Math.round(baseScore * state.combo);
  state.kills += 1;
  state.overdrive = Math.min(100, state.overdrive + (enemy.type === "brute" ? 24 : 11));
  state.health = Math.min(state.maxHealth, state.health + state.stats.healOnKill);
  impacts.spawn(position, enemy.type === "brute" ? 0xff9d4d : 0x58efff, enemy.type === "brute" ? 24 : 13, 8);
  shockwaves.spawn(enemy.group.position, enemy.type === "brute" ? 0xff9d4d : 0x59eaff, enemy.type === "brute" ? 7 : 3.5, 0.36);
  audio.explosion(enemy.type === "brute" ? 0.85 : 0.45);

  if (Math.random() < 0.17) spawnPickup(enemy.group.position, state.health < state.maxHealth * 0.62 ? "health" : "energy");
  removeEnemy(enemy);
  return true;
}

const enemyGrid = new Map();
const GRID_SIZE = 4;

function gridKey(x, z) {
  return `${Math.floor(x / GRID_SIZE)},${Math.floor(z / GRID_SIZE)}`;
}

function rebuildEnemyGrid() {
  enemyGrid.clear();
  for (const enemy of enemies) {
    const key = gridKey(enemy.group.position.x, enemy.group.position.z);
    if (!enemyGrid.has(key)) enemyGrid.set(key, []);
    enemyGrid.get(key).push(enemy);
  }
}

function nearbyEnemies(enemy) {
  const result = [];
  const cx = Math.floor(enemy.group.position.x / GRID_SIZE);
  const cz = Math.floor(enemy.group.position.z / GRID_SIZE);
  for (let x = cx - 1; x <= cx + 1; x += 1) {
    for (let z = cz - 1; z <= cz + 1; z += 1) {
      const cell = enemyGrid.get(`${x},${z}`);
      if (cell) result.push(...cell);
    }
  }
  return result;
}

function moveEnemy(enemy, direction, dt) {
  const separation = tmp.v2.set(0, 0, 0);
  for (const other of nearbyEnemies(enemy)) {
    if (other === enemy) continue;
    const dx = enemy.group.position.x - other.group.position.x;
    const dz = enemy.group.position.z - other.group.position.z;
    const distanceSq = dx * dx + dz * dz;
    const minDistance = enemy.radius + other.radius + 0.35;
    if (distanceSq > 0.001 && distanceSq < minDistance * minDistance) {
      const strength = (minDistance - Math.sqrt(distanceSq)) / minDistance;
      separation.x += (dx / Math.sqrt(distanceSq)) * strength;
      separation.z += (dz / Math.sqrt(distanceSq)) * strength;
    }
  }

  direction.addScaledVector(separation, 1.5).normalize();
  const distance = enemy.speed * dt;
  const nextX = enemy.group.position.x + direction.x * distance;
  const nextZ = enemy.group.position.z + direction.z * distance;

  if (!circleHitsCollider(nextX, enemy.group.position.z, enemy.radius)) {
    enemy.group.position.x = nextX;
  } else {
    direction.set(-direction.z, 0, direction.x);
  }
  if (!circleHitsCollider(enemy.group.position.x, nextZ, enemy.radius)) {
    enemy.group.position.z = nextZ;
  }
}

function updateEnemies(dt) {
  rebuildEnemyGrid();
  const playerCenter = tmp.v3.copy(player.position);
  playerCenter.y += player.eyeHeight * 0.68;

  for (const enemy of [...enemies]) {
    enemy.attackTimer -= dt;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.bodyMaterial.emissiveIntensity = enemy.flash > 0 ? 2.6 : 0.35;
    enemy.headMaterial.emissiveIntensity = enemy.flash > 0 ? 3.2 : 1.45;

    const toPlayer = tmp.v1.copy(player.position).sub(enemy.group.position);
    toPlayer.y = 0;
    const distance = Math.max(0.001, toPlayer.length());
    toPlayer.divideScalar(distance);
    enemy.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    if (enemy.type === "drone") {
      enemy.phase += dt * 2.4;
      enemy.body.position.y = 2.2 + Math.sin(enemy.phase) * 0.2;
      enemy.head.position.y = enemy.body.position.y;
      const tangent = tmp.v2.set(-toPlayer.z, 0, toPlayer.x).multiplyScalar(enemy.strafeDirection);
      const desired = tmp.v3.copy(tangent);
      if (distance > 15) desired.addScaledVector(toPlayer, 0.9);
      if (distance < 8) desired.addScaledVector(toPlayer, -1.2);
      moveEnemy(enemy, desired, dt);

      if (enemy.attackTimer <= 0 && distance < 25) {
        const origin = enemy.group.position.clone();
        origin.y += enemy.body.position.y;
        const target = playerCenter.clone();
        target.x += player.velocity.x * 0.08;
        target.z += player.velocity.z * 0.08;
        spawnEnemyProjectile(origin, target, 8 + state.wave * 0.45, 18 + Math.min(6, state.wave * 0.2));
        enemy.attackTimer = Math.max(0.65, 1.45 - state.wave * 0.025) + Math.random() * 0.4;
        audio.enemyShot();
      }
    } else if (enemy.type === "brute") {
      if (distance > 2.2) moveEnemy(enemy, toPlayer, dt);
      if (enemy.attackTimer <= 0 && distance < 3.2) {
        hurtPlayer(17 + state.wave * 0.65);
        shockwaves.spawn(enemy.group.position, 0xff8a45, 4.2, 0.35);
        enemy.attackTimer = 1.6;
      }
    } else {
      const weave = tmp.v2.set(-toPlayer.z, 0, toPlayer.x).multiplyScalar(Math.sin(performance.now() * 0.002 + enemy.phase) * 0.28);
      toPlayer.add(weave).normalize();
      if (distance > 1.3) moveEnemy(enemy, toPlayer, dt);
      if (enemy.attackTimer <= 0 && distance < 1.8) {
        hurtPlayer(9 + state.wave * 0.45);
        enemy.attackTimer = 0.78;
      }
    }
  }
}

function spawnPickup(position, type) {
  const group = new THREE.Group();
  const color = type === "health" ? 0x55ff9a : 0xb65cff;
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.4,
      roughness: 0.15,
      metalness: 0.45,
    }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.045, 8, 22),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(core, ring);
  group.position.copy(position);
  group.position.y = 0.72;
  scene.add(group);
  pickups.push({ group, type, phase: Math.random() * Math.PI * 2, life: 12 });
}

function removePickup(pickup) {
  scene.remove(pickup.group);
  const index = pickups.indexOf(pickup);
  if (index >= 0) pickups.splice(index, 1);
}

function clearPickups() {
  while (pickups.length) removePickup(pickups[0]);
}

function updatePickups(dt) {
  for (const pickup of [...pickups]) {
    pickup.life -= dt;
    pickup.phase += dt * 2.8;
    pickup.group.rotation.y += dt * 2.4;
    pickup.group.position.y = 0.72 + Math.sin(pickup.phase) * 0.14;
    if (pickup.life <= 0) {
      removePickup(pickup);
      continue;
    }
    const dx = pickup.group.position.x - player.position.x;
    const dz = pickup.group.position.z - player.position.z;
    if (dx * dx + dz * dz < 1.3 * 1.3) {
      if (pickup.type === "health") {
        state.health = Math.min(state.maxHealth, state.health + 32);
        showToast("HP +32");
      } else {
        state.overdrive = Math.min(100, state.overdrive + 30);
        showToast("OVERDRIVE +30%");
      }
      audio.pickup();
      removePickup(pickup);
    }
  }
}

const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = false;

const weaponRig = new THREE.Group();
camera.add(weaponRig);
let muzzleAnchor = new THREE.Object3D();
let muzzleFlash;
let gunKick = 0;
let gunSideKick = 0;
let muzzleTimer = 0;

function makeWeaponPart(scale, position, color, rotation = null) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.2,
    metalness: 0.88,
    roughness: 0.22,
  });
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.scale.copy(scale);
  mesh.position.copy(position);
  if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  return mesh;
}

function buildWeaponModel(index) {
  weaponRig.clear();
  const weapon = WEAPONS[index];
  const dark = 0x101725;
  weaponRig.add(makeWeaponPart(new THREE.Vector3(0.18, 0.18, 0.68), new THREE.Vector3(0, 0, -0.5), dark));
  weaponRig.add(makeWeaponPart(new THREE.Vector3(0.11, 0.12, 0.5), new THREE.Vector3(0, 0.02, -1.05), weapon.color));
  weaponRig.add(makeWeaponPart(new THREE.Vector3(0.1, 0.28, 0.13), new THREE.Vector3(0, -0.21, -0.42), dark, new THREE.Vector3(-0.2, 0, 0)));

  if (index === 1) {
    weaponRig.add(makeWeaponPart(new THREE.Vector3(0.29, 0.23, 0.34), new THREE.Vector3(0, 0.01, -0.72), 0x29303a));
    weaponRig.add(makeWeaponPart(new THREE.Vector3(0.27, 0.09, 0.2), new THREE.Vector3(0, -0.1, -1.22), weapon.color));
  } else if (index === 2) {
    weaponRig.add(makeWeaponPart(new THREE.Vector3(0.06, 0.06, 0.78), new THREE.Vector3(-0.15, 0.12, -0.86), weapon.color));
    weaponRig.add(makeWeaponPart(new THREE.Vector3(0.06, 0.06, 0.78), new THREE.Vector3(0.15, 0.12, -0.86), weapon.color));
  } else {
    weaponRig.add(makeWeaponPart(new THREE.Vector3(0.22, 0.055, 0.32), new THREE.Vector3(0, 0.2, -0.62), weapon.color));
  }

  muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0.02, index === 1 ? -1.45 : -1.58);
  weaponRig.add(muzzleAnchor);
  muzzleFlash = new THREE.Mesh(
    new THREE.IcosahedronGeometry(index === 1 ? 0.16 : 0.1, 0),
    new THREE.MeshBasicMaterial({ color: weapon.color, transparent: true, opacity: 0.9 }),
  );
  muzzleFlash.visible = false;
  muzzleAnchor.add(muzzleFlash);
  weaponRig.position.set(0.34, -0.33, -0.45);
}

buildWeaponModel(0);

function switchWeapon(index) {
  if (index < 0 || index >= WEAPONS.length || index === currentWeapon) return;
  currentWeapon = index;
  weaponStates.forEach((weaponState) => { weaponState.reloading = false; });
  buildWeaponModel(index);
  gunKick = 0.16;
  audio.switchWeapon();
  showToast(WEAPONS[index].name);
}

function startReload() {
  const weapon = WEAPONS[currentWeapon];
  const weaponState = weaponStates[currentWeapon];
  if (weaponState.reloading || weaponState.ammo >= weapon.magazine) return;
  weaponState.reloading = true;
  weaponState.reloadTimer = weapon.reload * state.stats.reloadSpeed;
  audio.reload();
}

function randomSpread(amount) {
  return (Math.random() + Math.random() - 1) * amount;
}

function showHitmarker(headshot) {
  hitmarker.classList.remove("active", "headshot");
  void hitmarker.offsetWidth;
  if (headshot) hitmarker.classList.add("headshot");
  hitmarker.classList.add("active");
}

function fireRay(direction, weapon, damage) {
  raycaster.set(camera.position, direction);
  raycaster.far = weapon.range;
  const intersections = raycaster.intersectObjects(shootables, false);
  const muzzleStart = new THREE.Vector3();
  muzzleAnchor.getWorldPosition(muzzleStart);
  let endPoint = tmp.v3.copy(camera.position).addScaledVector(direction, weapon.range).clone();

  if (weapon.pierce) {
    const damaged = new Set();
    let penetrations = 0;
    for (const hit of intersections) {
      endPoint.copy(hit.point);
      const enemy = hit.object.userData.enemy;
      const barrel = hit.object.userData.barrel;
      if (enemy && !damaged.has(enemy)) {
        damaged.add(enemy);
        damageEnemy(enemy, damage, hit.point, hit.object.userData.hitZone === "head");
        penetrations += 1;
        if (penetrations >= 4) break;
        continue;
      }
      if (barrel) {
        damageBarrel(barrel, damage, hit.point);
        break;
      }
      if (!enemy) break;
    }
  } else if (intersections.length) {
    const hit = intersections[0];
    endPoint.copy(hit.point);
    if (hit.object.userData.enemy) {
      damageEnemy(hit.object.userData.enemy, damage, hit.point, hit.object.userData.hitZone === "head");
    } else if (hit.object.userData.barrel) {
      damageBarrel(hit.object.userData.barrel, damage, hit.point);
    } else {
      impacts.spawn(hit.point, weapon.color, 3, 2.4);
    }
  }

  tracers.spawn(muzzleStart, endPoint, weapon.color, weapon.pierce ? 0.12 : 0.05);
}

function attemptShoot() {
  if (!controls.isLocked || state.gameOver || state.pausedForUpgrade) return;
  const weapon = WEAPONS[currentWeapon];
  const weaponState = weaponStates[currentWeapon];
  if (weaponState.cooldown > 0 || weaponState.reloading) return;
  if (weaponState.ammo <= 0) {
    startReload();
    return;
  }

  weaponState.ammo -= 1;
  const overdriveRate = state.overdriveActive > 0 ? 1.45 : 1;
  weaponState.cooldown = 1 / (weapon.fireRate * state.stats.fireRate * overdriveRate);
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movementSpread = 1 + Math.min(1.1, speed / 14);
  const aimSpread = input.aim ? 0.42 : 1;
  const slideSpread = player.slideTimer > 0 ? 1.25 : 1;
  const spread = weapon.spread * movementSpread * aimSpread * slideSpread;
  const damage = weapon.damage * state.stats.damage * (state.overdriveActive > 0 ? 1.42 : 1);

  camera.getWorldDirection(tmp.forward);
  tmp.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = tmp.v2.set(0, 1, 0).applyQuaternion(camera.quaternion).clone();

  for (let i = 0; i < weapon.pellets; i += 1) {
    const direction = tmp.v1.copy(tmp.forward)
      .addScaledVector(tmp.right, randomSpread(spread))
      .addScaledVector(up, randomSpread(spread))
      .normalize()
      .clone();
    fireRay(direction, weapon, damage);
  }

  gunKick = Math.min(0.24, gunKick + weapon.kick * 2.7);
  gunSideKick += (Math.random() - 0.5) * weapon.kick * 1.8;
  camera.rotation.x = Math.max(-1.45, camera.rotation.x - weapon.kick * (input.aim ? 0.55 : 0.85));
  muzzleTimer = weapon.pellets > 1 ? 0.08 : 0.035;
  muzzleFlash.visible = true;
  crosshair.classList.add("expanded");
  audio.shot(currentWeapon);

  if (weaponState.ammo === 0) setTimeout(startReload, 90);
}

function damageBarrel(barrel, damage, point) {
  if (!barrel.active) return;
  barrel.hp -= damage;
  impacts.spawn(point, 0xff9a58, 5, 4);
  if (barrel.hp <= 0) explodeBarrel(barrel);
}

function explodeBarrel(barrel) {
  if (!barrel.active) return;
  barrel.active = false;
  barrel.group.visible = false;
  removeShootable(barrel.core);
  const origin = barrel.group.position.clone();
  origin.y = 0.8;
  impacts.spawn(origin, 0xff704d, 32, 11);
  shockwaves.spawn(barrel.group.position, 0xff624d, 9, 0.55);
  audio.explosion(1);

  for (const enemy of [...enemies]) {
    const distance = enemy.group.position.distanceTo(barrel.group.position);
    if (distance < 8.5) {
      damageEnemy(enemy, Math.max(20, 145 - distance * 15), origin, false);
    }
  }

  const playerDistance = player.position.distanceTo(barrel.group.position);
  if (playerDistance < 6.2) hurtPlayer(Math.max(0, 40 - playerDistance * 6));

  const chain = [];
  for (const other of barrels) {
    if (!other.active || other === barrel) continue;
    if (other.group.position.distanceTo(barrel.group.position) < 6.5) {
      other.hp -= 38;
      if (other.hp <= 0) chain.push(other);
    }
  }
  chain.forEach(explodeBarrel);
}

function resetBarrels() {
  for (const barrel of barrels) {
    barrel.hp = 45;
    barrel.active = true;
    barrel.group.visible = true;
    addShootable(barrel.core);
  }
}

function updateWeapon(dt) {
  const weapon = WEAPONS[currentWeapon];
  const weaponState = weaponStates[currentWeapon];
  weaponState.cooldown = Math.max(0, weaponState.cooldown - dt);

  if (weaponState.reloading) {
    weaponState.reloadTimer -= dt;
    if (weaponState.reloadTimer <= 0) {
      weaponState.reloading = false;
      weaponState.ammo = weapon.magazine;
      audio.reloadDone();
    }
  }

  if (input.firePressed || (input.fire && weapon.automatic)) attemptShoot();
  input.firePressed = false;
}

function updateWeaponRig(dt) {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  player.stepTime += dt * (2.2 + speed * 0.72);
  const aiming = input.aim ? 1 : 0;
  const targetX = THREE.MathUtils.lerp(0.34, 0.02, aiming);
  const targetY = THREE.MathUtils.lerp(-0.33, -0.22, aiming);
  const bobAmount = player.grounded ? Math.min(0.018, speed * 0.0016) : 0.006;
  const bobX = Math.sin(player.stepTime) * bobAmount;
  const bobY = Math.abs(Math.cos(player.stepTime * 2)) * bobAmount * 0.55;

  gunKick = THREE.MathUtils.damp(gunKick, 0, 14, dt);
  gunSideKick = THREE.MathUtils.damp(gunSideKick, 0, 11, dt);
  input.mouseX = THREE.MathUtils.damp(input.mouseX, 0, 12, dt);
  input.mouseY = THREE.MathUtils.damp(input.mouseY, 0, 12, dt);

  weaponRig.position.x = THREE.MathUtils.damp(weaponRig.position.x, targetX + bobX + gunSideKick - input.mouseX * 0.00025, 14, dt);
  weaponRig.position.y = THREE.MathUtils.damp(weaponRig.position.y, targetY - bobY + input.mouseY * 0.00022, 14, dt);
  weaponRig.position.z = -0.45 + gunKick;
  weaponRig.rotation.z = THREE.MathUtils.damp(weaponRig.rotation.z, -bobX * 1.4 - gunSideKick, 11, dt);
  weaponRig.rotation.x = THREE.MathUtils.damp(weaponRig.rotation.x, -input.mouseY * 0.00018, 12, dt);
  weaponRig.rotation.y = THREE.MathUtils.damp(weaponRig.rotation.y, -input.mouseX * 0.00022, 12, dt);

  muzzleTimer -= dt;
  if (muzzleTimer <= 0 && muzzleFlash) muzzleFlash.visible = false;
}

function updatePlayer(dt) {
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);

  camera.getWorldDirection(tmp.forward);
  tmp.forward.y = 0;
  tmp.forward.normalize();
  tmp.right.crossVectors(tmp.forward, camera.up).normalize();

  const moveX = Number(input.keys.has("KeyD")) - Number(input.keys.has("KeyA"));
  const moveZ = Number(input.keys.has("KeyW")) - Number(input.keys.has("KeyS"));
  const desired = tmp.v1.set(0, 0, 0)
    .addScaledVector(tmp.forward, moveZ)
    .addScaledVector(tmp.right, moveX);
  if (desired.lengthSq() > 0) desired.normalize();

  const sprinting = input.keys.has("ShiftLeft") && moveZ > 0 && player.slideTimer <= 0;
  let targetSpeed = (sprinting ? 12.8 : 8.6) * state.stats.moveSpeed;
  if (state.overdriveActive > 0) targetSpeed *= 1.18;

  if (input.slidePressed && player.grounded && Math.hypot(player.velocity.x, player.velocity.z) > 6.2) {
    player.slideTimer = 0.72;
    const slideDirection = desired.lengthSq() > 0 ? desired : tmp.forward;
    player.velocity.x += slideDirection.x * 4.5;
    player.velocity.z += slideDirection.z * 4.5;
    audio.slide();
  }
  input.slidePressed = false;

  if (input.jumpPressed && player.grounded) {
    player.velocity.y = player.slideTimer > 0 ? 9.2 : 8.2;
    player.grounded = false;
    player.slideTimer = 0;
    audio.jump();
  }
  input.jumpPressed = false;

  if (input.dashPressed && player.dashCooldown <= 0) {
    const dashDirection = desired.lengthSq() > 0 ? desired : tmp.forward;
    player.velocity.x = dashDirection.x * 22;
    player.velocity.z = dashDirection.z * 22;
    player.dashCooldown = state.stats.dashCooldown;
    player.invulnerable = 0.18;
    shockwaves.spawn(player.position, 0x5befff, 3.7, 0.28);
    audio.dash();
  }
  input.dashPressed = false;

  if (player.slideTimer > 0) {
    player.slideTimer -= dt;
    targetSpeed = Math.max(targetSpeed, 13.5 * state.stats.moveSpeed);
  }

  const currentHorizontal = tmp.v2.set(player.velocity.x, 0, player.velocity.z);
  const targetVelocity = tmp.v3.copy(desired).multiplyScalar(targetSpeed);
  const acceleration = player.grounded ? (player.slideTimer > 0 ? 7 : 42) : 12;
  currentHorizontal.x = THREE.MathUtils.damp(currentHorizontal.x, targetVelocity.x, acceleration, dt);
  currentHorizontal.z = THREE.MathUtils.damp(currentHorizontal.z, targetVelocity.z, acceleration, dt);

  if (desired.lengthSq() === 0 && player.grounded && player.slideTimer <= 0) {
    currentHorizontal.multiplyScalar(Math.exp(-10 * dt));
  }

  player.velocity.x = currentHorizontal.x;
  player.velocity.z = currentHorizontal.z;
  player.velocity.y -= 23.5 * dt;

  const nextX = player.position.x + player.velocity.x * dt;
  if (!circleHitsCollider(nextX, player.position.z, PLAYER_RADIUS)) {
    player.position.x = nextX;
  } else {
    player.velocity.x = 0;
  }

  const nextZ = player.position.z + player.velocity.z * dt;
  if (!circleHitsCollider(player.position.x, nextZ, PLAYER_RADIUS)) {
    player.position.z = nextZ;
  } else {
    player.velocity.z = 0;
  }

  player.position.y += player.velocity.y * dt;
  if (player.position.y <= 0) {
    player.position.y = 0;
    player.velocity.y = Math.max(0, player.velocity.y);
    player.grounded = true;
  }

  const targetEye = player.slideTimer > 0 ? 1.05 : PLAYER_EYE;
  player.eyeHeight = THREE.MathUtils.damp(player.eyeHeight, targetEye, 16, dt);
  camera.position.set(player.position.x, player.position.y + player.eyeHeight, player.position.z);
}

function hurtPlayer(amount) {
  if (state.gameOver || player.invulnerable > 0) return;
  const reduced = amount * (1 - state.stats.damageReduction);
  state.health = Math.max(0, state.health - reduced);
  state.damageFlash = Math.min(1, state.damageFlash + 0.62);
  audio.hurt();
  if (state.health <= 0) endGame();
}

function activateOverdrive() {
  if (state.overdrive < 100 || state.overdriveActive > 0 || state.gameOver) return;
  state.overdrive = 0;
  state.overdriveActive = state.stats.overdriveDuration;
  showAnnouncement("OVERDRIVE");
  audio.overdrive();
}

function startWave() {
  state.wave += 1;
  state.phase = "spawning";
  state.spawnRemaining = Math.min(8 + state.wave * 3, 42);
  state.spawnTimer = 0.2;
  state.health = Math.min(state.maxHealth, state.health + 15);
  if (state.wave === 1 || state.wave % 3 === 1) resetBarrels();
  showAnnouncement(`WAVE ${String(state.wave).padStart(2, "0")}`);
}

function updateWave(dt) {
  if (state.phase === "spawning") {
    state.spawnTimer -= dt;
    if (state.spawnRemaining > 0 && state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnRemaining -= 1;
      state.spawnTimer = Math.max(0.18, 0.62 - state.wave * 0.014);
    }
    if (state.spawnRemaining <= 0) state.phase = "combat";
  } else if (state.phase === "combat" && enemies.length === 0) {
    state.phase = "clear";
    state.clearTimer = 2.1;
    state.score += state.wave * 250;
    showAnnouncement("WAVE CLEAR");
  } else if (state.phase === "clear") {
    state.clearTimer -= dt;
    if (state.clearTimer <= 0) {
      if (state.wave % 2 === 0) {
        state.phase = "upgrade";
        showUpgradeSelection();
      } else {
        startWave();
      }
    }
  }
}

const UPGRADES = [
  { name: "HIGH VOLTAGE", desc: "全武器のダメージ +18%", apply: () => { state.stats.damage *= 1.18; } },
  { name: "OVERCLOCK", desc: "全武器の連射速度 +13%", apply: () => { state.stats.fireRate *= 1.13; } },
  { name: "REINFORCED CORE", desc: "最大HP +25、HPを全回復", apply: () => { state.maxHealth += 25; state.health = state.maxHealth; } },
  { name: "PHASE LEGS", desc: "移動速度 +10%", apply: () => { state.stats.moveSpeed *= 1.1; } },
  { name: "BLINK DRIVE", desc: "ダッシュの再使用時間 -20%", apply: () => { state.stats.dashCooldown *= 0.8; } },
  { name: "SPEED LOADER", desc: "リロード時間 -18%", apply: () => { state.stats.reloadSpeed *= 0.82; } },
  { name: "NANO SIPHON", desc: "敵を倒すたびHPを3回復", apply: () => { state.stats.healOnKill += 3; } },
  { name: "KINETIC SHELL", desc: "受けるダメージ -10%（最大40%）", apply: () => { state.stats.damageReduction = Math.min(0.4, state.stats.damageReduction + 0.1); } },
  { name: "EXTENDED SURGE", desc: "オーバードライブ時間 +25%", apply: () => { state.stats.overdriveDuration *= 1.25; } },
];

function showUpgradeSelection() {
  state.pausedForUpgrade = true;
  upgradeOptions.innerHTML = "";
  const choices = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
  choices.forEach((upgrade, index) => {
    const button = document.createElement("button");
    button.className = "upgrade-option";
    button.innerHTML = `<b>OPTION ${index + 1}</b><strong>${upgrade.name}</strong><span>${upgrade.desc}</span>`;
    button.addEventListener("click", () => {
      upgrade.apply();
      state.pausedForUpgrade = false;
      upgradeScreen.classList.remove("active");
      showToast(`${upgrade.name} INSTALLED`);
      audio.upgrade();
      startWave();
      controls.lock();
    }, { once: true });
    upgradeOptions.appendChild(button);
  });
  upgradeScreen.classList.add("active");
  controls.unlock();
}

function showAnnouncement(text) {
  const token = ++state.announcementToken;
  announcement.textContent = text;
  announcement.classList.remove("show");
  void announcement.offsetWidth;
  announcement.classList.add("show");
  setTimeout(() => {
    if (token === state.announcementToken) announcement.classList.remove("show");
  }, 2250);
}

function showToast(text) {
  const token = ++state.toastToken;
  toast.textContent = text;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  setTimeout(() => {
    if (token === state.toastToken) toast.classList.remove("show");
  }, 1450);
}

function resetGame() {
  clearEnemies();
  clearPickups();
  clearProjectiles();
  resetBarrels();

  state.gameOver = false;
  state.pausedForUpgrade = false;
  state.wave = 0;
  state.phase = "idle";
  state.score = 0;
  state.kills = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.maxHealth = 100;
  state.health = 100;
  state.overdrive = 0;
  state.overdriveActive = 0;
  state.damageFlash = 0;
  state.stats = createBaseStats();

  player.position.set(0, 0, 18);
  player.velocity.set(0, 0, 0);
  player.grounded = true;
  player.eyeHeight = PLAYER_EYE;
  player.slideTimer = 0;
  player.dashCooldown = 0;
  player.invulnerable = 0;
  camera.position.set(0, PLAYER_EYE, 18);
  camera.rotation.set(0, 0, 0);

  weaponStates = WEAPONS.map((weapon) => ({ ammo: weapon.magazine, cooldown: 0, reloading: false, reloadTimer: 0 }));
  currentWeapon = 0;
  buildWeaponModel(0);
  gameOverScreen.classList.remove("active");
  upgradeScreen.classList.remove("active");
  pauseScreen.classList.remove("active");
  hud.classList.remove("hidden");
  startWave();
}

function endGame() {
  if (state.gameOver) return;
  state.gameOver = true;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("neonRushBest", String(state.best));
  ui.finalScore.textContent = state.score.toLocaleString();
  ui.finalWave.textContent = String(state.wave);
  ui.finalKills.textContent = String(state.kills);
  gameOverScreen.classList.add("active");
  controls.unlock();
  audio.gameOver();
}

function fixedUpdate(dt) {
  if (!state.started || state.gameOver || state.pausedForUpgrade || !controls.isLocked) return;
  updatePlayer(dt);
  updateWeapon(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updatePickups(dt);
  updateWave(dt);
  impacts.update(dt);
  tracers.update(dt);
  shockwaves.update(dt);

  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer <= 0) state.combo = THREE.MathUtils.damp(state.combo, 1, 3, dt);
  state.overdriveActive = Math.max(0, state.overdriveActive - dt);
  state.damageFlash = Math.max(0, state.damageFlash - dt * 1.75);
}

function updateUi(dt, measuredFps) {
  state.uiTimer -= dt;
  if (state.uiTimer > 0) return;
  state.uiTimer = 0.075;
  const weapon = WEAPONS[currentWeapon];
  const weaponState = weaponStates[currentWeapon];
  const healthRatio = THREE.MathUtils.clamp(state.health / state.maxHealth, 0, 1);
  const dashRatio = 1 - THREE.MathUtils.clamp(player.dashCooldown / state.stats.dashCooldown, 0, 1);

  ui.score.textContent = String(Math.round(state.score)).padStart(6, "0");
  ui.wave.textContent = String(state.wave).padStart(2, "0");
  ui.combo.textContent = `x${state.combo.toFixed(2)}`;
  ui.fps.textContent = String(Math.round(measuredFps));
  ui.best.textContent = String(Math.round(state.best)).padStart(6, "0");
  ui.healthText.textContent = String(Math.ceil(state.health));
  ui.healthBar.style.transform = `scaleX(${healthRatio})`;
  ui.healthBar.style.background = healthRatio < 0.3 ? "linear-gradient(90deg, #ff365f, #ff9157)" : "";
  ui.dashText.textContent = player.dashCooldown <= 0 ? "READY" : `${player.dashCooldown.toFixed(1)}s`;
  ui.dashBar.style.transform = `scaleX(${dashRatio})`;
  ui.weaponName.textContent = weaponState.reloading ? "RELOADING..." : weapon.name;
  ui.ammo.textContent = String(weaponState.ammo).padStart(2, "0");
  ui.magazine.textContent = `/ ${weapon.magazine}`;
  ui.weaponMode.textContent = weapon.mode;

  if (state.overdriveActive > 0) {
    ui.overdriveText.textContent = `${state.overdriveActive.toFixed(1)}s`;
    ui.overdriveBar.style.transform = "scaleX(1)";
  } else {
    ui.overdriveText.textContent = `${Math.floor(state.overdrive)}%`;
    ui.overdriveBar.style.transform = `scaleX(${state.overdrive / 100})`;
  }

  damageVignette.style.opacity = String(state.damageFlash * 0.9);
  overdriveVignette.style.opacity = state.overdriveActive > 0 ? "0.85" : "0";
}

const audio = {
  context: null,
  noiseBuffer: null,

  init() {
    if (this.context) {
      this.context.resume();
      return;
    }
    this.context = new AudioContext();
    const length = this.context.sampleRate * 0.3;
    this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  },

  tone(startFrequency, endFrequency, duration, volume = 0.05, type = "sawtooth") {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  },

  noise(duration = 0.08, volume = 0.05, cutoff = 1200) {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start(now);
    source.stop(now + duration);
  },

  shot(index) {
    if (index === 0) { this.tone(190, 62, 0.055, 0.055, "square"); this.noise(0.04, 0.035, 1800); }
    if (index === 1) { this.tone(110, 38, 0.14, 0.09, "sawtooth"); this.noise(0.12, 0.11, 900); }
    if (index === 2) { this.tone(860, 92, 0.22, 0.075, "sawtooth"); this.tone(1220, 260, 0.12, 0.035, "sine"); }
  },
  hit(headshot) { this.tone(headshot ? 1250 : 760, headshot ? 620 : 420, 0.045, headshot ? 0.035 : 0.022, "sine"); },
  explosion(power = 0.6) { this.tone(95, 28, 0.34, 0.07 * power, "sawtooth"); this.noise(0.28, 0.11 * power, 600); },
  enemyShot() { this.tone(420, 180, 0.1, 0.018, "square"); },
  hurt() { this.tone(150, 65, 0.18, 0.06, "sawtooth"); },
  pickup() { this.tone(430, 960, 0.16, 0.04, "sine"); },
  reload() { this.tone(240, 170, 0.08, 0.025, "square"); },
  reloadDone() { this.tone(310, 520, 0.08, 0.03, "square"); },
  switchWeapon() { this.tone(180, 320, 0.07, 0.025, "triangle"); },
  slide() { this.noise(0.18, 0.03, 700); },
  jump() { this.tone(120, 180, 0.08, 0.018, "sine"); },
  dash() { this.tone(260, 62, 0.18, 0.06, "sawtooth"); this.noise(0.12, 0.04, 1500); },
  overdrive() { this.tone(120, 880, 0.5, 0.07, "sawtooth"); },
  upgrade() { this.tone(320, 1100, 0.32, 0.05, "sine"); },
  gameOver() { this.tone(260, 45, 0.8, 0.07, "sawtooth"); },
};

startButton.addEventListener("click", () => {
  audio.init();
  state.started = true;
  startScreen.classList.remove("active");
  resetGame();
  controls.lock();
});

resumeButton.addEventListener("click", () => {
  audio.init();
  controls.lock();
});

restartButton.addEventListener("click", () => {
  audio.init();
  resetGame();
  controls.lock();
});

controls.addEventListener("lock", () => {
  pauseScreen.classList.remove("active");
});

controls.addEventListener("unlock", () => {
  input.fire = false;
  input.aim = false;
  if (state.started && !state.gameOver && !state.pausedForUpgrade) pauseScreen.classList.add("active");
});

addEventListener("keydown", (event) => {
  input.keys.add(event.code);
  if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
  if (!controls.isLocked) return;
  if (event.code === "Space" && !event.repeat) input.jumpPressed = true;
  if ((event.code === "ControlLeft" || event.code === "KeyC") && !event.repeat) input.slidePressed = true;
  if (event.code === "KeyQ" && !event.repeat) input.dashPressed = true;
  if (event.code === "KeyF" && !event.repeat) activateOverdrive();
  if (event.code === "KeyR" && !event.repeat) startReload();
  if (event.code === "Digit1") switchWeapon(0);
  if (event.code === "Digit2") switchWeapon(1);
  if (event.code === "Digit3") switchWeapon(2);
});

addEventListener("keyup", (event) => {
  input.keys.delete(event.code);
});

addEventListener("mousedown", (event) => {
  if (!controls.isLocked) return;
  if (event.button === 0) {
    input.fire = true;
    input.firePressed = true;
  }
  if (event.button === 2) input.aim = true;
});

addEventListener("mouseup", (event) => {
  if (event.button === 0) input.fire = false;
  if (event.button === 2) input.aim = false;
});

addEventListener("mousemove", (event) => {
  if (!controls.isLocked) return;
  input.mouseX += event.movementX;
  input.mouseY += event.movementY;
});

addEventListener("wheel", (event) => {
  if (!controls.isLocked) return;
  const direction = event.deltaY > 0 ? 1 : -1;
  switchWeapon((currentWeapon + direction + WEAPONS.length) % WEAPONS.length);
}, { passive: true });

addEventListener("contextmenu", (event) => event.preventDefault());
addEventListener("blur", () => {
  input.keys.clear();
  input.fire = false;
  input.aim = false;
});

let renderScale = 1;
const maxPixelRatio = Math.min(devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(maxPixelRatio * renderScale);
let frameSamples = [];
let fpsSmoothed = 60;
let lastTime = performance.now();
let accumulator = 0;
let demoTime = 0;

function adaptResolution(frameMs) {
  frameSamples.push(frameMs);
  if (frameSamples.length < 150) return;
  const average = frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length;
  frameSamples = [];
  if (average > 19.2 && renderScale > 0.65) {
    renderScale = Math.max(0.65, renderScale - 0.1);
  } else if (average < 12.5 && renderScale < 1) {
    renderScale = Math.min(1, renderScale + 0.05);
  }
  renderer.setPixelRatio(maxPixelRatio * renderScale);
  ui.renderScale.textContent = `${Math.round(renderScale * 100)}%`;
}

function animate(now) {
  requestAnimationFrame(animate);
  const frameMs = Math.min(50, now - lastTime);
  const dt = frameMs / 1000;
  lastTime = now;
  fpsSmoothed = THREE.MathUtils.lerp(fpsSmoothed, 1000 / Math.max(1, frameMs), 0.08);
  adaptResolution(frameMs);

  if (!state.started) {
    demoTime += dt * 0.16;
    camera.position.set(Math.sin(demoTime) * 33, 10 + Math.sin(demoTime * 2) * 2, Math.cos(demoTime) * 33);
    camera.lookAt(0, 2.2, 0);
  } else {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 4) {
      fixedUpdate(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (steps === 4) accumulator = 0;
    updateWeaponRig(dt);
    const targetFov = input.aim ? 60 : (state.overdriveActive > 0 ? 80 : 76);
    camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 10, dt);
    camera.updateProjectionMatrix();
    crosshair.classList.toggle("expanded", input.fire || Math.hypot(player.velocity.x, player.velocity.z) > 10);
    updateUi(dt, fpsSmoothed);
  }

  renderer.render(scene, camera);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

ui.best.textContent = String(state.best).padStart(6, "0");
requestAnimationFrame(animate);

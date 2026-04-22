import * as THREE from "three";

const WIN_COINS = 20;
const PLAYER_RADIUS = 0.38;
const PLAYER_HEIGHT = 1.65;
const PLAYER_EYE = 1.45;
const GRAVITY = -28;
const JUMP_SPEED = 9.5;
const MOVE_ACCEL = 42;
const MOVE_FRICTION = 10;
const MAX_H_SPEED = 5.8;
const WHEEL_IMPULSE = 2.6;
const COIN_COLLECT_DIST = 1.15;
const COIN_RADIUS = 0.55;
/** Walkable top of the infinite grass floor (one solid slab, no holes). */
const FLOOR_Y = 0.45;
const PITCH_SENS = 0.00055;
const PITCH_SENS_LOCKED = 0.00022;
const MOUSE_FWD_GAIN = 0.00045;
const MOUSE_STRAFE_GAIN = 0.00135;
const YAW_KEY_SPEED = 1.05;

const app = document.querySelector("#app");

app.innerHTML = `
  <div id="overlay" class="overlay">
    <div class="overlay-card">
      <h1>Dragon Block Adventure — 3D</h1>
      <p>Click <strong>Play</strong> to start. Then <strong>click the blue game</strong> once if you want the mouse locked.</p>
      <ul class="overlay-list">
        <li><strong>Mouse left / right</strong> — step sideways (like Minecraft strafe)</li>
        <li><strong>Mouse up / down</strong> — look up and down (slow and smooth)</li>
        <li><strong>Arrow keys</strong> — turn left and right</li>
        <li><strong>Mouse wheel</strong> — walk forward or backward (works when the mouse is locked too)</li>
        <li><strong>Mouse up / down</strong> (locked) — also nudges you forward / back a little</li>
        <li><strong>Space</strong> — jump (left click also jumps when the mouse is locked)</li>
      </ul>
      <p class="overlay-hint"><kbd>W</kbd> <kbd>S</kbd> or <kbd>↑</kbd> <kbd>↓</kbd> walk, <kbd>A</kbd> <kbd>D</kbd> strafe.</p>
      <button id="playBtn" type="button">Play</button>
    </div>
  </div>
  <div id="hud" class="hud hidden">
    <span>Coins: <strong id="coins">0</strong> / ${WIN_COINS}</span>
    <span id="hint">Collect ${WIN_COINS} coins to win!</span>
  </div>
  <canvas id="game" tabindex="0" aria-label="3D block world"></canvas>
  <div id="winScreen" class="win-screen hidden" role="dialog" aria-live="polite">
    <div class="win-card">
      <h2>You win!</h2>
      <p>You collected ${WIN_COINS} coins. Great jumping!</p>
      <button id="restartBtn" type="button">Play again</button>
    </div>
  </div>
`;

const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const hud = document.querySelector("#hud");
const coinsEl = document.querySelector("#coins");
const hintEl = document.querySelector("#hint");
const winScreen = document.querySelector("#winScreen");
const playBtn = document.querySelector("#playBtn");
const restartBtn = document.querySelector("#restartBtn");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 160);

const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 220);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xb8e8ff, 0x6b8c4a, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5d6, 1.05);
sun.position.set(12, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
scene.add(sun);

const colliders = [];
const coins = [];

const grassMat = new THREE.MeshLambertMaterial({ color: 0x5bbf5a });
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a9099 });
const coinMat = new THREE.MeshStandardMaterial({
  color: 0xffd34d,
  metalness: 0.55,
  roughness: 0.35,
  emissive: 0x332200
});

function addColliderBox(minX, minY, minZ, maxX, maxY, maxZ, material, castShadow = true) {
  const w = maxX - minX;
  const h = maxY - minY;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(cx, cy, cz);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({
    min: new THREE.Vector3(minX, minY, minZ),
    max: new THREE.Vector3(maxX, maxY, maxZ)
  });
  return mesh;
}

function buildWorld() {
  const G = 140;
  const ymin = -10;
  addColliderBox(-G, ymin, -G, G, FLOOR_Y, G, grassMat, false);

  const wallH = 2.6;
  function wall(minX, minZ, maxX, maxZ) {
    addColliderBox(minX, FLOOR_Y, minZ, maxX, FLOOR_Y + wallH, maxZ, stoneMat);
  }

  wall(-9, 8, -4, 70);
  wall(6, 28, 10, 100);
  wall(-14, 88, 10, 92);
  wall(-26, 35, -5, 125);
  wall(14, -28, 18, 45);
  wall(-4, -35, 32, -30);
  wall(22, 55, 28, 118);
  wall(-32, -8, -26, 25);

  addColliderBox(-6, FLOOR_Y, 72, -1, FLOOR_Y + 1.15, 76, stoneMat);
  addColliderBox(4, FLOOR_Y, 108, 9, FLOOR_Y + 1.7, 113, stoneMat);
  addColliderBox(-18, FLOOR_Y, 48, -14, FLOOR_Y + 1.4, 54, stoneMat);

  addDragon(18, FLOOR_Y, -12);
}

function addDragon(x, y, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.7, 2),
    new THREE.MeshLambertMaterial({ color: 0xff5c9d })
  );
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.75, 0.9),
    new THREE.MeshLambertMaterial({ color: 0xff8ac4 })
  );
  head.position.set(0, 1.25, 1.1);
  head.castShadow = true;
  group.add(head);
  const wingL = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.5, 1.2),
    new THREE.MeshLambertMaterial({ color: 0xaa66ff })
  );
  wingL.position.set(-0.85, 1.05, 0.2);
  wingL.rotation.z = 0.35;
  wingL.castShadow = true;
  group.add(wingL);
  const wingR = wingL.clone();
  wingR.position.x = 0.85;
  wingR.rotation.z = -0.35;
  group.add(wingR);
  group.position.set(x, y, z);
  group.rotation.y = -0.6;
  scene.add(group);
}

function spawnCoins() {
  const y = FLOOR_Y + 0.55;
  const positions = [
    [0, y, 4],
    [6, y, 10],
    [-6, y, 14],
    [10, y, -6],
    [-10, y, 22],
    [3, y, 35],
    [-14, y, 48],
    [18, y, 60],
    [-8, y, 78],
    [12, y, 95]
  ];

  for (let i = 0; i < 42; i += 1) {
    const t = i * 0.72;
    const r = 5 + i * 0.55;
    positions.push([Math.cos(t) * r, y, Math.sin(t) * r + 18]);
  }

  for (let k = 0; k < 24; k += 1) {
    const ax = Math.sin(k * 1.4) * 28;
    const az = 8 + k * 5.5;
    positions.push([ax, y, az]);
  }

  const geo = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, 0.12, 20);
  for (const [x, y, z] of positions) {
    const mesh = new THREE.Mesh(geo, coinMat.clone());
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.userData.spin = Math.random() * Math.PI * 2;
    mesh.userData.collected = false;
    scene.add(mesh);
    coins.push(mesh);
  }
}

buildWorld();
spawnCoins();

let coinsCollected = 0;
let gameWon = false;

const spawnPoint = new THREE.Vector3(0, FLOOR_Y + 0.02, 4);
const playerPos = spawnPoint.clone();
const vel = new THREE.Vector3();

let yaw = 0;
let pitch = 0;
const pitchClamp = Math.PI / 2 - 0.12;

let wishForward = 0;
let wishStrafe = 0;
let jumpPressed = false;

const keys = {
  w: false,
  s: false,
  a: false,
  d: false,
  left: false,
  right: false,
  up: false,
  down: false
};

let gameStarted = false;

function pointerOverCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return (
    e.clientX >= r.left &&
    e.clientX <= r.right &&
    e.clientY >= r.top &&
    e.clientY <= r.bottom
  );
}

function setHint(text) {
  if (hintEl) hintEl.textContent = text;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function forwardFlat() {
  const v = new THREE.Vector3(0, 0, -1);
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  v.y = 0;
  if (v.lengthSq() > 0.0001) v.normalize();
  return v;
}

function rightFlat() {
  const f = forwardFlat();
  return new THREE.Vector3(-f.z, 0, f.x);
}

function updateHUD() {
  coinsEl.textContent = String(coinsCollected);
}

function collectCoins() {
  const p = playerPos;
  for (const mesh of coins) {
    if (mesh.userData.collected) continue;
    const dx = mesh.position.x - p.x;
    const dy = mesh.position.y - (p.y + PLAYER_HEIGHT * 0.5);
    const dz = mesh.position.z - p.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < COIN_COLLECT_DIST) {
      mesh.userData.collected = true;
      mesh.visible = false;
      coinsCollected += 1;
      updateHUD();
      if (coinsCollected >= WIN_COINS) {
        winGame();
      }
    }
  }
}

function winGame() {
  if (gameWon) return;
  gameWon = true;
  document.exitPointerLock?.();
  winScreen.classList.remove("hidden");
}

function restartGame() {
  gameWon = false;
  winScreen.classList.add("hidden");
  playerPos.copy(spawnPoint);
  vel.set(0, 0, 0);
  yaw = 0;
  pitch = 0;
  wishForward = 0;
  wishStrafe = 0;
  coinsCollected = 0;
  for (const mesh of coins) {
    mesh.userData.collected = false;
    mesh.visible = true;
  }
  updateHUD();
}

function playerMinMax(outMin, outMax) {
  outMin.set(
    playerPos.x - PLAYER_RADIUS,
    playerPos.y,
    playerPos.z - PLAYER_RADIUS
  );
  outMax.set(
    playerPos.x + PLAYER_RADIUS,
    playerPos.y + PLAYER_HEIGHT,
    playerPos.z + PLAYER_RADIUS
  );
}

function checkOnGround() {
  const foot = playerPos.y;
  const eps = 0.14;
  const topSnap = 0.22;
  playerMinMax(tmpMin, tmpMax);
  for (const b of colliders) {
    if (tmpMax.x <= b.min.x || tmpMin.x >= b.max.x) continue;
    if (tmpMax.z <= b.min.z || tmpMin.z >= b.max.z) continue;
    if (foot >= b.max.y - eps && foot <= b.max.y + topSnap && vel.y <= 0.35) {
      return true;
    }
  }
  return false;
}

const tmpMin = new THREE.Vector3();
const tmpMax = new THREE.Vector3();

function aabbOverlap(minA, maxA, minB, maxB) {
  const e = 0.02;
  return (
    minA.x < maxB.x + e &&
    maxA.x > minB.x - e &&
    minA.y < maxB.y + e &&
    maxA.y > minB.y - e &&
    minA.z < maxB.z + e &&
    maxA.z > minB.z - e
  );
}

function resolveCollisionsOnce() {
  for (let axis = 0; axis < 3; axis += 1) {
    for (const box of colliders) {
      playerMinMax(tmpMin, tmpMax);
      if (!aabbOverlap(tmpMin, tmpMax, box.min, box.max)) continue;

      if (axis === 0) {
        const penLeft = tmpMax.x - box.min.x;
        const penRight = box.max.x - tmpMin.x;
        if (penLeft < penRight) playerPos.x -= penLeft + 0.001;
        else playerPos.x += penRight + 0.001;
        vel.x = 0;
      } else if (axis === 2) {
        const penBack = tmpMax.z - box.min.z;
        const penFront = box.max.z - tmpMin.z;
        if (penBack < penFront) playerPos.z -= penBack + 0.001;
        else playerPos.z += penFront + 0.001;
        vel.z = 0;
      } else {
        const penDown = tmpMax.y - box.min.y;
        const penUp = box.max.y - tmpMin.y;
        if (penDown < penUp) {
          playerPos.y -= penDown + 0.001;
          if (vel.y > 0) vel.y = 0;
        } else {
          playerPos.y += penUp + 0.001;
          if (vel.y < 0) {
            vel.y = 0;
          }
        }
      }
    }
  }
}

function resolveCollisions() {
  for (let pass = 0; pass < 5; pass += 1) {
    resolveCollisionsOnce();
  }
}

function updatePhysics(dt) {
  if (!gameStarted || gameWon) return;

  if (keys.left) yaw += YAW_KEY_SPEED * dt;
  if (keys.right) yaw -= YAW_KEY_SPEED * dt;

  const forward = forwardFlat();
  const right = rightFlat();
  const inputFwd =
    wishForward +
    (keys.w ? 1 : 0) -
    (keys.s ? 1 : 0) +
    (keys.up ? 1 : 0) -
    (keys.down ? 1 : 0);
  const inputStrafe = wishStrafe + (keys.a ? 1 : 0) - (keys.d ? 1 : 0);
  const target = new THREE.Vector3()
    .addScaledVector(forward, inputFwd * MAX_H_SPEED)
    .addScaledVector(right, inputStrafe * MAX_H_SPEED);

  vel.x += (target.x - vel.x) * Math.min(1, MOVE_ACCEL * dt);
  vel.z += (target.z - vel.z) * Math.min(1, MOVE_ACCEL * dt);

  const hLen = Math.hypot(vel.x, vel.z);
  if (hLen > MAX_H_SPEED) {
    const s = MAX_H_SPEED / hLen;
    vel.x *= s;
    vel.z *= s;
  }

  if (inputFwd === 0 && inputStrafe === 0) {
    const fr = Math.exp(-MOVE_FRICTION * dt);
    vel.x *= fr;
    vel.z *= fr;
    if (Math.hypot(vel.x, vel.z) < 0.05) {
      vel.x = 0;
      vel.z = 0;
    }
  }

  vel.y += GRAVITY * dt;

  if (jumpPressed && checkOnGround()) {
    vel.y = JUMP_SPEED;
  }
  jumpPressed = false;

  playerPos.x += vel.x * dt;
  resolveCollisions();
  playerPos.z += vel.z * dt;
  resolveCollisions();
  playerPos.y += vel.y * dt;
  resolveCollisions();

  if (playerPos.y < FLOOR_Y - 12) {
    playerPos.copy(spawnPoint);
    vel.set(0, 0, 0);
  }

  wishForward *= Math.exp(-4 * dt);
  wishStrafe *= Math.exp(-4 * dt);
}

function syncCamera() {
  camera.position.copy(playerPos);
  camera.position.y += PLAYER_EYE;
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (gameStarted && !gameWon) {
    updatePhysics(dt);
    collectCoins();
  }

  for (const mesh of coins) {
    if (mesh.userData.collected) continue;
    mesh.userData.spin += dt * 2.2;
    mesh.rotation.z = mesh.userData.spin;
  }

  syncCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

canvas.addEventListener("click", () => {
  if (!gameStarted || gameWon) return;
  if (document.pointerLockElement !== canvas) {
    try {
      const p = canvas.requestPointerLock?.();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          setHint("Move the mouse over the game to look. Space = jump.");
        });
      }
    } catch {
      setHint("Move the mouse over the game to look. Space = jump.");
    }
  }
});

playBtn.addEventListener("click", () => {
  overlay.remove();
  hud.classList.remove("hidden");
  gameStarted = true;
  canvas.focus();
  setHint("←→ turn. ↑↓ or W/S or wheel = walk. Mouse = strafe + look. Space = jump.");
});

restartBtn.addEventListener("click", () => {
  restartGame();
  document.exitPointerLock?.();
  setHint("←→ turn. ↑↓ or W/S or wheel = walk. Mouse strafes / looks. Space = jump.");
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    setHint("Coins: 20 to win. ↑↓ W/S wheel = move. Esc frees mouse.");
  } else if (gameStarted && !gameWon) {
    setHint("Click the game to lock the mouse again, or play without lock.");
  }
});

document.addEventListener("pointerlockerror", () => {
  if (gameStarted && !gameWon) {
    setHint("Mouse lock blocked — move the mouse over the blue game to look. Space = jump.");
  }
});

document.addEventListener("mousemove", (e) => {
  if (!gameStarted || gameWon) return;

  const locked = document.pointerLockElement === canvas;
  const over = pointerOverCanvas(e);

  if (locked) {
    wishStrafe += e.movementX * MOUSE_STRAFE_GAIN;
    wishStrafe = Math.max(-1.35, Math.min(1.35, wishStrafe));
    wishForward += -e.movementY * MOUSE_FWD_GAIN;
    wishForward = Math.max(-1.35, Math.min(1.35, wishForward));
    pitch -= e.movementY * PITCH_SENS_LOCKED;
  } else if (over) {
    wishStrafe += e.movementX * MOUSE_STRAFE_GAIN;
    wishStrafe = Math.max(-1.35, Math.min(1.35, wishStrafe));
    pitch -= e.movementY * PITCH_SENS;
  }

  pitch = Math.max(-pitchClamp, Math.min(pitchClamp, pitch));
});

function applyWheelWish(deltaY) {
  const step = (deltaY > 0 ? -1 : 1) * WHEEL_IMPULSE * 0.28;
  wishForward += step;
  wishForward = Math.max(-1.35, Math.min(1.35, wishForward));
}

document.addEventListener(
  "wheel",
  (e) => {
    if (!gameStarted || gameWon) return;
    const locked = document.pointerLockElement === canvas;
    if (!locked && !pointerOverCanvas(e)) return;
    e.preventDefault();
    applyWheelWish(e.deltaY);
  },
  { passive: false }
);

canvas.addEventListener("mousedown", (e) => {
  if (!gameStarted || gameWon) return;
  if (e.button === 0 && document.pointerLockElement === canvas) {
    jumpPressed = true;
  }
});

document.addEventListener("keydown", (e) => {
  if (!gameStarted || gameWon) return;
  if (e.code === "KeyW") keys.w = true;
  if (e.code === "KeyS") keys.s = true;
  if (e.code === "KeyA") keys.a = true;
  if (e.code === "KeyD") keys.d = true;
  if (e.code === "ArrowLeft") {
    e.preventDefault();
    keys.left = true;
  }
  if (e.code === "ArrowRight") {
    e.preventDefault();
    keys.right = true;
  }
  if (e.code === "ArrowUp") {
    e.preventDefault();
    keys.up = true;
  }
  if (e.code === "ArrowDown") {
    e.preventDefault();
    keys.down = true;
  }
  if (e.code === "Space") {
    e.preventDefault();
    jumpPressed = true;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "KeyW") keys.w = false;
  if (e.code === "KeyS") keys.s = false;
  if (e.code === "KeyA") keys.a = false;
  if (e.code === "KeyD") keys.d = false;
  if (e.code === "ArrowLeft") keys.left = false;
  if (e.code === "ArrowRight") keys.right = false;
  if (e.code === "ArrowUp") keys.up = false;
  if (e.code === "ArrowDown") keys.down = false;
});

updateHUD();

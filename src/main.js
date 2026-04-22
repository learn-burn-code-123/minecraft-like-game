import * as THREE from "three";

const WIN_COINS = 20;
const PLAYER_RADIUS = 0.38;
const PLAYER_HEIGHT = 1.65;
const PLAYER_EYE = 1.45;
const GRAVITY = -28;
const JUMP_SPEED = 9.5;
const MOVE_ACCEL = 42;
const MOVE_FRICTION = 10;
const MAX_H_SPEED = 6.5;
const WHEEL_IMPULSE = 2.8;
const COIN_RADIUS = 0.55;
const COIN_COLLECT_DIST = 1.15;

const app = document.querySelector("#app");

app.innerHTML = `
  <div id="overlay" class="overlay">
    <div class="overlay-card">
      <h1>Dragon Block Adventure — 3D</h1>
      <p>Click <strong>Play</strong>, then <strong>click the blue game area once</strong> so the mouse can steer (browsers require this).</p>
      <ul class="overlay-list">
        <li><strong>Mouse wheel</strong> — roll it to walk forward or backward (try both directions)</li>
        <li><strong>Left click</strong> — jump when your feet are on a block</li>
        <li><strong>Move the mouse</strong> — look around and steer across blocks and gaps</li>
      </ul>
      <p class="overlay-hint">Optional: <kbd>W</kbd> / <kbd>S</kbd> also move forward and back.</p>
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
scene.fog = new THREE.Fog(0x87ceeb, 18, 55);

const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 120);
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
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -28;
sun.shadow.camera.right = 28;
sun.shadow.camera.top = 28;
sun.shadow.camera.bottom = -28;
scene.add(sun);

const colliders = [];
const coins = [];

const grassMat = new THREE.MeshLambertMaterial({ color: 0x5bbf5a });
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a9099 });
const dirtMat = new THREE.MeshLambertMaterial({ color: 0x8b5a3c });
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
  addColliderBox(-40, -1, -40, 40, 0, 40, grassMat, false);

  const course = [
    { x: 0, z: 0, w: 5, d: 5, y: 0 },
    { x: 0, z: 4.5, w: 3, d: 2.2, y: 0 },
    { x: 0, z: 8.5, w: 4, d: 3, y: 0 },
    { x: -2.5, z: 12, w: 3, d: 3, y: 1 },
    { x: 2.5, z: 15, w: 3, d: 3, y: 0 },
    { x: 0, z: 19, w: 5, d: 4, y: 0 },
    { x: 0, z: 24, w: 2.5, d: 2, y: 2 },
    { x: -3, z: 27, w: 3.5, d: 3, y: 0 },
    { x: 3, z: 30, w: 3.5, d: 3, y: 1 },
    { x: 0, z: 34, w: 6, d: 5, y: 0 }
  ];

  for (const p of course) {
    const halfW = p.w / 2;
    const halfD = p.d / 2;
    const baseY = p.y ?? 0;
    addColliderBox(
      p.x - halfW,
      baseY,
      p.z - halfD,
      p.x + halfW,
      baseY + 0.45,
      p.z + halfD,
      grassMat
    );
    addColliderBox(
      p.x - halfW,
      baseY - 0.6,
      p.z - halfD,
      p.x + halfW,
      baseY,
      p.z + halfD,
      dirtMat,
      false
    );
  }

  addColliderBox(-1.2, 0, 6, 1.2, 2.2, 1.2, stoneMat);
  addColliderBox(2, 0, 10, 3.4, 1.4, 11.4, stoneMat);
  addColliderBox(-3.5, 1, 16, -2.2, 2.6, 17.2, stoneMat);
  addColliderBox(1.5, 0, 22, 3.8, 1.8, 24, stoneMat);
  addColliderBox(-2.8, 2, 24, -1.2, 3.4, 25.2, stoneMat);
  addColliderBox(-4, 0, 20, -3, 1.2, 28, stoneMat);

  addDragon(5.5, 0, -4);
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
  const positions = [
    [0, 1.1, 0],
    [0, 1.2, 3],
    [0, 1.2, 7],
    [-2.2, 2.3, 12],
    [2.4, 1.2, 15],
    [0, 1.3, 19],
    [0, 3.5, 24],
    [-3, 1.3, 27],
    [3, 2.3, 30],
    [0, 1.4, 34],
    [1.2, 1.5, 8],
    [-1.5, 1.5, 5],
    [2.6, 1.5, 19],
    [-2, 1.5, 22],
    [0, 1.5, 11],
    [-2.8, 3.8, 24.5],
    [3.2, 1.5, 28],
    [-1, 1.5, 16],
    [1.5, 1.5, 26],
    [0, 1.5, 29],
    [-3.2, 1.5, 31],
    [2, 1.5, 6],
    [0, 1.5, 14],
    [1, 1.5, 32],
    [-1.2, 1.5, 33],
    [2.2, 1.5, 35],
    [-2.5, 1.5, 35],
    [0, 1.5, 36]
  ];

  const geo = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, 0.12, 20);
  for (const [cx, cy, cz] of positions) {
    const mesh = new THREE.Mesh(geo, coinMat.clone());
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(cx, cy, cz);
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

const spawnPoint = new THREE.Vector3(0, 0.05, 0);
const playerPos = spawnPoint.clone();
const vel = new THREE.Vector3();

let yaw = 0;
let pitch = 0;
const pitchClamp = Math.PI / 2 - 0.12;

let wishForward = 0;
let jumpPressed = false;

const keys = { w: false, s: false };

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
  return (
    minA.x < maxB.x &&
    maxA.x > minB.x &&
    minA.y < maxB.y &&
    maxA.y > minB.y &&
    minA.z < maxB.z &&
    maxA.z > minB.z
  );
}

function resolveCollisions() {
  playerMinMax(tmpMin, tmpMax);

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

function updatePhysics(dt) {
  if (!gameStarted || gameWon) return;

  const forward = forwardFlat();
  const inputFwd = wishForward + (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const target = forward.clone().multiplyScalar(inputFwd * MAX_H_SPEED);

  vel.x += (target.x - vel.x) * Math.min(1, MOVE_ACCEL * dt);
  vel.z += (target.z - vel.z) * Math.min(1, MOVE_ACCEL * dt);

  const hLen = Math.hypot(vel.x, vel.z);
  if (hLen > MAX_H_SPEED) {
    const s = MAX_H_SPEED / hLen;
    vel.x *= s;
    vel.z *= s;
  }

  if (inputFwd === 0) {
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

  if (playerPos.y < -12) {
    playerPos.copy(spawnPoint);
    vel.set(0, 0, 0);
  }

  wishForward *= Math.exp(-4 * dt);
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
    canvas.requestPointerLock?.().catch(() => {
      setHint("Move the mouse over the game to look. Space = jump.");
    });
  }
});

playBtn.addEventListener("click", () => {
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  gameStarted = true;
  canvas.focus();
  setHint("Click the blue game once, then move the mouse. Wheel = walk. Space = jump.");
});

restartBtn.addEventListener("click", () => {
  restartGame();
  document.exitPointerLock?.();
  setHint("Click the blue game once, then move the mouse.");
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    setHint("Coins: collect 20. Wheel = walk. Left click or Space = jump. Esc = free mouse.");
  } else if (gameStarted && !gameWon) {
    setHint("Click the game to grab the mouse again, or move over it to look.");
  }
});

document.addEventListener("pointerlockerror", () => {
  if (gameStarted && !gameWon) {
    setHint("Mouse lock blocked — move the mouse over the blue game to look. Space = jump.");
  }
});

document.addEventListener("mousemove", (e) => {
  if (!gameStarted || gameWon) return;

  if (document.pointerLockElement === canvas) {
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0022;
  } else if (pointerOverCanvas(e)) {
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0022;
  }

  pitch = Math.max(-pitchClamp, Math.min(pitchClamp, pitch));
});

canvas.addEventListener(
  "wheel",
  (e) => {
    if (!gameStarted || gameWon) return;
    if (!pointerOverCanvas(e) && document.pointerLockElement !== canvas) return;
    e.preventDefault();
    const step = (e.deltaY > 0 ? -1 : 1) * WHEEL_IMPULSE * 0.22;
    wishForward += step;
    wishForward = Math.max(-1.2, Math.min(1.2, wishForward));
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
  if (e.code === "Space") {
    e.preventDefault();
    jumpPressed = true;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "KeyW") keys.w = false;
  if (e.code === "KeyS") keys.s = false;
});

updateHUD();

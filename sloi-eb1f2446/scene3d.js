// Реалистичный 3D-стакан (Three.js): стекло с отражениями, слои жидкости, лёд, трубочка.
// Если WebGL недоступен, остаётся плоский SVG-стакан из index.html.
import * as THREE from "three";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { RGBELoader } from "./vendor/RGBELoader.js";

const stage = document.querySelector(".stage");
const state = window.__sloiState || { p: 0, stage: 0 };
// Режим постера: poster.html рисует один стакан по рецепту на белом и чёрном фоне, из пары кадров получается PNG с прозрачностью
const RECIPES = {
  1: { c: ["#2a140a", "#7b4a2b", "#ecd9b9", "#fff6e6"], b: [0.7, 0.95, 1.55], ice: 5 }, // слои
  2: { c: ["#d3801a", "#3a1d0e", "#efdcbc", "#fff2dc"], b: [0.5, 0.78, 1.6], ice: 4 },  // мёд-латте
  3: { c: ["#cfe0d6", "#cfe0d6", "#4a2a18", "#2a140a"], b: [0.5, 1.5, 1.72], ice: 5 }, // эспрессо-тоник
  4: { c: ["#f1e3c8", "#f1e3c8", "#7e9a3a", "#fff6e6"], b: [0.5, 0.9, 1.66], ice: 3 }, // матча
};

// ---------- размеры стакана (единицы сцены) ----------
const H = 2.2, R_TOP = 0.68, R_BOT = 0.5, FLOOR = 0.2;
const rIn = (y) => R_BOT + ((y - FLOOR) / (H - FLOOR)) * (R_TOP - 0.03 - R_BOT); // внутренний радиус на высоте y

// ---------- рендерер ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
} catch (e) {
  console.warn("WebGL недоступен, оставляем плоский стакан", e);
}
if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.className = "gl";
  if (state.poster) renderer.setClearColor(new THREE.Color(state.bg || "#ffffff"), 1);
  stage.prepend(renderer.domElement);
  document.documentElement.classList.add("gl");

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture; // запасное освещение, пока грузится студийное
  // настоящий студийный HDRI (Poly Haven, CC0): мягкие софтбоксы дают чёткие блики на стекле
  new RGBELoader().load("./vendor/studio.hdr", (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
  }, undefined, () => {});

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const world = new THREE.Group(); // сюда кладём всё, чтобы масштабировать под экран
  scene.add(world);

  // ---------- стекло ----------
  const glassProfile = [
    [0.0, 0.0], [0.38, 0.0], [0.47, 0.012], [0.52, 0.06], [0.535, 0.13],
    [R_TOP, H], [R_TOP - 0.012, H + 0.014], [R_TOP - 0.03, H],
    [R_BOT + 0.005, FLOOR + 0.03], [R_BOT - 0.04, FLOOR + 0.002], [0.0, FLOOR],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // Стенки: чистое стекло без мути. Рисуем только отражения студийного света и добавляем их поверх сцены.
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(glassProfile, 128),
    new THREE.MeshStandardMaterial({
      color: 0x000000, metalness: 0, roughness: 0.04, envMapIntensity: 0.2,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  glass.renderOrder = 5;
  // тёмная кромка по краю стекла (так стекло видно на светлом фоне)
  const rim = new THREE.Mesh(
    glass.geometry,
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(0.10, 0.06, 0.04, clamp(f * 0.8, 0.0, 0.7)); }",
    })
  );
  rim.renderOrder = 4;
  world.add(rim, glass);

  // ---------- жидкость: один объём, слои красятся по высоте в шейдере ----------
  const liquidProfile = [[0, FLOOR + 0.01]];
  for (let i = 0; i <= 24; i++) {
    const y = FLOOR + 0.01 + (i / 24) * (H - 0.35);
    liquidProfile.push([rIn(y) * 0.985, y]);
  }
  const uniforms = {
    uLevel: { value: 0 },
    uEsp: { value: new THREE.Color("#2a140a") },
    uMid: { value: new THREE.Color("#7b4a2b") },
    uMilk: { value: new THREE.Color("#ecd9b9") },
    uFoam: { value: new THREE.Color("#fff6e6") },
    uB: { value: new THREE.Vector4(0.7, 0.95, 1.55, 0.13) }, // низ смеси, верх смеси, начало пены, мягкость
    uWorld: { value: new THREE.Vector2(0, 1) }, // сдвиг и масштаб группы world, чтобы считать высоту в единицах стакана
  };
  const liquidMat = new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0, clearcoat: 0.25, envMapIntensity: 1.25, side: THREE.DoubleSide });
  liquidMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vY;\nuniform vec2 uWorld;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvY = ((modelMatrix * vec4(transformed, 1.0)).y - uWorld.x) / uWorld.y;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying float vY;
uniform float uLevel; uniform vec3 uEsp, uMid, uMilk, uFoam; uniform vec4 uB;
vec3 liquidColor(float y) {
  float s = uB.w;
  vec3 c = mix(uEsp, uMid, smoothstep(uB.x - s, uB.x + s, y));
  c = mix(c, uMilk, smoothstep(uB.y - s, uB.y + s, y));
  c = mix(c, uFoam, smoothstep(uB.z - s * 0.6, uB.z + s * 0.6, y));
  return c;
}`)
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "if (vY > uLevel + 0.003) discard;\nvec4 diffuseColor = vec4( liquidColor(vY), opacity );");
  };
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liquidProfile.map(([x, y]) => new THREE.Vector2(x, y)), 96), liquidMat);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(1, 96), liquidMat);
  cap.rotation.x = -Math.PI / 2;
  world.add(liquid, cap);

  const GAP = 0.9; // шаг между «слоями» подъёма уровня
  function setLevel(y) {
    uniforms.uLevel.value = y;
    cap.position.y = y;
    const r = rIn(Math.max(y, FLOOR + 0.02)) * 0.985;
    cap.scale.set(r, r, 1);
    cap.visible = y > FLOOR + 0.03;
  }

  // ---------- фон со словами: рисуем на canvas, стекло преломляет буквы ----------
  const WORDS = [["слои", 27], ["эспрессо", 14.2], ["молоко", 18], ["пена", 27], ["лёд", 35]];
  const wordAlpha = [1, 0, 0, 0, 0];
  let wordTarget = 0;
  const bgCanvas = document.createElement("canvas");
  const bgTex = new THREE.CanvasTexture(bgCanvas);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: bgTex, toneMapped: false }));
  const BG_Z = 13;
  bgMesh.visible = !state.poster;
  bgMesh.position.set(0, 0, -BG_Z);
  camera.add(bgMesh);
  scene.add(camera);

  function drawBg() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const k = Math.min(1, 2200 / Math.max(w, h)) * Math.min(window.devicePixelRatio || 1, 2);
    bgCanvas.width = Math.round(w * k); bgCanvas.height = Math.round(h * k);
    const c = bgCanvas.getContext("2d");
    c.scale(k, k);
    const g = c.createRadialGradient(w / 2, h * 1.1, 0, w / 2, h * 1.1, h * 1.1);
    g.addColorStop(0, "#e6d6bd"); g.addColorStop(0.6, "#f1e9dc"); g.addColorStop(1, "#f1e9dc");
    c.fillStyle = "#f1e9dc"; c.fillRect(0, 0, w, h);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const portrait = w < 700;
    c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillStyle = "#1a0f0a";
    if ("letterSpacing" in c) c.letterSpacing = "-0.04em";
    WORDS.forEach(([text, vw], i) => {
      const a = wordAlpha[i];
      if (a < 0.01) return;
      const fs = Math.min((vw * w) / 100, 0.56 * h);
      c.font = `600 ${fs}px Unbounded, "Arial Black", sans-serif`;
      let cy = portrait ? 0.11 * h + fs * 0.78 : h * 0.5 + fs * 0.34;
      if (i === 4 && !portrait) cy -= 0.12 * h;
      c.globalAlpha = a;
      c.fillText(text, w / 2, cy + (1 - a) * 0.06 * fs);
    });
    c.globalAlpha = 1;
    bgTex.needsUpdate = true;
  }
  document.fonts?.ready.then(() => { drawBg(); dirty = true; });

  // ---------- тень на столе ----------
  const sh = document.createElement("canvas"); sh.width = sh.height = 128;
  const sc = sh.getContext("2d"), sg = sc.createRadialGradient(64, 64, 0, 64, 64, 64);
  sg.addColorStop(0, "rgba(26,15,10,.42)"); sg.addColorStop(1, "rgba(26,15,10,0)");
  sc.fillStyle = sg; sc.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.004; shadow.renderOrder = 1;
  world.add(shadow);

  // ---------- трубочка в красно-белую полоску ----------
  const st = document.createElement("canvas"); st.width = 16; st.height = 64;
  const stc = st.getContext("2d");
  stc.fillStyle = "#f3eee4"; stc.fillRect(0, 0, 16, 64); stc.fillStyle = "#b4492b"; stc.fillRect(0, 0, 16, 9);
  const stripeTex = new THREE.CanvasTexture(st);
  stripeTex.colorSpace = THREE.SRGBColorSpace; stripeTex.wrapT = THREE.RepeatWrapping; stripeTex.repeat.set(1, 22);
  const base = new THREE.Vector3(0.12, 0.3, 0.04), top = new THREE.Vector3(-0.1, 3.0, -0.02);
  const dir = top.clone().sub(base);
  const straw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, dir.length(), 20, 1, true),
    new THREE.MeshPhysicalMaterial({ map: stripeTex, roughness: 0.62, clearcoat: 0.12, side: THREE.DoubleSide })
  );
  straw.position.copy(base).addScaledVector(dir, 0.5);
  straw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  world.add(straw);

  // ---------- лёд ----------
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transmission: 1, thickness: 0.32, ior: 1.31, roughness: 0.07, metalness: 0,
    envMapIntensity: 1.5, attenuationColor: new THREE.Color(0xbfe0f2), attenuationDistance: 0.9,
    specularIntensity: 1, side: THREE.DoubleSide,
  });
  const iceSpec = [[-0.14, 2.0, 0.05, 0.3, 0.3], [0.14, 2.08, -0.06, 0.28, -0.5], [0.0, 1.95, 0.2, 0.27, 0.8], [0.2, 1.9, 0.1, 0.25, -0.2], [-0.2, 1.9, -0.12, 0.26, 1.1]];
  const ice = iceSpec.map(([x, y, z, size, rot], i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(size, size, size, 5, 0.05), iceMat);
    m.userData = { x, y, z, rot, phase: i * 1.7 };
    m.position.set(x, y, z);
    m.rotation.set(rot, rot * 1.7, rot * 0.6);
    m.visible = false;
    world.add(m);
    return m;
  });

  // ---------- заготовка для лёгких доработок (лёд, трубочка, фон) ----------
  const api = { THREE, scene, camera, world, renderer, setLevel, uniforms, rIn, H, glass, liquid, cap };
  window.__sloiGL = api;
  setLevel(1.86);

  let lastW = 0, lastH = 0;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    // панели браузера на телефоне меняют высоту на 50–150 px: не перерисовываем сцену из-за этого
    if (lastW && w === lastW && Math.abs(h - lastH) < 160) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + "px";
    renderer.domElement.style.height = h + "px";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    layout(w, h);
  }
  function layout(w, h) {
    const portrait = w < 700 || h > w;
    const dist = 9;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    const vis = 2 * dist * Math.tan((camera.fov * Math.PI) / 360); // высота видимой области на глубине стакана
    const frac = portrait ? 0.38 : 0.56; // какую долю высоты экрана занимает стакан
    const s = (vis * frac) / H;
    const centerFrac = portrait ? 0.6 : 0.6; // где по вертикали центр стакана (от верха экрана)
    world.scale.setScalar(s);
    world.position.y = (0.5 - centerFrac) * vis - (H / 2) * s;
    if (state.poster) { // стакан с трубочкой по центру кадра
      const sp = (0.9 * vis) / 3.1;
      world.scale.setScalar(sp);
      world.position.y = -1.5 * sp;
      uniforms.uWorld.value.set(world.position.y, sp);
      bgMesh.scale.set(1e-3, 1e-3, 1);
      api.vis = vis;
      return;
    }
    uniforms.uWorld.value.set(world.position.y, s);
    const bh = 2 * BG_Z * Math.tan((camera.fov * Math.PI) / 360);
    bgMesh.scale.set(bh * camera.aspect, bh, 1);
    api.vis = vis;
    api.portrait = portrait;
    drawBg();
  }
  addEventListener("resize", resize);

  // ---------- прогресс прокрутки -> уровень жидкости, лёд, камера ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const seg = (p, a, b) => ease(clamp((p - a) / (b - a)));
  let progress = state.p || 0, dirty = true, running = true;
  const wordsAlphaLerp = () => {
    let moved = false;
    wordAlpha.forEach((a, i) => {
      const t = i === wordTarget ? 1 : 0, n = Math.abs(t - a) < 0.02 ? t : a + (t - a) * 0.18;
      if (n !== a) { wordAlpha[i] = n; moved = true; }
    });
    if (moved) drawBg();
  };
  function applyProgress(p) {
    progress = p;
    const lv = FLOOR + (0.74 - FLOOR) * seg(p, 0.10, 0.34)
      + (1.55 - 0.74) * seg(p, 0.34, 0.60) + (1.86 - 1.55) * seg(p, 0.60, 0.78);
    setLevel(p < 0.1 ? 0 : lv);
    const ik = seg(p, 0.78, 0.95);
    ice.forEach((m, i) => { const k = clamp(ik * 1.6 - i * 0.12); m.visible = k > 0.01; m.scale.setScalar(0.5 + 0.5 * k); });
    straw.rotation.z = 0; // трубочка неподвижна, двигается камера
    const eye = 1.2 * ease(clamp((p - 0.2) / 0.7)); // камера плавно поднимается над стаканом
    camera.position.set(0, eye, 9);
    camera.lookAt(0, 0, 0);
    dirty = true;
  }
  api.onProgress = applyProgress;
  if (state.poster) {
    const r = RECIPES[state.poster] || RECIPES[1];
    ["uEsp", "uMid", "uMilk", "uFoam"].forEach((k, i) => uniforms[k].value.set(r.c[i]));
    uniforms.uB.value.set(r.b[0], r.b[1], r.b[2], 0.13);
    api.onProgress = () => {};
    setLevel(1.86);
    ice.forEach((m, i) => { m.visible = i < r.ice; m.scale.setScalar(1); });
    camera.position.set(0, 0.5, 9); camera.lookAt(0, 0, 0);
  }
  api.onStage = (s) => { wordTarget = s; };
  wordTarget = state.stage || 0;
  wordAlpha.fill(0); wordAlpha[wordTarget] = 1;

  const clock = new THREE.Clock();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    ice.forEach((m) => { if (m.visible) m.position.y = m.userData.y + Math.sin(t * 1.1 + m.userData.phase) * 0.018; });
    wordsAlphaLerp();
    renderer.render(scene, camera);
  }
  new IntersectionObserver(([e]) => { const was = running; running = e.isIntersecting; if (running && !was) frame(); }).observe(stage);
  resize();
  if (!state.poster) applyProgress(state.p || 0);
  frame();
  document.documentElement.dataset.gl = "ready";
}

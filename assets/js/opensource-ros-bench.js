/* ROS Optics Bench: Ryan's Onshape model of the self-aligning laser-to-fiber bench,
   rendered in the browser.

   Geometry: cad/assemblies/ros_laser_bench_main_assembly.step from
   github.com/CoraBeanz/ROS-Optics-Bench, tessellated with OpenCascade and packed into
   assets/data/opensource/ros-bench-cad.mesh.json (gzip pack, base64) + ros-bench-cad.json manifest. Small hidden parts
   (bearings, springs, set screws, parts under 3.5 mm) are left out. The kinematic mirror
   mounts, fiber bulkheads and plug-in boards are models of purchased parts placed in his
   assembly; the Feather is Adafruit's ESP8266 Feather model standing in for the ESP32 V2.

   The red beam is an illustration added here, not part of the CAD: it follows the laser
   axis through the 2 mm aperture, polarizer and beamsplitter (whose reflected port feeds the
   reference photodiode), turns at M1 and M2, and is focused by the asphere into the input
   fiber; the patch cord loop and the light onto the output photodiode are drawn too.

   export default function mount(container, options) -> Promise<{ destroy(), render(), setLabels(bool) }>
   options: data (URL of the .mesh.json), meta (URL of the manifest .json), labels (false), beam (true),
            autoRotate (true), controls (true), bloom (true), shadows (true), pixelRatio,
            reducedMotion, preserveDrawingBuffer, view ([x, y, z] camera direction),
            zoom (1), target ([x, y, z] in CAD mm), still (render on demand only), pulse (true). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const C = { bg: 0x0c1119, text: "#e7ecf3", line: "rgb(231 236 243 / 0.5)" };
// the page's body face (site.css --f-body), with the same fallbacks for use outside the site
const FONT = "var(--f-body, \"Hanken Grotesk\", \"Helvetica Neue\", Helvetica, Arial, system-ui, sans-serif)";

// Points in CAD millimetres (Onshape frame: z up). Taken from the part placements in the STEP.
const P = {
  laser: [-219.0, -272.5, 42.5],      // front of the laser module's lens holder
  m1: [-31.4, -272.5, 42.5],          // where the laser axis meets M1's mirror face
  m2: [-31.4, -249.55, 42.5],         // where the beam from M1 meets M2's mirror face
  lens: [158.2, -262.5, 42.5],        // f = 8 mm asphere, on the iris axis
  fiberIn: [188.7, -262.5, 42.5],     // front face of the input FC bulkhead
  bs: [-110.9, -272.5, 42.5],         // beamsplitter cube centre
  refPd: [-110.9, -212.0, 42.5],      // reference photodiode face
  fiberOut: [188.7, -212.5, 42.5],    // front face of the output FC bulkhead
  outPd: [162.0, -212.5, 42.5],       // output photodiode face
  backIn: [219.5, -262.5, 42.5],      // rear of the input bulkhead (patch cord)
  backOut: [219.5, -212.5, 42.5],
};

// t: text, p: anchor (CAD mm), dy: leader length in px (negative = label above), dx: label shift in px.
// minor: hidden when the viewer is under 560 px wide; core: the only ones kept under 440 px.
const LABELS = [
  { t: "635 nm laser", p: [-234, -272.5, 47], dy: -48, core: true },
  { t: "2 mm aperture", p: [-189, -272.5, 51], dy: 70 },
  { t: "polarizer", p: [-147.2, -272.5, 49], dy: -58, minor: true },
  { t: "beamsplitter", p: [-110.9, -270.1, 50.5], dy: 64, dx: 8 },
  { t: "reference photodiode", p: [-112.5, -209.8, 47], dy: -34, dx: 60, minor: true },
  { t: "M1", p: [-31.4, -272.5, 52], dy: 64, core: true },
  { t: "M2", p: [-31.4, -249.5, 52], dy: -52, core: true },
  { t: "NEMA 8 steppers", p: [-78, -183, 62], dy: -36, dx: -10, minor: true },
  { t: "iris 1", p: [29.5, -262.5, 51], dy: -40, minor: true },
  { t: "iris 2", p: [129.5, -262.5, 51], dy: -40, minor: true },
  { t: "f = 8 mm asphere", p: [158.2, -262.5, 49], dy: 70, dx: -46, core: true },
  { t: "fiber in", p: [196, -262.5, 50], dy: 62, dx: 20, minor: true },
  { t: "output photodiode", p: [159.8, -212.5, 47], dy: -40, dx: -20 },
  { t: "control board", p: [-188, -102, 28], dy: -26 },
];

const MAT = {
  base: { color: 0x1a1f28, roughness: 0.86, metalness: 0.0 },
  print: { color: 0x2b313b, roughness: 0.62, metalness: 0.0 },
  print2: { color: 0x3c434e, roughness: 0.6, metalness: 0.0 },
  steel: { color: 0xc6ced8, roughness: 0.3, metalness: 1.0 },
  brass: { color: 0xd9a441, roughness: 0.3, metalness: 1.0 },
  aluminium: { color: 0xb9c1ca, roughness: 0.36, metalness: 0.9 },
  mirror: { color: 0xeef3f8, roughness: 0.04, metalness: 1.0 },
  glass: { color: 0x7fd8e6, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.28, depthWrite: false },
  polarizer: { color: 0x8b6cff, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.5, depthWrite: false },
  diode: { color: 0x2a3b5c, roughness: 0.25, metalness: 0.2 },
  pcb: { color: 0x1d5a3c, roughness: 0.55, metalness: 0.05 },
};

function lift(hex, min) {
  // Keep near-black CAD colours visible on the dark panel.
  const c = new THREE.Color(hex);
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (l < min) { const k = min - l; c.r += k; c.g += k; c.b += k * 1.15; }
  return c;
}

function capLum(c, max) {
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (l > max) c.multiplyScalar(max / l);
  return c;
}

function materialFor(ch, cache, envI) {
  const key = ch.cls + ch.color;
  if (cache.has(key)) return cache.get(key);
  let m;
  const spec = MAT[ch.cls];
  if (spec) {
    m = new THREE.MeshStandardMaterial(Object.assign({}, spec));
  } else if (ch.cls === "motor") {
    const c = new THREE.Color(ch.color);
    const bright = c.r + c.g + c.b > 1.5;
    m = new THREE.MeshStandardMaterial({ color: bright ? 0x9aa3ad : lift(ch.color, 0.05),
      roughness: bright ? 0.35 : 0.5, metalness: bright ? 0.85 : 0.2 });
  } else {
    // vendor parts (mirror mounts, bulkheads) and electronics: keep the CAD colour
    m = new THREE.MeshStandardMaterial({ color: capLum(lift(ch.color, 0.02), 0.55),
      roughness: 0.5, metalness: ch.cls === "vendor" ? 0.25 : 0.1 });
  }
  if (spec && spec.color !== undefined) m.color = new THREE.Color(spec.color);
  m.envMapIntensity = envI * (ch.cls === "mirror" || ch.cls === "steel" || ch.cls === "brass" || ch.cls === "aluminium" ? 1.6 : 1);
  cache.set(key, m);
  return m;
}

function glowTexture() {
  const s = 128, cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const g = cv.getContext("2d");
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.2, "rgba(255,190,180,0.6)");
  grd.addColorStop(0.5, "rgba(255,90,82,0.18)");
  grd.addColorStop(1, "rgba(255,90,82,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The mesh pack is gzipped, then base64-encoded inside a .json file so any static host serves it.
function fromBase64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
// If the bytes are not gzip (already decoded somewhere), use them as is.
async function inflate(ab) {
  const b = new Uint8Array(ab, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return ab;
  if (typeof DecompressionStream === "undefined") throw new Error("DecompressionStream unsupported");
  const stream = new Blob([ab]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

export default async function mount(container, options = {}) {
  const o = Object.assign({
    data: new URL("../data/opensource/ros-bench-cad.mesh.json", import.meta.url).href,
    meta: new URL("../data/opensource/ros-bench-cad.json", import.meta.url).href,
    labels: false, beam: true, autoRotate: true, controls: true, bloom: true, shadows: true,
    pixelRatio: null, preserveDrawingBuffer: false, view: [-0.15, 1.25, 1.0], zoom: 1,
    target: [-20, -240, 25], still: false, pulse: true, env: 0.45, exposure: 1.12, distance: 780, glow: 0.42,
  }, options || {});
  const reduce = typeof o.reducedMotion === "boolean" ? o.reducedMotion
    : !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (getComputedStyle(container).position === "static") container.style.position = "relative";

  const [meta, buf] = await Promise.all([
    fetch(o.meta).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch(o.data).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((j) => inflate(fromBase64(j.data))),
  ]);
  const [cx, cy, cz] = meta.cadCentre;
  const cad = (p) => new THREE.Vector3(p[0] - cx, p[2] - cz, -(p[1] - cy));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance",
    preserveDrawingBuffer: !!o.preserveDrawingBuffer });
  renderer.setPixelRatio(o.pixelRatio || Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(C.bg, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure;
  renderer.shadowMap.enabled = !!o.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // the scene does not move: draw the shadow map once
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "3D model of the ROS Optics Bench: a printed breadboard carrying a " +
    "635 nm laser, aperture, polarizer, beamsplitter, two motorized mirrors, irises, a focusing lens, fiber " +
    "mounts, photodiodes and the control board, with the laser beam path drawn in red.");
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(26, 1, 5, 6000);

  // lights: a soft key from the back left (casts shadows) and a cool rim from the front right
  scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x0c1119, 0.25));
  const key = new THREE.DirectionalLight(0xfff4e8, 2.4);
  key.position.set(-260, 520, -180);
  key.castShadow = !!o.shadows;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 100, far: 1400 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.6;
  key.shadow.radius = 3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc2ff, 0.6);
  rim.position.set(420, 260, 520);
  scene.add(rim);

  // ---------- the CAD ----------
  const model = new THREE.Group();
  scene.add(model);
  const cache = new Map();
  const [qx, qy, qz] = meta.qMin, [sx, sy, sz] = meta.qScale;
  for (const ch of meta.chunks) {
    // undo the delta coding: running sums, wrapping like the encoder
    const q = new Uint16Array(buf, ch.vOffset, ch.vCount * 3);
    const pos = new Float32Array(ch.vCount * 3);
    let ax = 0, ay = 0, az = 0;
    for (let i = 0; i < ch.vCount; i++) {
      ax = (ax + q[3 * i]) & 0xffff; ay = (ay + q[3 * i + 1]) & 0xffff; az = (az + q[3 * i + 2]) & 0xffff;
      pos[3 * i] = qx + ax * sx; pos[3 * i + 1] = qy + ay * sy; pos[3 * i + 2] = qz + az * sz;
    }
    const raw = ch.iType === 16 ? new Uint16Array(buf, ch.iOffset, ch.iCount) : new Uint32Array(buf, ch.iOffset, ch.iCount);
    const idx = ch.iType === 16 ? new Uint16Array(ch.iCount) : new Uint32Array(ch.iCount);
    const mask = ch.iType === 16 ? 0xffff : 0xffffffff;
    for (let i = 0, a = 0; i < ch.iCount; i++) { a = ch.iType === 16 ? (a + raw[i]) & mask : (a + raw[i]) >>> 0; idx[i] = a; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, materialFor(ch, cache, o.env));
    mesh.castShadow = ch.cls !== "glass" && ch.cls !== "polarizer";
    mesh.receiveShadow = ch.cls === "base" || ch.cls === "pcb" || ch.cls === "print" || ch.cls === "print2";
    mesh.userData.group = ch.group;
    if (ch.cls === "glass" || ch.cls === "polarizer") mesh.renderOrder = 2;
    model.add(mesh);
  }

  // ---------- the beam (illustration) ----------
  const beam = new THREE.Group();
  scene.add(beam);
  const pulses = [];
  if (o.beam) {
    const hot = new THREE.Color(3.2, 0.42, 0.34);   // HDR red so only the beam blooms
    const coreMat = new THREE.MeshBasicMaterial({ color: hot, toneMapped: false });
    const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.18, 0.15), transparent: true,
      opacity: 0.22, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const seg = (a, b, r0, r1, power = 1) => {
      const A = cad(a), B = cad(b), L = A.distanceTo(B);
      const geo = new THREE.CylinderGeometry(r1, r0, L, 18, 1, true);
      geo.translate(0, L / 2, 0);
      geo.rotateX(Math.PI / 2);
      const m = coreMat.clone(); m.color.multiplyScalar(power);
      const core = new THREE.Mesh(geo, m);
      core.position.copy(A); core.lookAt(B);
      const hgeo = new THREE.CylinderGeometry(r1 * 2.6 + 0.5, r0 * 2.6 + 0.5, L, 18, 1, true);
      hgeo.translate(0, L / 2, 0); hgeo.rotateX(Math.PI / 2);
      const halo = new THREE.Mesh(hgeo, haloMat.clone());
      halo.material.opacity *= power;
      halo.position.copy(A); halo.lookAt(B);
      beam.add(core, halo);
      return { A, B, L };
    };
    // laser to aperture: the raw 7 x 3 mm beam, dim; after the aperture a 2 mm beam
    seg(P.laser, [-196.5, -272.5, 42.5], 1.5, 1.5, 0.35);
    const legs = [
      seg([-196.5, -272.5, 42.5], P.bs, 0.9, 0.9, 1),
      seg(P.bs, P.m1, 0.9, 0.9, 0.75),
      seg(P.m1, P.m2, 0.9, 0.9, 0.75),
      seg(P.m2, P.lens, 0.9, 0.9, 0.75),
    ];
    seg(P.lens, P.fiberIn, 0.9, 0.12, 0.85);           // focused into the fiber
    seg(P.bs, P.refPd, 0.9, 0.9, 0.55);                // reference arm
    seg(P.fiberOut, P.outPd, 0.5, 1.1, 0.5);           // fiber output onto the output photodiode
    // the patch cord from the input bulkhead back round to the output bulkhead
    const a = cad(P.backIn), b = cad(P.backOut);
    const curve = new THREE.CubicBezierCurve3(a, a.clone().add(new THREE.Vector3(34, 0, 0)),
      b.clone().add(new THREE.Vector3(34, 0, 0)), b);
    const cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 1.5, 12, false),
      new THREE.MeshStandardMaterial({ color: 0xb89a35, roughness: 0.75, metalness: 0.0 }));
    cord.castShadow = true;
    model.add(cord);
    // spots where the beam meets each optic
    const tex = glowTexture();
    for (const [p, s, k] of [[P.m1, 9, 1], [P.m2, 9, 1], [P.bs, 8, 0.8], [P.lens, 7, 0.9], [P.fiberIn, 6, 1],
                             [P.refPd, 7, 0.7], [P.outPd, 7, 0.6], [[-196.5, -272.5, 42.5], 7, 0.8]]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(2.4 * k, 0.5 * k, 0.45 * k),
        transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
      sp.position.copy(cad(p)); sp.scale.setScalar(s);
      beam.add(sp);
    }
    // travelling pulses (motion only)
    if (o.pulse && !reduce && !o.still) {
      const total = legs.reduce((s, l) => s + l.L, 0);
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(3, 0.9, 0.8),
          transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
        sp.scale.setScalar(5);
        beam.add(sp);
        pulses.push({ sp, phase: i / 3, legs, total });
      }
    }
  }

  // ---------- labels ----------
  const labelLayer = document.createElement("div");
  labelLayer.setAttribute("aria-hidden", "true");
  labelLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2;" +
    "font:400 12px/1.25 " + FONT + ";letter-spacing:0;text-transform:none";
  container.appendChild(labelLayer);
  // each label: a hairline leader from the anchor, then the name on a faint dark backdrop
  const labels = LABELS.map((L) => {
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;left:0;top:0;white-space:nowrap;will-change:transform";
    const line = document.createElement("span");
    line.style.cssText = "position:absolute;left:-0.5px;width:1px;background:" + C.line;
    const tag = document.createElement("span");
    tag.style.cssText = "position:absolute;transform:translate(-50%,-100%);padding:2px 5px;" +
      "background:rgb(12 17 25 / 0.6);color:" + C.text;
    tag.textContent = L.t;
    el.append(line, tag);
    labelLayer.appendChild(el);
    return { L, el, line, tag, v: cad(L.p) };
  });
  let showLabels = !!o.labels;
  labelLayer.style.display = showLabels ? "" : "none";

  // toggle button
  let btn = null;
  if (o.controls) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Labels";
    btn.setAttribute("aria-pressed", String(showLabels));
    // same look as the site's video pause button (.loop__btn)
    btn.style.cssText = "position:absolute;right:10px;top:10px;z-index:3;margin:0;font:500 12px/1 " + FONT + ";" +
      "letter-spacing:normal;text-transform:none;color:#e9e9e4;background:rgb(0 0 0 / 0.55);border:0;" +
      "border-radius:2px;padding:6px 9px;cursor:pointer";
    btn.addEventListener("click", () => { api.setLabels(!showLabels); });
    container.appendChild(btn);
  }

  // ---------- camera, controls ----------
  const target = cad(o.target);
  const dir = new THREE.Vector3(...o.view).normalize();
  const baseDist = o.distance / (o.zoom || 1);
  let controls = null;
  if (o.controls) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = !reduce;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    // no wheel or pinch zoom: the wheel scrolls the page, and a vertical swipe on a phone
    // scrolls it too (OrbitControls sets touch-action: none); dragging still turns the model
    controls.enableZoom = false;
    renderer.domElement.style.touchAction = "pan-y";
    controls.minDistance = 180;
    controls.maxDistance = 2200;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.autoRotate = !!o.autoRotate && !reduce && !o.still;
    controls.autoRotateSpeed = 0.45;
    controls.addEventListener("start", () => { controls.autoRotate = false; });
    controls.addEventListener("change", () => { if (o.still || !running) requestRender(); });
  }
  camera.position.copy(target).addScaledVector(dir, baseDist);
  camera.lookAt(target);

  // ---------- post: bloom on the beam only ----------
  // The bloom pass sees the model in flat black (so it still hides the beam where parts
  // are in front of it) and the beam in its own HDR colours; the result is added on top.
  let bloomComposer = null, finalComposer = null;
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const saved = new Map();
  if (o.bloom) {
    bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(new RenderPass(scene, camera));
    bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), o.glow, 0.3, 0.0));
    finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(new RenderPass(scene, camera));
    // Tone mapping (ACES, as three.js r160 does it) and the sRGB transfer happen here, so the
    // empty background can be laid in afterwards at exactly the panel colour.
    const mix = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture },
        exposure: { value: o.exposure }, bgColor: { value: new THREE.Color(C.bg).convertLinearToSRGB() },
      },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        uniform sampler2D baseTexture; uniform sampler2D bloomTexture; uniform float exposure; uniform vec3 bgColor;
        varying vec2 vUv;
        vec3 fit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
        vec3 aces(vec3 c) {
          const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
          const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
          c *= exposure / 0.6; c = I * c; c = fit(c); c = O * c; return clamp(c, 0.0, 1.0);
        }
        vec3 srgb(vec3 v) { return mix(pow(v, vec3(0.41666)) * 1.055 - vec3(0.055), v * 12.92, vec3(lessThanEqual(v, vec3(0.0031308)))); }
        void main() {
          vec4 base = texture2D(baseTexture, vUv);
          vec3 bloom = texture2D(bloomTexture, vUv).rgb;
          vec3 lit = srgb(aces(base.rgb + bloom));
          vec3 empty = bgColor + srgb(aces(bloom));
          gl_FragColor = vec4(mix(empty, lit, clamp(base.a, 0.0, 1.0)), 1.0);
        }`,
    }), "baseTexture");
    mix.material.toneMapped = false;
    finalComposer.addPass(mix);
  }
  const bg = scene.background;
  function draw() {
    if (!finalComposer) { renderer.render(scene, camera); return; }
    model.traverse((ob) => { if (ob.isMesh) { saved.set(ob, ob.material); ob.material = black; } });
    scene.background = null;
    const env = scene.environment; scene.environment = null;
    renderer.setClearColor(0x000000, 1);
    bloomComposer.render();
    model.traverse((ob) => { if (ob.isMesh) ob.material = saved.get(ob); });
    saved.clear();
    scene.environment = env;
    renderer.setClearColor(0x000000, 0);   // alpha 0 marks the empty background for the mix pass
    finalComposer.render();
    scene.background = bg;
    renderer.setClearColor(C.bg, 1);
  }

  // Greedy label layout: each label tries leader lengths above or below its anchor (its
  // preferred side first) and takes the first spot that clears the labels already placed
  // and the other anchor points.
  function placeLabels() {
    if (!showLabels) return;
    const w = container.clientWidth, h = container.clientHeight;
    const k = Math.min(1, Math.max(0.6, w / 900));
    const v = new THREE.Vector3();
    const pts = labels.map((lb) => {
      v.copy(lb.v).project(camera);
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, ok: v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02 };
    });
    const boxes = [];
    const hit = (r) => boxes.some((b) => r.x0 < b.x1 && r.x1 > b.x0 && r.y0 < b.y1 && r.y1 > b.y0) ||
      pts.some((p) => p.ok && p.x > r.x0 - 4 && p.x < r.x1 + 4 && p.y > r.y0 - 4 && p.y < r.y1 + 4) ||
      r.x0 < 4 || r.x1 > w - 4 || r.y0 < 4 || r.y1 > h - 4;
    const narrow = w < 560, tiny = w < 440;
    // read every label size first (one layout pass), then write positions
    const sizes = labels.map((lb) => [lb.tag.offsetWidth || 80, lb.tag.offsetHeight || 18]);
    // keep clear of the Labels button and of any hint or control the page puts in the viewer
    const cr = container.getBoundingClientRect();
    for (const ob of container.querySelectorAll(":scope > button, :scope > .viewer__hint")) {
      const r = ob.getBoundingClientRect();
      if (r.width && r.height) boxes.push({ x0: r.left - cr.left - 6, x1: r.right - cr.left + 6, y0: r.top - cr.top - 6, y1: r.bottom - cr.top + 6 });
    }
    labels.forEach((lb, i) => {
      const p = pts[i];
      if ((narrow && lb.L.minor) || (tiny && !lb.L.core)) p.ok = false;
      lb.el.style.display = p.ok ? "" : "none";
      if (!p.ok) return;
      const { line, tag } = lb;
      const [tw, th] = sizes[i];
      const pref = (lb.L.dy || -40) < 0 ? -1 : 1;
      const base = Math.abs(lb.L.dy || 40) * k;
      const dx0 = (lb.L.dx || 0) * k;
      let best = null;
      for (const side of [pref, -pref]) {
        for (const len of [base, base + 26 * k, base + 52 * k, Math.max(22, base - 22 * k), base + 80 * k]) {
          const lim = tw / 2 - 12;   // the label always sits over its leader line
          for (const dx of [dx0, dx0 + tw * 0.4, dx0 - tw * 0.4].map((d) => Math.max(-lim, Math.min(lim, d)))) {
            const top = side < 0 ? p.y - len - th : p.y + len;
            const r = { x0: p.x + dx - tw / 2, x1: p.x + dx + tw / 2, y0: top, y1: top + th };
            if (!hit(r)) { best = { side, len, dx, r }; break; }
          }
          if (best) break;
        }
        if (best) break;
      }
      if (!best && narrow && !lb.L.core) { lb.el.style.display = "none"; return; }
      if (!best) {
        const top = pref < 0 ? p.y - base - th : p.y + base;
        best = { side: pref, len: base, dx: dx0, r: { x0: p.x + dx0 - tw / 2, x1: p.x + dx0 + tw / 2, y0: top, y1: top + th } };
      }
      boxes.push(best.r);
      lb.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
      const L = Math.round(best.len);
      line.style.height = L + "px";
      if (best.side < 0) {
        line.style.top = -L + "px";
        tag.style.transform = "translate(-50%,-100%)";
        tag.style.top = -L + "px";
      } else {
        line.style.top = "0px";
        tag.style.transform = "translate(-50%,0)";
        tag.style.top = L + "px";
      }
      tag.style.left = Math.round(best.dx) + "px";
    });
  }

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the same horizontal field of view on screens narrower than 16:9
    const a = w / h, t = Math.tan(THREE.MathUtils.degToRad(13)) * 1.78;
    camera.fov = a < 1.78 ? THREE.MathUtils.radToDeg(2 * Math.atan(t / a)) : 26;
    camera.updateProjectionMatrix();
    if (bloomComposer) { bloomComposer.setSize(w, h); finalComposer.setSize(w, h); }
    requestRender();
  }

  let raf = 0, running = false, visible = true, needs = true, last = performance.now();
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (controls) controls.update(dt);
    for (const p of pulses) {
      p.phase = (p.phase + dt * 0.18) % 1;
      let d = p.phase * p.total;
      for (const l of p.legs) {
        if (d <= l.L) { p.sp.position.lerpVectors(l.A, l.B, d / l.L); break; }
        d -= l.L;
      }
    }
    draw();
    placeLabels();
    needs = false;
    if (running) raf = requestAnimationFrame(frame);
  }
  function requestRender() { needs = true; if (!raf) raf = requestAnimationFrame(frame); }
  function start() {
    const animated = !o.still && ((controls && controls.autoRotate) || pulses.length || (controls && controls.enableDamping));
    running = visible && !document.hidden && !!animated;
    if (running && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!running && needs) requestRender();
  }
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting); start();
  }, { threshold: 0.01 }) : null;
  if (io) io.observe(container);
  const onVis = () => start();
  document.addEventListener("visibilitychange", onVis);
  const ro = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container); else window.addEventListener("resize", resize);
  resize();
  start();
  requestRender();

  const api = {
    render() { draw(); placeLabels(); },
    setLabels(on) {
      showLabels = !!on;
      labelLayer.style.display = showLabels ? "" : "none";
      if (btn) btn.setAttribute("aria-pressed", String(showLabels));
      requestRender();
    },
    destroy() {
      running = false; if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect(); if (ro) ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      if (controls) controls.dispose();
      scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) ob.material.dispose(); });
      envTex.dispose(); pmrem.dispose(); renderer.dispose();
      renderer.domElement.remove(); labelLayer.remove(); if (btn) btn.remove();
    },
  };
  return api;
}

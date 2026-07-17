/* ══════════════════════════════════════════════════════════
   HIMANSHU SINGH · portfolio interactions · v2
   1. Three.js particle field: MANUAL chaos ⇄ AUTOMATED grid
   2. Scramble-decode hero (dirty data resolves into clean text)
   3. Cell-reference cursor
   4. pipeline.log console typing
   5. Formula bar skill audit
   6. Hold-to-rev throttle + tachometer
   7. Live "cells auto-filled" stat · counters · reveals · clock
══════════════════════════════════════════════════════════ */

import * as THREE from 'three';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ──────────────────────────────────────────────
   1 · PARTICLE FIELD
────────────────────────────────────────────── */
const canvas = document.getElementById('field');
let three = null;

function initField() {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    camera.position.set(0, 4, 46);

    const isMobile = window.innerWidth < 700;
    const COUNT = isMobile ? 3600 : 7500;

    /* CHAOS: scattered noise cloud (the manual world) */
    const chaos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      chaos[i * 3]     = (Math.random() - 0.5) * 90;
      chaos[i * 3 + 1] = (Math.random() - 0.5) * 46;
      chaos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }

    /* ORDER: a DNA double helix spanning the screen, computed live
       each frame so it spins + flows in from the sides.

       ★★ HELIX TUNING — these four numbers are the ones to touch ★★
       HELIX_LENGTH  : how far it stretches across the screen (bigger = longer)
       HELIX_HEIGHT  : total vertical size — set to run parallel to the title
       HELIX_CENTER_Y: moves it up/down (0 = vertical middle of the hero)
       HELIX_TUBE    : strand thickness (bigger = chunkier, meatier strands) */
    const HELIX_LENGTH   = isMobile ? 64 : 96;
    const HELIX_HEIGHT   = isMobile ? 18 : 26;
    const HELIX_CENTER_Y = 0;
    const HELIX_TUBE     = isMobile ? 1.2 : 1.6;

    const helix = {
      s: new Float32Array(COUNT),      // 0..1 position along the strand
      role: new Uint8Array(COUNT),     // 0/1 = backbone strands, 2 = base-pair rung
      f: new Float32Array(COUNT),      // rung fraction between the strands
      ox: new Float32Array(COUNT),     // fixed thickness offsets (the "tube")
      oy: new Float32Array(COUNT),
      oz: new Float32Array(COUNT),
      span: HELIX_LENGTH,
      radius: HELIX_HEIGHT / 2,
      cy: HELIX_CENTER_Y,
      turns: isMobile ? 3.5 : 5.5,
      rungs: isMobile ? 26 : 42,
    };
    for (let i = 0; i < COUNT; i++) {
      const r = Math.random();
      if (r < 0.4) {                   // strand A
        helix.role[i] = 0;
        helix.s[i] = Math.random();
      } else if (r < 0.8) {            // strand B
        helix.role[i] = 1;
        helix.s[i] = Math.random();
      } else {                         // rung: snap to a discrete base pair
        helix.role[i] = 2;
        helix.s[i] = ((Math.random() * helix.rungs) | 0) / helix.rungs + 0.5 / helix.rungs;
        helix.f[i] = Math.random();
      }
      // scatter each particle inside a little tube around its strand
      const tube = helix.role[i] === 2 ? HELIX_TUBE * 0.45 : HELIX_TUBE;
      helix.ox[i] = (Math.random() - 0.5) * tube;
      helix.oy[i] = (Math.random() - 0.5) * tube;
      helix.oz[i] = (Math.random() - 0.5) * tube;
    }
    const order = new Float32Array(COUNT * 3); // written every frame

    /* colors: ink dots with a scatter of pine + lime */
    const colors = new Float32Array(COUNT * 3);
    const cInk  = new THREE.Color('#12140D');
    const cPine = new THREE.Color('#175E3B');
    const cLime = new THREE.Color('#9DBE2E');
    for (let i = 0; i < COUNT; i++) {
      const r = Math.random();
      const c = r < 0.72 ? cInk : (r < 0.92 ? cPine : cLime);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }

    const positions = new Float32Array(chaos);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aCol', new THREE.BufferAttribute(colors, 3));

    // every particle is a digit 0–9
    const digits = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) digits[i] = (Math.random() * 10) | 0;
    geo.setAttribute('aDigit', new THREE.BufferAttribute(digits, 1));

    /* digit atlas: 0–9 drawn white on a strip, tinted per-particle in the shader
       so the ink / pine / lime palette is preserved exactly */
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = 640; atlasCanvas.height = 64;
    const actx = atlasCanvas.getContext('2d');
    actx.fillStyle = '#fff';
    actx.font = '700 52px "IBM Plex Mono", monospace';
    actx.textAlign = 'center'; actx.textBaseline = 'middle';
    for (let d = 0; d < 10; d++) actx.fillText(String(d), d * 64 + 32, 36);
    const atlas = new THREE.CanvasTexture(atlasCanvas);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uAtlas: { value: atlas },
        uSize:  { value: isMobile ? 0.85 : 1.0 },   // digit size — bigger = more legible
        uScale: { value: 300 },
        uOpacity: { value: 0.85 },
      },
      vertexShader: `
        attribute vec3 aCol;
        attribute float aDigit;
        uniform float uSize, uScale;
        varying vec3 vColor;
        varying float vDigit;
        void main() {
          vColor = aCol;
          vDigit = aDigit;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * (uScale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uAtlas;
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vDigit;
        void main() {
          vec2 uv = vec2((vDigit + gl_PointCoord.x) / 10.0, 1.0 - gl_PointCoord.y);
          float a = texture2D(uAtlas, uv).a;
          if (a < 0.25) discard;
          gl_FragColor = vec4(vColor, a * uOpacity);
        }`,
    });

    scene.add(new THREE.Points(geo, mat));

    three = {
      renderer, scene, camera, geo, positions, chaos, order, helix, mat, COUNT,
      mix: 0, target: 0,
      mouse: new THREE.Vector2(-99, -99),
      mouseWorld: new THREE.Vector3(999, 999, 0),
      raycaster: new THREE.Raycaster(),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      t: 0,
      rumble: 0, // fed by the throttle, because why not
    };

    resize();
    animate();
  } catch (e) {
    canvas.style.display = 'none';
  }
}

function resize() {
  if (!three) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  three.renderer.setSize(w, h, false);
  three.mat.uniforms.uScale.value = h * 0.5 * Math.min(window.devicePixelRatio, 2);
  three.camera.aspect = w / h;
  three.camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

window.addEventListener('pointermove', (e) => {
  if (!three) return;
  const r = canvas.getBoundingClientRect();
  if (e.clientY < r.top || e.clientY > r.bottom) return;
  three.mouse.set(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1
  );
  three.raycaster.setFromCamera(three.mouse, three.camera);
  three.raycaster.ray.intersectPlane(three.plane, three.mouseWorld);
});

function animate() {
  requestAnimationFrame(animate);
  if (!three) return;
  const T = three;
  T.t += 0.004;

  T.mix += (T.target - T.mix) * 0.035;
  const m = T.mix;
  const drift = prefersReduced ? 0 : 1;
  const rumble = T.rumble * drift; // extra jitter while the engine revs

  const pos = T.positions, ch = T.chaos, or = T.order;
  const mw = T.mouseWorld;

  /* write this frame's DNA helix into `order` — the spin makes it
     look like the molecule is flowing in from the sides of the screen */
  if (m > 0.004) {
    const H = T.helix, TAU = Math.PI * 2;
    const spin = T.t * (drift ? 2.2 : 0);          // screw rotation = sideways flow
    const sway = Math.sin(T.t * 0.8) * 1.6 * drift; // slow vertical breathing
    for (let i = 0; i < T.COUNT; i++) {
      const s = H.s[i], j = i * 3;
      const x = (s - 0.5) * H.span + H.ox[i];
      const a = s * H.turns * TAU + spin;
      if (H.role[i] === 2) {
        // base-pair rung: bridge between the two backbones
        const k = 1 - 2 * H.f[i];
        or[j]     = x;
        or[j + 1] = Math.cos(a) * H.radius * k + H.cy + H.oy[i] + sway;
        or[j + 2] = Math.sin(a) * H.radius * k + H.oz[i];
      } else {
        const ph = H.role[i] === 0 ? 0 : Math.PI;
        or[j]     = x;
        or[j + 1] = Math.cos(a + ph) * H.radius + H.cy + H.oy[i] + sway;
        or[j + 2] = Math.sin(a + ph) * H.radius + H.oz[i];
      }
    }
  }

  for (let i = 0; i < T.COUNT; i++) {
    const ix = i * 3, iy = ix + 1, iz = ix + 2;

    const dx = Math.sin(T.t * 3 + i * 0.37) * 1.6 * (1 - m) * drift;
    const dy = Math.cos(T.t * 2.4 + i * 0.51) * 1.6 * (1 - m) * drift;
    const by = Math.sin(T.t * 5 + or[ix] * 0.4) * 0.25 * m * drift;

    let tx = ch[ix] * (1 - m) + or[ix] * m + dx;
    let ty = ch[iy] * (1 - m) + or[iy] * m + dy + by;
    let tz = ch[iz] * (1 - m) + or[iz] * m;

    if (rumble > 0.01) {
      tx += (Math.random() - 0.5) * rumble;
      ty += (Math.random() - 0.5) * rumble;
    }

    if (drift) {
      const mdx = tx - mw.x, mdy = ty - mw.y;
      const d2 = mdx * mdx + mdy * mdy;
      if (d2 < 42) {
        const d = Math.sqrt(d2) || 0.001;
        const f = (1 - d / 6.5) * 3.2;
        tx += (mdx / d) * f;
        ty += (mdy / d) * f;
      }
    }

    pos[ix] += (tx - pos[ix]) * 0.08;
    pos[iy] += (ty - pos[iy]) * 0.08;
    pos[iz] += (tz - pos[iz]) * 0.08;
  }

  T.geo.attributes.position.needsUpdate = true;

  if (!prefersReduced) {
    T.camera.position.x += (T.mouse.x * 3 - T.camera.position.x) * 0.02;
    T.camera.position.y += (4 + T.mouse.y * 1.5 - T.camera.position.y) * 0.02;
  }
  T.camera.lookAt(0, 0, 0);
  T.renderer.render(T.scene, T.camera);
}

initField();

/* ── the switch (+ keyboard shortcut) ───────── */
const toggle = document.getElementById('modeToggle');
const labelManual = document.getElementById('labelManual');
const labelAuto = document.getElementById('labelAuto');
labelManual.classList.add('on');

function setMode(auto) {
  toggle.setAttribute('aria-checked', String(auto));
  labelManual.classList.toggle('on', !auto);
  labelAuto.classList.toggle('on', auto);
  if (three) three.target = auto ? 1 : 0;
}
toggle.addEventListener('click', () =>
  setMode(toggle.getAttribute('aria-checked') !== 'true')
);
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'a') return;
  const t = e.target.tagName;
  if (t === 'INPUT' || t === 'TEXTAREA') return;
  touched = true;
  setMode(toggle.getAttribute('aria-checked') !== 'true');
});

// auto-demo: if the visitor hasn't flipped it, flip it for them.
// automating the automation switch felt thematically required.
let touched = false;
toggle.addEventListener('click', () => (touched = true), { once: true });
if (!prefersReduced) {
  setTimeout(() => { if (!touched) setMode(true); }, 7000);
}

/* ──────────────────────────────────────────────
   2 · SCRAMBLE DECODE (dirty data → clean text)
────────────────────────────────────────────── */
/* letters/digits only — same visual width as the real text,
   so the scrambled state never overflows or looks longer */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function scramble(el, duration = 2400) {
  const target = el.dataset.text;
  const t0 = performance.now();
  el.dataset.busy = '1';
  (function frame(t) {
    const p = Math.min((t - t0) / duration, 1);
    const settled = Math.floor(target.length * p);
    let out = target.slice(0, settled);
    for (let i = settled; i < target.length; i++) {
      out += target[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    out = out.slice(0, target.length); // never exceed the real character count
    el.textContent = out;
    if (p < 1) requestAnimationFrame(frame);
    else delete el.dataset.busy;
  })(t0);
}

const scrambles = document.querySelectorAll('.scramble');
if (!prefersReduced) {
  scrambles.forEach((el, i) => setTimeout(() => scramble(el), 400 + i * 450));
  // re-clean the data on hover, because dirty data always comes back
  document.getElementById('heroTitle').addEventListener('mouseenter', () => {
    scrambles.forEach((el) => { if (!el.dataset.busy) scramble(el, 1400); });
  });
}

/* ──────────────────────────────────────────────
   3 · CELL-REFERENCE CURSOR
────────────────────────────────────────────── */
const cell = document.getElementById('cellCursor');
const CELLPX = 32;
window.addEventListener('pointermove', (e) => {
  if (e.pointerType && e.pointerType !== 'mouse') return;
  document.body.classList.add('has-pointer');
  const c = String(Math.floor(e.clientX / CELLPX) + 1).padStart(2, '0');
  const r = String(Math.floor(e.clientY / CELLPX) + 1).padStart(2, '0');
  cell.textContent = `C${c}:R${r}`;
  cell.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 18}px)`;
});

/* ──────────────────────────────────────────────
   4 · PIPELINE CONSOLE
────────────────────────────────────────────── */
const consoleBody = document.getElementById('consoleBody');
const LINES = [
  '▸ reading prospect sheet…',
  '▸ screening company news…',
  '▸ embedding 3,000+ reports…',
  '▸ GPT reranking matches…',
  '▸ writing 4 emails → sheet',
  '✓ cadence complete. next lead.',
];

if (consoleBody && !prefersReduced) {
  let li = 0;
  const maxRows = 5;
  function typeLine() {
    const line = LINES[li % LINES.length];
    const el = document.createElement('div');
    if (line.startsWith('✓')) el.className = 'done';
    consoleBody.appendChild(el);
    while (consoleBody.children.length > maxRows) consoleBody.removeChild(consoleBody.firstChild);

    let ci = 0;
    const iv = setInterval(() => {
      el.textContent = line.slice(0, ++ci);
      if (ci >= line.length) {
        clearInterval(iv);
        li++;
        setTimeout(typeLine, li % LINES.length === 0 ? 2200 : 700);
      }
    }, 26);
  }
  setTimeout(typeLine, 1200);
} else if (consoleBody) {
  consoleBody.innerHTML = LINES.slice(0, 5).map((l) => `<div>${l}</div>`).join('');
}

/* ──────────────────────────────────────────────
   5 · FORMULA BAR
────────────────────────────────────────────── */
const fxOut = document.getElementById('fxOut');
const FX_IDLE = 'hover a skill to run the audit';
document.querySelectorAll('.chip[data-fx]').forEach((chip) => {
  const show = () => (fxOut.textContent = chip.dataset.fx);
  const hide = () => (fxOut.textContent = FX_IDLE);
  chip.addEventListener('mouseenter', show);
  chip.addEventListener('focus', show);
  chip.addEventListener('mouseleave', hide);
  chip.addEventListener('blur', hide);
});

/* ──────────────────────────────────────────────
   6 · THROTTLE + TACHOMETER
────────────────────────────────────────────── */
const throttleBtn = document.getElementById('throttle');
const needle = document.getElementById('needle');
const rpmText = document.getElementById('rpmText');
const bikeCard = document.getElementById('bikeCard');
const ticksGroup = document.getElementById('ticks');

if (throttleBtn && needle) {
  // draw dial ticks (0 to 12k rpm across a 240° sweep, -210° to 30°)
  const A0 = -210, A1 = 30;
  for (let i = 0; i <= 12; i++) {
    const a = ((A0 + (i / 12) * (A1 - A0)) * Math.PI) / 180;
    const r1 = 78, r2 = i % 2 === 0 ? 68 : 73;
    const x1 = 110 + Math.cos(a) * r1, y1 = 110 + Math.sin(a) * r1;
    const x2 = 110 + Math.cos(a) * r2, y2 = 110 + Math.sin(a) * r2;
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    t.setAttribute('x1', x1); t.setAttribute('y1', y1);
    t.setAttribute('x2', x2); t.setAttribute('y2', y2);
    ticksGroup.appendChild(t);
  }

  let rpm = 0, holding = false;
  const MAX = 12000, REDLINE = 9500;

  const start = (e) => { e.preventDefault(); holding = true; };
  const stop = () => { holding = false; };
  throttleBtn.addEventListener('pointerdown', start);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  throttleBtn.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); holding = true; }
  });
  throttleBtn.addEventListener('keyup', () => (holding = false));

  (function rev() {
    requestAnimationFrame(rev);
    if (holding) rpm = Math.min(MAX, rpm + 190 + rpm * 0.012);
    else rpm = Math.max(0, rpm * 0.955 - 40);

    // idle flutter so the needle feels alive
    const flutter = rpm > 200 && !prefersReduced ? (Math.random() - 0.5) * 120 : 0;
    const shown = Math.max(0, rpm + flutter);

    const deg = -120 + (shown / MAX) * 240; // needle: -120° at 0, +120° at max
    needle.style.transform = `rotate(${deg}deg)`;
    rpmText.textContent = `${Math.round(shown).toLocaleString()} RPM${rpm >= REDLINE ? ' · REDLINE' : ''}`;

    const red = rpm >= REDLINE;
    throttleBtn.classList.toggle('revving', holding);
    if (!prefersReduced) bikeCard.classList.toggle('redline', red);
    if (three) three.rumble = red ? 1.4 : holding ? 0.5 : 0;
  })();
}

/* ──────────────────────────────────────────────
   7 · REVEALS · COUNTERS · LIVE CELLS · CLOCK
────────────────────────────────────────────── */
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    const num = en.target.querySelector?.('.stat-num[data-count]');
    if (num && !num.dataset.done) runCounter(num);
    io.unobserve(en.target);
  });
}, { threshold: 0.18 });

document.querySelectorAll('.reveal, .stat').forEach((el) => io.observe(el));

function runCounter(el) {
  el.dataset.done = '1';
  const end = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || '';
  if (prefersReduced) { el.textContent = end.toLocaleString() + suffix; return; }
  const dur = 1400, t0 = performance.now();
  (function step(t) {
    const p = Math.min((t - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(end * eased).toLocaleString() + suffix;
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

// live "cells auto-filled" ticker: irregular bursts, like a real pipeline
const liveCells = document.getElementById('liveCells');
if (liveCells) {
  let n = 0;
  (function tick() {
    n += 1; // one cell at a time — the pipeline is thorough, not frantic
    liveCells.textContent = n.toLocaleString();
    setTimeout(tick, prefersReduced ? 6000 : 2500 + Math.random() * 3000);
  })();
}

// pipeline step stagger indices
document.querySelectorAll('.pipeline').forEach((pl) => {
  pl.querySelectorAll('.pipe-step').forEach((s, i) => s.style.setProperty('--i', i));
});

// Pune clock (IST is UTC+5:30, no DST, blissfully simple)
const clockEl = document.getElementById('puneClock');
if (clockEl) {
  (function clock() {
    const now = new Date();
    const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
    const p = (x) => String(x).padStart(2, '0');
    clockEl.textContent = `PUNE, IN · ${p(ist.getHours())}:${p(ist.getMinutes())}:${p(ist.getSeconds())} IST`;
    setTimeout(clock, 1000);
  })();
}

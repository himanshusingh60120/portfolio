/* ══════════════════════════════════════════════════════════
   HIMANSHU SINGH · portfolio interactions
   1. Three.js particle field — MANUAL chaos ⇄ AUTOMATED grid
   2. Cell-reference cursor
   3. Pipeline console typing
   4. Stat counters + scroll reveals
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
    const COUNT = isMobile ? 2600 : 5200;

    /* CHAOS: scattered noise cloud (the manual world) */
    const chaos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      chaos[i * 3]     = (Math.random() - 0.5) * 90;
      chaos[i * 3 + 1] = (Math.random() - 0.5) * 46;
      chaos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }

    /* ORDER: a rising bar-chart grid (the automated world) */
    const order = new Float32Array(COUNT * 3);
    {
      const COLS = isMobile ? 14 : 22;      // bars across x
      const DEPTH = 4;                       // rows in z
      const spacing = isMobile ? 3.4 : 3.1;
      const x0 = -((COLS - 1) * spacing) / 2;

      // deterministic "revenue curve" heights — trends up, of course
      const heights = [];
      for (let c = 0; c < COLS; c++) {
        const trend = 6 + (c / (COLS - 1)) * 18;
        const wobble = Math.sin(c * 1.7) * 3 + Math.sin(c * 0.6) * 2;
        heights.push(Math.max(4, trend + wobble));
      }

      let i = 0;
      while (i < COUNT) {
        const c = i % COLS;
        const h = heights[c];
        order[i * 3]     = x0 + c * spacing + (Math.random() - 0.5) * 0.9;
        order[i * 3 + 1] = -14 + Math.random() * h;
        order[i * 3 + 2] = (Math.random() - 0.5) * DEPTH * 2.4;
        i++;
      }
    }

    /* colors: ink dots with a scatter of pine + lime */
    const colors = new Float32Array(COUNT * 3);
    const cInk  = new THREE.Color('#12140D');
    const cPine = new THREE.Color('#175E3B');
    const cLime = new THREE.Color('#9DBE2E'); // lime, darkened to read on paper
    for (let i = 0; i < COUNT; i++) {
      const r = Math.random();
      const c = r < 0.72 ? cInk : (r < 0.92 ? cPine : cLime);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }

    const positions = new Float32Array(chaos); // live buffer
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: isMobile ? 0.42 : 0.34,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    scene.add(new THREE.Points(geo, mat));

    three = {
      renderer, scene, camera, geo, positions, chaos, order, COUNT,
      mix: 0, target: 0,                      // 0 = chaos · 1 = order
      mouse: new THREE.Vector2(-99, -99),
      mouseWorld: new THREE.Vector3(999, 999, 0),
      raycaster: new THREE.Raycaster(),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      t: 0,
    };

    resize();
    animate();
  } catch (e) {
    canvas.style.display = 'none'; // graceful: page works fine without WebGL
  }
}

function resize() {
  if (!three) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  three.renderer.setSize(w, h, false);
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

  // ease mix toward target
  T.mix += (T.target - T.mix) * 0.035;
  const m = T.mix;
  const drift = prefersReduced ? 0 : 1;

  const pos = T.positions, ch = T.chaos, or = T.order;
  const mw = T.mouseWorld;

  for (let i = 0; i < T.COUNT; i++) {
    const ix = i * 3, iy = ix + 1, iz = ix + 2;

    // chaotic drift (only meaningful in manual mode)
    const dx = Math.sin(T.t * 3 + i * 0.37) * 1.6 * (1 - m) * drift;
    const dy = Math.cos(T.t * 2.4 + i * 0.51) * 1.6 * (1 - m) * drift;

    // ordered breathing (subtle, in auto mode)
    const by = Math.sin(T.t * 5 + or[ix] * 0.4) * 0.25 * m * drift;

    let tx = ch[ix] * (1 - m) + or[ix] * m + dx;
    let ty = ch[iy] * (1 - m) + or[iy] * m + dy + by;
    let tz = ch[iz] * (1 - m) + or[iz] * m;

    // mouse repulsion
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

    // smooth follow
    pos[ix] += (tx - pos[ix]) * 0.08;
    pos[iy] += (ty - pos[iy]) * 0.08;
    pos[iz] += (tz - pos[iz]) * 0.08;
  }

  T.geo.attributes.position.needsUpdate = true;

  // gentle camera parallax
  if (!prefersReduced) {
    T.camera.position.x += (T.mouse.x * 3 - T.camera.position.x) * 0.02;
    T.camera.position.y += (4 + T.mouse.y * 1.5 - T.camera.position.y) * 0.02;
  }
  T.camera.lookAt(0, 0, 0);
  T.renderer.render(T.scene, T.camera);
}

initField();

/* ── the switch ─────────────────────────────── */
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

// auto-demo: if the visitor hasn't flipped it, flip it for them once
let touched = false;
toggle.addEventListener('click', () => (touched = true), { once: true });
if (!prefersReduced) {
  setTimeout(() => { if (!touched) setMode(true); }, 7000);
}

/* ──────────────────────────────────────────────
   2 · CELL-REFERENCE CURSOR
────────────────────────────────────────────── */
const cell = document.getElementById('cellCursor');
const CELLPX = 32; // matches graph-paper background-size
window.addEventListener('pointermove', (e) => {
  if (e.pointerType && e.pointerType !== 'mouse') return;
  document.body.classList.add('has-pointer');
  const c = String(Math.floor(e.clientX / CELLPX) + 1).padStart(2, '0');
  const r = String(Math.floor(e.clientY / CELLPX) + 1).padStart(2, '0');
  cell.textContent = `C${c}:R${r}`;
  cell.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 18}px)`;
});

/* ──────────────────────────────────────────────
   3 · PIPELINE CONSOLE
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
  consoleBody.innerHTML = LINES.map(l => `<div>${l}</div>`).slice(0, 5).join('');
}

/* ──────────────────────────────────────────────
   4 · REVEALS + COUNTERS + PIPELINE STAGGER
────────────────────────────────────────────── */
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    const num = en.target.querySelector?.('.stat-num') ||
                (en.target.classList.contains('stat-num') ? en.target : null);
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

// stagger pipeline steps on hover via CSS custom property
document.querySelectorAll('.pipeline').forEach((pl) => {
  pl.querySelectorAll('.pipe-step').forEach((s, i) => s.style.setProperty('--i', i));
});

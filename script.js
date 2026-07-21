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

let THREE = null;

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Load three.js without letting a CDN hiccup kill the whole script.
   Primary: the import-map entry. Fallback: a second CDN. */
(async () => {
  try {
    THREE = await import('three');
  } catch {
    try {
      THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
    } catch {
      document.getElementById('field').style.display = 'none';
      return;
    }
  }
  initField();
})();

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
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    camera.position.set(0, 4, 46);

    const isMobile = window.innerWidth < 700;
    const COUNT = isMobile ? 3800 : 9500;

    /* CHAOS: scattered noise cloud (the manual world) */
    const chaos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      chaos[i * 3]     = (Math.random() - 0.5) * 90;
      chaos[i * 3 + 1] = (Math.random() - 0.5) * 46;
      chaos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }

    /* ORDER: a DNA double helix spanning the FULL hero width, edge to edge,
       no gaps. Its VERTICAL band is bound at runtime to the real DOM: the
       top sits just BELOW the eyebrow line ("Himanshu Singh · …") and the
       bottom sits just ABOVE the intro paragraph ("Business analyst by …"),
       so neither line of text ever overlaps the strands. The title layers
       on top of the left portion. Forms by rising from below. Live each frame.

       ★★ HELIX TUNING ★★
       spanFrac  : width as a fraction of the hero width (>1 overshoots the
                   screen edges so the ends never leave a gap)
       cxFrac    : horizontal center (0 = middle)
       topPad/botPad : px breathing room below the eyebrow / above the intro
       Vertical size + center are computed from the DOM in resize(); the
       *Frac fallbacks below are only used if that measurement isn't ready. */
    const HELIX_CFG = {
      spanFrac: 1.08,
      cxFrac:   0,
      topPad:   14,
      botPad:   14,
      // fallbacks (used only before the first DOM measurement lands)
      heightFrac: 0.6,
      cyFrac:     0,
      tube: isMobile ? 1.2 : 1.6,
    };
    const HELIX_TUBE = HELIX_CFG.tube;

    const helix = {
      s: new Float32Array(COUNT),      // 0..1 position along the strand
      role: new Uint8Array(COUNT),     // 0/1 = backbone strands, 2 = base-pair rung
      f: new Float32Array(COUNT),      // rung fraction between the strands
      ox: new Float32Array(COUNT),     // fixed thickness offsets (the "tube")
      oy: new Float32Array(COUNT),
      oz: new Float32Array(COUNT),
      cfg: HELIX_CFG,
      span: 50,        // real values written by resize() from the frustum
      radius: 13,
      rz: 8,           // depth radius, kept flatter so perspective doesn't
      cx: 0,           // bulge particles outside the band
      cy: 0,
      turns: isMobile ? 4.5 : 8.5,
      rungs: isMobile ? 26 : 52,
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

    /* SWARM-IN INTRO: every particle starts far outside the frame on a
       big random shell, then swarms into the chaos cloud on load */
    const introFrom = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const rad = 120 + Math.random() * 80;
      introFrom[i * 3]     = Math.sin(ph) * Math.cos(th) * rad;
      introFrom[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * rad * 0.6;
      introFrom[i * 3 + 2] = Math.cos(ph) * rad * 0.5;
    }

    /* first frame starts off-screen (or settled, if reduced motion) */
    const positions = new Float32Array(prefersReduced ? chaos : introFrom);
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

    /* Draw digits into a scratch canvas first and VERIFY pixels actually
       landed before swapping it in. A blank atlas = every fragment
       discarded = invisible field, so we never blindly clear + redraw. */
    const scratch = document.createElement('canvas');
    scratch.width = 640; scratch.height = 64;
    const sctx = scratch.getContext('2d', { willReadFrequently: true });

    function renderDigits(ctx, font) {
      ctx.clearRect(0, 0, 640, 64);
      ctx.fillStyle = '#fff';
      ctx.font = font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let d = 0; d < 10; d++) ctx.fillText(String(d), d * 64 + 32, 36);
    }

    function hasInk(ctx) {
      // sample the strip; if fillText silently painted nothing, alpha is all 0
      const px = ctx.getImageData(0, 16, 640, 32).data;
      for (let i = 3; i < px.length; i += 64) if (px[i] > 32) return true;
      return false;
    }

    function tryDrawAtlas(font) {
      try {
        renderDigits(sctx, font);
        if (!hasInk(sctx)) return false;      // font painted nothing → reject
        actx.clearRect(0, 0, 640, 64);
        actx.drawImage(scratch, 0, 0);
        atlas.needsUpdate = true;
        return true;
      } catch { return false; }
    }

    /* guaranteed-visible first draw: system monospace, with verification */
    renderDigits(actx, '700 52px monospace');
    const atlas = new THREE.CanvasTexture(atlasCanvas);
    tryDrawAtlas('700 52px monospace');

    /* Upgrade to IBM Plex Mono only once it verifiably renders. Retry a
       few times because fonts.load() can resolve before glyphs rasterize. */
    if (document.fonts?.load) {
      let tries = 0;
      const upgrade = () => {
        if (tryDrawAtlas('700 52px "IBM Plex Mono", monospace')) return;
        if (++tries < 5) setTimeout(upgrade, 400 * tries);
      };
      document.fonts.load('700 52px "IBM Plex Mono"')
        .then(() => {
          if (document.fonts.check('700 52px "IBM Plex Mono"')) upgrade();
        })
        .catch(() => {});
    }

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
      introFrom,
      intro: prefersReduced ? 1 : 0, // 0 → off-screen shell, 1 → settled
      // auto-demo clock (frame-driven, so it can't get stuck like timers can)
      demoT: 0,        // seconds elapsed in the demo cycle
      demoAuto: false, // last mode the demo asked for
      last: 0,         // performance.now() of previous frame
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
  if (!w || !h) { requestAnimationFrame(resize); return; } // layout not ready yet
  three.renderer.setSize(w, h, false);
  three.mat.uniforms.uScale.value = h * 0.5 * Math.min(window.devicePixelRatio, 2);
  three.camera.aspect = w / h;
  three.camera.updateProjectionMatrix();

  /* size the helix off the ACTUAL visible area at z = 0, so it always
     sits in the same on-screen band regardless of viewport shape */
  const dist = three.camera.position.z;
  const visH = 2 * dist * Math.tan((three.camera.fov * Math.PI) / 360);
  const visW = visH * three.camera.aspect;
  const H = three.helix, C = H.cfg;
  H.span = visW * C.spanFrac;
  H.cx   = visW * C.cxFrac;

  /* Vertical band from the ACTUAL text boxes: top edge drops just below the
     eyebrow, bottom edge stops just above the intro paragraph, so neither
     line of copy overlaps the strands. Measured in px relative to the hero
     (the canvas fills it), then mapped into world Y. */
  const heroEl = document.getElementById('hero');
  const ebEl   = document.querySelector('.eyebrow');
  const subEl  = document.querySelector('.hero-sub');
  let mapped = false;
  if (heroEl && ebEl && subEl) {
    const hr = heroEl.getBoundingClientRect();
    const er = ebEl.getBoundingClientRect();
    const sr = subEl.getBoundingClientRect();
    const topPx = (er.bottom - hr.top) + C.topPad;   // below the eyebrow
    const botPx = (sr.top    - hr.top) - C.botPad;   // above the intro copy
    if (botPx - topPx > 40) {                         // sane band → use it
      const yTop = (0.5 - topPx / hr.height) * visH;  // px(top-down) → world(up)
      const yBot = (0.5 - botPx / hr.height) * visH;
      H.cy     = (yTop + yBot) / 2;
      H.radius = Math.abs(yTop - yBot) / 2;
      H.rz     = H.radius * 0.5;
      mapped = true;
    }
  }
  if (!mapped) {                                       // fallback: fractions
    H.cy     = visH * C.cyFrac;
    H.radius = (visH * C.heightFrac) / 2;
    H.rz     = H.radius * 0.5;
  }
}
window.addEventListener('resize', resize);

/* ── resilience: the two ways the field can silently die ──
   1. WebGL context loss (common on mobile when the tab is backgrounded,
      or when reopening the link): preventDefault so the browser restores
      the context, then resize + replay the swarm when it comes back. */
canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
canvas.addEventListener('webglcontextrestored', () => {
  if (!three) return;
  resize();
  three.mat.uniforms.uAtlas.value.needsUpdate = true; // re-upload texture
  three.intro = prefersReduced ? 1 : 0;               // swarm back in
  resetToScatter(); // land in the chaos cloud, never straight into the helix
});

/* 2. bfcache restore: opening the link again can resurrect the page from
      cache with a stale/blank canvas. Re-sync and replay the entrance. */
window.addEventListener('pageshow', (e) => {
  if (!e.persisted || !three) return;
  resize();
  three.mat.uniforms.uAtlas.value.needsUpdate = true;
  three.intro = prefersReduced ? 1 : 0;
  // park everything back on the shell so the swarm-in is visible again
  three.positions.set(prefersReduced ? three.chaos : three.introFrom);
  three.geo.attributes.position.needsUpdate = true;
  resetToScatter(); // replayed intro must land in chaos, not the helix
});

/* Snap the mode back to MANUAL so a replayed entrance always swarms
   into the scattered digits first. The helix instantly forming on a
   revisit was a bug: the demo/toggle state survived the page restore. */
function resetToScatter() {
  if (three) {
    three.mix = 0; three.target = 0;
    three.demoT = 0; three.demoAuto = false; // restart the auto-demo cycle
  }
  // setMode is hoisted; guard in case the toggle markup ever changes
  if (typeof setMode === 'function') setMode(false);
}

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

  /* real elapsed time, clamped so a backgrounded tab can't jump the clock */
  const now = performance.now();
  const dt = T.last ? Math.min(0.05, (now - T.last) / 1000) : 0.016;
  T.last = now;

  /* ── AUTO-DEMO as a state machine ──────────────────────────────
     Every frame we recompute which mode the demo *should* be in from a
     single clock. There's no setTimeout chain to drop, so it can never
     get stuck "loaded but not coming back": if a frame is missed the next
     one just reads the clock and corrects. Stops the instant the user
     interacts (touched), and respects reduced-motion. */
  if (!touched && !prefersReduced) {
    T.demoT += dt;
    const REST = 6.5, HOLD = 9.0;          // seconds scattered / seconds helix
    const phase = T.demoT % (REST + HOLD);
    const wantAuto = phase >= REST;
    if (wantAuto !== T.demoAuto) { T.demoAuto = wantAuto; setMode(wantAuto); }
  }

  T.t += 0.004;

  T.mix += (T.target - T.mix) * 0.035;
  const m = T.mix;
  const drift = prefersReduced ? 0 : 1;
  const rumble = T.rumble * drift; // extra jitter while the engine revs

  const pos = T.positions, ch = T.chaos, or = T.order;
  const mw = T.mouseWorld;

  /* swarm-in progress: ~1.6s, ease-out so it decelerates into place */
  if (T.intro < 1) T.intro = Math.min(1, T.intro + 0.011);
  const ie = 1 - Math.pow(1 - T.intro, 3);

  /* write this frame's DNA helix into `order` — the spin makes it
     look like the molecule is flowing in from the sides of the screen */
  if (m > 0.004) {
    const H = T.helix, TAU = Math.PI * 2;
    const spin = T.t * (drift ? 2.2 : 0);          // screw rotation = sideways flow
    const sway = Math.sin(T.t * 0.8) * 0.8 * drift; // gentle vertical breathing
    /* the helix FORMS FROM BELOW: while the mix is settling, its target
       is displaced under the hero and slides up into place */
    const rise = (1 - m) * (1 - m) * -(H.radius * 2.6);
    for (let i = 0; i < T.COUNT; i++) {
      const s = H.s[i], j = i * 3;
      const x = (s - 0.5) * H.span + H.cx + H.ox[i];
      const a = s * H.turns * TAU + spin;
      if (H.role[i] === 2) {
        // base-pair rung: bridge between the two backbones
        const k = 1 - 2 * H.f[i];
        or[j]     = x;
        or[j + 1] = Math.cos(a) * H.radius * k + H.cy + H.oy[i] + sway + rise;
        or[j + 2] = Math.sin(a) * H.rz * k + H.oz[i];
      } else {
        const ph = H.role[i] === 0 ? 0 : Math.PI;
        or[j]     = x;
        or[j + 1] = Math.cos(a + ph) * H.radius + H.cy + H.oy[i] + sway + rise;
        or[j + 2] = Math.sin(a + ph) * H.rz + H.oz[i];
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

    if (ie < 1) {
      // stagger: earlier particles land first, the tail keeps streaming in
      const e = Math.min(1, Math.max(0, ie * 1.35 - (i / T.COUNT) * 0.35));
      const inv = 1 - e;
      tx = T.introFrom[ix] * inv + tx * e;
      ty = T.introFrom[iy] * inv + ty * e;
      tz = T.introFrom[iz] * inv + tz * e;
    }

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

// auto-demo: if the visitor never flips the switch, the field cycles itself
// (scattered digits → helix → back to digits, forever) via the frame-driven
// state machine in animate(). Any manual interaction sets `touched` and the
// demo bows out, leaving the visitor's choice in place.
let touched = false;
function stopDemo() { touched = true; }
toggle.addEventListener('click', stopDemo, { once: true });

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

/* ───────────────────────────────────────────────
   LOCKED PROJECTS · internal tools, no tourists
─────────────────────────────────────────────── */
(() => {
  const EXCUSES = [
    "This one's internal — it's wired into live company data, and my employer has a strong preference for that data staying employed here too. You get the blueprint above; the keys stay in the building.",
    "Still locked. The tool runs against a real prospect database with real people's emails in it. Opening that to the internet is how you end up in a compliance meeting with no snacks.",
    "I admire the persistence. It genuinely exists and genuinely runs — every weekday, on production data. That's exactly why it can't be a public demo. The pipeline diagram above is the guided tour.",
    "Okay, real talk: the API keys alone would make this demo the most expensive free product on the internet. Read the write-up, then ask me about it — I'll happily walk through the architecture on a call.",
    "You've clicked this five times. I respect that. It's still internal. But this level of QA instinct is exactly what these tools are built to reward — my contact section is right at the bottom.",
  ];

  document.querySelectorAll('.project-locked').forEach((card) => {
    let clicks = 0;
    let note = null;

    const show = () => {
      if (!note) {
        note = document.createElement('p');
        note.className = 'locked-note mono';
        card.querySelector('.project-main').appendChild(note);
      }
      note.textContent = '⌁ ' + EXCUSES[Math.min(clicks, EXCUSES.length - 1)];
      note.classList.remove('pop');
      void note.offsetWidth;           // restart the animation
      note.classList.add('pop');
      clicks++;
    };

    card.addEventListener('click', show);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); }
    });
  });
})();

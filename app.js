/**
 * Doodle Faces — the studio.
 *
 * Two modes over the same generator:
 *   sheet  a contact sheet for rummaging through a population
 *   focus  one portrait, big, live-editable
 *
 * The sheet renders in slices across animation frames and cancels itself when
 * the inputs change again, so no control can ever block the page — that is what
 * makes dragging a slider over a 160-face sheet feel instant even though the
 * total work is unchanged.
 */

import {
  BEARD_STYLES, BROW_STYLES, EAR_STYLES, EYE_STYLES, GLASSES_STYLES, HAIR_STYLES,
  HAT_STYLES, HEAD_SHAPES, MOUTH_STYLES, NOSE_STYLES,
  KIN, KIN_NAMES, LOOKS, LOOK_NAMES, PEN_NAMES, PEN_STYLES,
} from './src/faces/genome.js';
import { drawFace, faceToDataURL, makeGenome, renderFace, renderSheet } from './src/faces/face.js';
import { PRESETS, PRESET_NAMES } from './src/faces/presets.js';
import { atlasSeeds, buildAtlas } from './src/faces/atlas.js';
import { makeRng } from './src/faces/rng.js';
import { breed } from './src/faces/breed.js';

const $ = (id) => document.getElementById(id);
const labelOf = (table, key) => (table[key] && table[key].label) || key;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Turn a camelCase enum value into something readable. */
function pretty(v) {
  return v.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Trait pins
// ---------------------------------------------------------------------------

const TRAITS = [
  ['kin', 'Kin', KIN_NAMES, (v) => labelOf(KIN, v)],
  ['look', 'Archetype', LOOK_NAMES, (v) => labelOf(LOOKS, v)],
  ['pen', 'Pen', PEN_NAMES, (v) => labelOf(PEN_STYLES, v)],
  ['head', 'Skull', HEAD_SHAPES, pretty],
  ['hair', 'Hair', HAIR_STYLES, pretty],
  ['eyes', 'Eyes', EYE_STYLES, pretty],
  ['brows', 'Brows', BROW_STYLES, pretty],
  ['nose', 'Nose', NOSE_STYLES, pretty],
  ['mouth', 'Mouth', MOUTH_STYLES, pretty],
  ['beard', 'Facial hair', BEARD_STYLES, pretty],
  ['ears', 'Ears', EAR_STYLES, pretty],
  ['glasses', 'Glasses', GLASSES_STYLES, pretty],
  ['hat', 'Headwear', HAT_STYLES, pretty],
];

const traitSelects = new Map();

function buildTraitFields() {
  const host = $('traitFields');
  for (const [key, label, values, name] of TRAITS) {
    const wrap = document.createElement('div');
    wrap.className = 'trait';

    const field = document.createElement('label');
    field.className = 'field';
    const span = document.createElement('span');
    span.textContent = label;
    const sel = document.createElement('select');
    sel.innerHTML =
      '<option value="">Random</option>' +
      values.map((v) => `<option value="${v}">${name(v)}</option>`).join('');
    sel.addEventListener('change', () => {
      sel.classList.toggle('is-pinned', !!sel.value);
      onPinsChanged();
    });
    field.append(span, sel);
    traitSelects.set(key, sel);

    const dice = document.createElement('button');
    dice.type = 'button';
    dice.className = 'ghost dice';
    dice.textContent = '🎲';
    dice.title = `Reroll ${label.toLowerCase()}`;
    dice.addEventListener('click', () => rerollTrait(key, values));

    wrap.append(field, dice);
    host.append(wrap);
  }
}

function currentPins() {
  const force = {};
  for (const [key] of TRAITS) {
    const v = traitSelects.get(key).value;
    if (v) force[key] = v;
  }
  return force;
}

// ---------------------------------------------------------------------------
// Live proportion sliders, bound to fields of the focused genome
// ---------------------------------------------------------------------------

const PROPS = [
  ['head.w', 'Skull width', 20, 46, 0.5],
  ['head.h', 'Skull height', 24, 50, 0.5],
  ['head.jaw', 'Jaw', 0.5, 1.5, 0.01],
  ['head.brow', 'Brow width', 0.6, 1.4, 0.01],
  ['head.exp', 'Squareness', 1.5, 3.6, 0.05],
  ['head.lopsided', 'Lopsided', -0.14, 0.14, 0.005],
  ['eyes.size', 'Eye size', 0.5, 2.2, 0.02],
  ['eyes.spacing', 'Eye spacing', 0.26, 0.66, 0.01],
  ['eyes.asym', 'Eye mismatch', -0.5, 0.5, 0.01],
  ['nose.size', 'Nose size', 0.5, 2.4, 0.02],
  ['nose.y', 'Nose height', -0.12, 0.14, 0.005],
  ['mouth.w', 'Mouth width', 0.5, 2.2, 0.02],
  ['mouth.y', 'Mouth height', -0.12, 0.14, 0.005],
  ['hair.puff', 'Hair volume', 0.3, 2.2, 0.02],
  ['hair.density', 'Hair density', 0.4, 2, 0.02],
  ['beard.gap', 'Facial hair spread', 0.4, 1.8, 0.02],
];

const propInputs = new Map();

function buildPropFields() {
  const host = $('propFields');
  for (const [path, label, min, max, step] of PROPS) {
    const field = document.createElement('label');
    field.className = 'field slider';
    const out = document.createElement('b');
    const span = document.createElement('span');
    span.append(label, out);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.addEventListener('input', () => {
      if (!focused) return;
      setPath(focused, path, +input.value);
      out.textContent = fmt(+input.value);
      drawPortrait({ coarse: true });
      schedulePortraitSharpen();
    });
    input.addEventListener('change', syncGenomeText);
    field.append(span, input);
    host.append(field);
    propInputs.set(path, { input, out });
  }
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}
const fmt = (n) => (Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(2));

function syncPropFields() {
  if (!focused) return;
  for (const [path, { input, out }] of propInputs) {
    const v = getPath(focused, path);
    if (typeof v === 'number') {
      input.value = v;
      out.textContent = fmt(v);
    }
  }
  $('expr').value = focused.expression || 0;
  $('exprOut').textContent = (focused.expression || 0).toFixed(2);
  $('yaw').value = Math.round(((focused.head.yaw || 0) * 180) / Math.PI);
  $('yawOut').textContent = $('yaw').value;
  $('tilt').value = Math.round(((focused.head.tilt || 0) * 180) / Math.PI);
  $('tiltOut').textContent = $('tilt').value;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function presetOpts(name) {
  const p = PRESETS[name] || {};
  return { weights: p.weights, kin: p.kin, look: p.look };
}

function readOpts() {
  return {
    seed: $('seed').value || 'notebook',
    count: +$('count').value,
    size: +$('size').value,
    weight: +$('weight').value,
    shake: +$('shake').value,
    color: +$('color').value,
    turn: +$('turn').value,
    mood: +$('mood').value,
    paper: $('paper').checked,
    oneSheet: $('oneSheet').checked && $('paper').checked,
    force: currentPins(),
    preset: $('preset').value,
    ...presetOpts($('preset').value),
  };
}

/** Everything makeGenome needs, and nothing it doesn't. */
function genomeOpts(o) {
  return {
    force: o.force,
    weights: o.weights,
    kin: o.kin,
    look: o.look,
    color: o.color,
    turn: o.turn,
    mood: o.mood,
  };
}

let opts = null;
let seeds = [];
let mode = 'sheet';
let focusIndex = 0;
let focused = null;

// ---------------------------------------------------------------------------
// Sheet — rendered in slices so it can never block the page
// ---------------------------------------------------------------------------

let sheetToken = 0;

/**
 * Cells are pooled and their canvases reused.
 *
 * Rebuilding 160 buttons and allocating 160 fresh canvases on every slider
 * tick cost 100-230ms in one blocking frame — the DOM teardown, not the
 * drawing, was the bottleneck. Now the nodes persist and each redraw only
 * touches pixels.
 */
const pool = [];

function poolCell(i) {
  if (pool[i]) return pool[i];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cell';
  button.dataset.index = i;
  const canvas = document.createElement('canvas');
  button.append(canvas);
  const entry = { button, canvas, ctx: canvas.getContext('2d'), w: 0, h: 0 };
  pool[i] = entry;
  return entry;
}

function renderContactSheet() {
  const o = opts;
  const token = ++sheetToken;
  const host = $('sheet');
  host.style.setProperty('--cell', `${o.size}px`);
  host.classList.toggle('one-sheet', o.oneSheet);

  const dpr = Math.min(o.size < 200 ? 1.5 : 2, window.devicePixelRatio || 1);
  const px = Math.round(o.size * dpr);

  // grow or shrink the pool, without touching the cells that stay
  for (let i = 0; i < seeds.length; i++) {
    const cell = poolCell(i);
    if (cell.button.parentNode !== host) host.append(cell.button);
    if (cell.w !== px) {
      cell.canvas.width = px;
      cell.canvas.height = px;
      cell.canvas.style.width = `${o.size}px`;
      cell.canvas.style.height = `${o.size}px`;
      cell.w = px;
    }
    cell.button.classList.add('is-pending');
  }
  for (let i = seeds.length; i < pool.length; i++) {
    if (pool[i].button.parentNode) pool[i].button.remove();
  }

  let i = 0;
  const step = () => {
    if (token !== sheetToken) return; // superseded by a newer request
    const started = performance.now();
    // ~10ms of work per frame leaves the rest of the budget to the UI
    while (i < seeds.length && performance.now() - started < 10) {
      const cell = pool[i];
      const g = makeGenome(seeds[i], genomeOpts(o));
      const ctx = cell.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cell.canvas.width, cell.canvas.height);
      ctx.scale(dpr, dpr);
      drawFace(ctx, g, {
        size: o.size,
        weight: o.weight,
        shake: o.shake,
        paper: o.oneSheet ? false : o.paper,
      });
      cell.button.classList.remove('is-pending');
      cell.button.title = `${g.seed}
${labelOf(KIN, g.kin)} · ${labelOf(LOOKS, g.look)} · ${labelOf(PEN_STYLES, g.pen.style)}`;
      i++;
    }
    if (i < seeds.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------------------
// Focus — one portrait, drawn live
// ---------------------------------------------------------------------------

let sharpenTimer = null;

function portraitSize() {
  const box = $('focus').getBoundingClientRect();
  const avail = Math.min(box.width - 130, box.height - 70);
  return Math.max(220, Math.min(620, Math.round(avail)));
}

function drawPortrait({ coarse = false } = {}) {
  if (!focused) return;
  const canvas = renderFace(focused, {
    size: portraitSize(),
    weight: opts.weight,
    shake: opts.shake,
    paper: opts.paper,
    // a coarse pass keeps a drag at 60fps; the sharp one lands on release
    lod: coarse ? 0.4 : undefined,
    dpr: coarse ? 1 : undefined,
  });
  $('portrait').replaceChildren(canvas);
  syncFavToggle();
  $('stageMeta').textContent =
    `${focused.seed} — ${labelOf(KIN, focused.kin)} · ${labelOf(LOOKS, focused.look)} · ${labelOf(PEN_STYLES, focused.pen.style)}`;
}

function schedulePortraitSharpen() {
  clearTimeout(sharpenTimer);
  sharpenTimer = setTimeout(() => drawPortrait(), 160);
}

function focusOn(index) {
  if (seeds.length === 0) return;
  focusIndex = ((index % seeds.length) + seeds.length) % seeds.length;
  focused = makeGenome(seeds[focusIndex], genomeOpts(opts));
  drawPortrait();
  syncPropFields();
  syncGenomeText();
}

/** Reroll a single trait on the focused portrait, leaving the rest alone. */
function rerollTrait(key, values) {
  if (mode !== 'focus' || !focused) {
    // on the sheet there is no single portrait, so the dice pins a value instead
    const sel = traitSelects.get(key);
    sel.value = values[Math.floor(Math.random() * values.length)];
    sel.classList.add('is-pinned');
    onPinsChanged();
    return;
  }
  const rng = makeRng(`${focused.seed}:${key}:${Math.random()}`);
  const next = makeGenome(focused.seed, {
    ...genomeOpts(opts),
    force: { ...pinsFromGenome(focused), ...opts.force, [key]: rng.pick(values) },
  });
  // keep the pose the user has dialled in
  next.head.yaw = focused.head.yaw;
  next.head.tilt = focused.head.tilt;
  focused = next;
  drawPortrait();
  syncPropFields();
  syncGenomeText();
}

/** Read back the enum traits of a genome, so a reroll only moves one of them. */
function pinsFromGenome(g) {
  return {
    kin: g.kin,
    look: g.look,
    pen: g.pen.style,
    head: g.head.shape,
    hair: g.hair.style,
    eyes: g.eyes.style,
    brows: g.brows.style,
    nose: g.nose.style,
    mouth: g.mouth.style,
    beard: g.beard.style,
    ears: g.ears.style,
    glasses: g.glasses.style,
    hat: g.hat.style,
  };
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

/** Round the numbers down before encoding — the URL is long enough already. */
const compact = (g) => JSON.parse(JSON.stringify(g, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));

function encodeGenome(g) {
  const bytes = new TextEncoder().encode(JSON.stringify(compact(g)));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeGenome(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * A link to exactly what is on screen.
 *
 * An untouched face is fully described by its seed plus the settings, so the
 * link stays short. Once the genome has been edited by hand there is nothing to
 * derive it from, so the whole thing goes in the fragment.
 */
function shareLink() {
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  const p = url.searchParams;
  p.set('seed', opts.seed);
  p.set('preset', opts.preset);
  if (mode !== 'sheet') p.set('i', String(focusIndex));
  for (const [k, v] of Object.entries(opts.force)) p.set(`p_${k}`, v);
  for (const k of ['color', 'turn', 'mood', 'weight', 'shake']) {
    if (opts[k] !== DEFAULTS[k]) p.set(k, String(opts[k]));
  }
  if (mode === 'focus' && focused) {
    const derived = makeGenome(seeds[focusIndex], genomeOpts(opts));
    if (JSON.stringify(compact(derived)) !== JSON.stringify(compact(focused))) {
      url.hash = `g=${encodeGenome(focused)}`;
    }
  }
  return url.toString();
}

const DEFAULTS = { color: 1, turn: 1, mood: 0, weight: 1, shake: 1 };

// ---------------------------------------------------------------------------
// Favourites — kept in localStorage, which can be absent or throw
// ---------------------------------------------------------------------------

const FAV_KEY = 'doodle-faces:kept:v1';
const FAV_MAX = 60;
let favs = [];

function loadFavs() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    favs = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(favs)) favs = [];
  } catch {
    favs = []; // private window, or site data blocked
  }
}

function saveFavs() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs.slice(0, FAV_MAX)));
  } catch {
    /* nothing to do: the strip still works for this session */
  }
}

const favKey = (g) => encodeGenome(g);

function isFav(g) {
  return g ? favs.some((f) => favKey(f) === favKey(g)) : false;
}

function toggleFav() {
  if (!focused) return;
  const key = favKey(focused);
  const at = favs.findIndex((f) => favKey(f) === key);
  if (at >= 0) favs.splice(at, 1);
  else favs.unshift(JSON.parse(JSON.stringify(focused)));
  favs = favs.slice(0, FAV_MAX);
  saveFavs();
  renderFavs();
}

function renderFavs() {
  const bar = $('favBar');
  const list = $('favList');
  bar.hidden = favs.length === 0;
  list.replaceChildren();
  favs.forEach((g, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fav';
    btn.title = `${g.seed} — ${labelOf(KIN, g.kin)} · ${labelOf(LOOKS, g.look)}`;
    btn.append(renderFace(g, { size: 54, paper: true, lod: 0.5, dpr: 1 }));
    btn.addEventListener('click', () => {
      focused = JSON.parse(JSON.stringify(g));
      setMode('focus');
      drawPortrait();
      syncPropFields();
      syncGenomeText();
    });
    const drop = document.createElement('button');
    drop.type = 'button';
    drop.className = 'drop';
    drop.textContent = '✕';
    drop.title = 'Forget this one';
    drop.addEventListener('click', (e) => {
      e.stopPropagation();
      favs.splice(i, 1);
      saveFavs();
      renderFavs();
      syncFavToggle();
    });
    btn.append(drop);
    list.append(btn);
  });
  syncFavToggle();
}

function syncFavToggle() {
  const on = isFav(focused);
  $('favToggle').classList.toggle('is-on', on);
  $('favToggle').textContent = on ? '★' : '☆';
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

let cmp = { a: null, b: null, ia: 0, ib: 1 };

function comparePortraitSize() {
  const box = $('compare').getBoundingClientRect();
  const avail = Math.min((box.width - 220) / 2, box.height - 60);
  return Math.max(180, Math.min(400, Math.round(avail)));
}

function drawCompare() {
  const size = comparePortraitSize();
  for (const slot of ['a', 'b']) {
    const g = cmp[slot];
    if (!g) continue;
    const host = $(`portrait${slot.toUpperCase()}`);
    host.replaceChildren(renderFace(g, { size, weight: opts.weight, shake: opts.shake, paper: opts.paper }));
    $(`meta${slot.toUpperCase()}`).textContent =
      `${g.seed} · ${labelOf(KIN, g.kin)} · ${labelOf(LOOKS, g.look)}`;
  }
  $('stageMeta').textContent = 'A × B';
}

function stepCompare(slot, delta) {
  const key = slot === 'a' ? 'ia' : 'ib';
  cmp[key] = ((cmp[key] + delta) % seeds.length + seeds.length) % seeds.length;
  cmp[slot] = makeGenome(seeds[cmp[key]], genomeOpts(opts));
  drawCompare();
}

// ---------------------------------------------------------------------------
// Genome panel
// ---------------------------------------------------------------------------

function syncGenomeText() {
  if (!focused) return;
  // The panel shows the *compact* genome — the same rounding the share link
  // uses — so what you read is exactly what you copy or share.
  $('genomeText').value = JSON.stringify(compact(focused), null, 2);
}

function showGenomeError(msg) {
  $('genomeError').textContent = msg;
  $('genomeError').hidden = false;
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function setMode(next) {
  mode = next;
  document.body.dataset.mode = next;
  for (const [id, name] of [['tabSheet', 'sheet'], ['tabFocus', 'focus'], ['tabCompare', 'compare']]) {
    $(id).classList.toggle('is-on', next === name);
  }
  $('sheet').hidden = next !== 'sheet';
  $('focus').hidden = next !== 'focus';
  $('compare').hidden = next !== 'compare';

  if (next === 'focus') {
    if (!focused) focusOn(focusIndex);
    else drawPortrait();
    syncPropFields();
    syncGenomeText();
    syncFavToggle();
  } else if (next === 'compare') {
    if (!cmp.a) cmp.a = focused || makeGenome(seeds[cmp.ia], genomeOpts(opts));
    if (!cmp.b) cmp.b = makeGenome(seeds[cmp.ib % seeds.length], genomeOpts(opts));
    drawCompare();
  } else {
    $('stageMeta').textContent = `${seeds.length} faces · ${labelOf(PRESETS, opts.preset)}`;
  }
}

// ---------------------------------------------------------------------------
// Regeneration
// ---------------------------------------------------------------------------

function regenerate({ keepFocus = false } = {}) {
  opts = readOpts();
  seeds = Array.from({ length: opts.count }, (_, i) => `${opts.seed}#${i}`);
  if (focusIndex >= seeds.length) focusIndex = 0;

  syncReadouts();
  const url = new URL(location.href);
  url.searchParams.set('seed', opts.seed);
  history.replaceState(null, '', url);

  if (mode === 'sheet') {
    renderContactSheet();
    $('stageMeta').textContent = `${seeds.length} faces · ${labelOf(PRESETS, opts.preset)}`;
  } else if (keepFocus && focused) {
    drawPortrait();
  } else {
    focusOn(focusIndex);
  }
}

/** Pins and population change the genome, so the focused face is rebuilt. */
function onPinsChanged() {
  schedule(() => regenerate());
}

/** Pen and paper settings never touch the genome, so the pose survives. */
function onStyleChanged() {
  schedule(() => regenerate({ keepFocus: true }));
}

function syncReadouts() {
  $('countOut').textContent = opts.count;
  $('sizeOut').textContent = opts.size;
  $('weightOut').textContent = opts.weight.toFixed(2);
  $('shakeOut').textContent = opts.shake.toFixed(2);
  $('colorOut').textContent = opts.color.toFixed(1);
  $('turnOut').textContent = opts.turn.toFixed(1);
  $('moodOut').textContent = opts.mood.toFixed(1);
}

let timer = null;
function schedule(fn) {
  clearTimeout(timer);
  timer = setTimeout(fn, 70);
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

buildTraitFields();
buildPropFields();

$('preset').innerHTML = PRESET_NAMES.map(
  (n) => `<option value="${n}">${labelOf(PRESETS, n)}</option>`,
).join('');
$('preset').addEventListener('change', onPinsChanged);

$('sheet').addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell || cell.classList.contains('is-pending')) return;
  focusIndex = +cell.dataset.index;
  focused = null;
  setMode('focus');
});

$('tabSheet').addEventListener('click', () => setMode('sheet'));
$('tabFocus').addEventListener('click', () => setMode('focus'));
$('tabCompare').addEventListener('click', () => setMode('compare'));

$('favToggle').addEventListener('click', toggleFav);
$('clearFavs').addEventListener('click', () => {
  favs = [];
  saveFavs();
  renderFavs();
});

$('prevA').addEventListener('click', () => stepCompare('a', -1));
$('nextA').addEventListener('click', () => stepCompare('a', 1));
$('prevB').addEventListener('click', () => stepCompare('b', -1));
$('nextB').addEventListener('click', () => stepCompare('b', 1));
$('swapAB').addEventListener('click', () => {
  cmp = { a: cmp.b, b: cmp.a, ia: cmp.ib, ib: cmp.ia };
  drawCompare();
});
$('breedAB').addEventListener('click', () => {
  if (!cmp.a || !cmp.b) return;
  focused = breed(cmp.a, cmp.b, `${cmp.a.seed}+${cmp.b.seed}`);
  setMode('focus');
});
$('focusA').addEventListener('click', () => {
  if (!cmp.a) return;
  focused = JSON.parse(JSON.stringify(cmp.a));
  setMode('focus');
});
$('focusB').addEventListener('click', () => {
  if (!cmp.b) return;
  focused = JSON.parse(JSON.stringify(cmp.b));
  setMode('focus');
});

/** Clipboard writes are refused when the page is not focused, or sandboxed. */
function copy(text) {
  try {
    navigator.clipboard?.writeText(text)?.catch(() => {});
  } catch {
    /* nothing sensible to do; the value is still in the genome panel */
  }
}

$('copyLink').addEventListener('click', () => {
  const link = shareLink();
  copy(link);
  history.replaceState(null, '', link);
});
$('prevFace').addEventListener('click', () => focusOn(focusIndex - 1));
$('nextFace').addEventListener('click', () => focusOn(focusIndex + 1));
$('resetProps').addEventListener('click', () => focusOn(focusIndex));

/** Cross the focused portrait with another genome and show the child. */
function breedWith(other, tag) {
  if (!focused || !other) return;
  const child = breed(focused, other, `${focused.seed}+${tag}`);
  child.head.yaw = focused.head.yaw;
  focused = child;
  drawPortrait();
  syncPropFields();
  syncGenomeText();
}

$('breedNext').addEventListener('click', () => {
  const i = (focusIndex + 1) % seeds.length;
  breedWith(makeGenome(seeds[i], genomeOpts(opts)), seeds[i]);
});
$('breedRandom').addEventListener('click', () => {
  const tag = `x${Math.random().toString(36).slice(2, 7)}`;
  breedWith(makeGenome(tag, genomeOpts(opts)), tag);
});
$('resetGenome').addEventListener('click', () => {
  $('genomeError').hidden = true;
  focusOn(focusIndex);
});

$('applyGenome').addEventListener('click', () => {
  let parsed;
  try {
    parsed = JSON.parse($('genomeText').value);
  } catch (err) {
    return showGenomeError(`Invalid JSON: ${err.message}`);
  }
  if (!parsed || !parsed.head || !parsed.pen) {
    return showGenomeError('Not a genome: it needs at least `head` and `pen`.');
  }
  $('genomeError').hidden = true;
  focused = parsed;
  setMode('focus');
  drawPortrait();
  syncPropFields();
  return undefined;
});

// drag the portrait to turn the head
{
  const el = $('portrait');
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startYaw = 0;
  let startTilt = 0;

  el.addEventListener('pointerdown', (e) => {
    if (!focused) return;
    dragging = true;
    el.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    startYaw = focused.head.yaw || 0;
    startTilt = focused.head.tilt || 0;
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging || !focused) return;
    const w = el.clientWidth || 400;
    focused.head.yaw = clamp(startYaw + ((e.clientX - startX) / w) * 1.1, -0.5, 0.5);
    focused.head.tilt = clamp(startTilt + ((e.clientY - startY) / w) * 0.7, -0.26, 0.26);
    drawPortrait({ coarse: true });
    syncPropFields();
  });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    drawPortrait();
    syncGenomeText();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

$('yaw').addEventListener('input', () => {
  if (!focused) return;
  focused.head.yaw = (+$('yaw').value * Math.PI) / 180;
  $('yawOut').textContent = $('yaw').value;
  drawPortrait({ coarse: true });
  schedulePortraitSharpen();
});
$('tilt').addEventListener('input', () => {
  if (!focused) return;
  focused.head.tilt = (+$('tilt').value * Math.PI) / 180;
  $('tiltOut').textContent = $('tilt').value;
  drawPortrait({ coarse: true });
  schedulePortraitSharpen();
});
for (const id of ['yaw', 'tilt']) $(id).addEventListener('change', syncGenomeText);

for (const id of ['count', 'size']) {
  $(id).addEventListener('input', () => {
    opts = readOpts();
    syncReadouts();
    schedule(() => regenerate({ keepFocus: true }));
  });
}
$('expr').addEventListener('input', () => {
  if (!focused) return;
  focused.expression = +$('expr').value;
  $('exprOut').textContent = focused.expression.toFixed(2);
  drawPortrait({ coarse: true });
  schedulePortraitSharpen();
});
$('expr').addEventListener('change', syncGenomeText);

for (const id of ['color', 'turn', 'mood']) {
  $(id).addEventListener('input', () => {
    opts = readOpts();
    syncReadouts();
    onPinsChanged();
  });
}
for (const id of ['weight', 'shake']) {
  $(id).addEventListener('input', () => {
    opts = readOpts();
    syncReadouts();
    onStyleChanged();
  });
}
$('paper').addEventListener('change', onStyleChanged);
$('oneSheet').addEventListener('change', onStyleChanged);

$('seed').addEventListener('change', () => regenerate());
$('seed').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') regenerate();
});

const WORDS = ['ink', 'paper', 'margin', 'crowd', 'village', 'tavern', 'sketch', 'draft', 'nib', 'ledger'];
const randomSeed = () =>
  `${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.random().toString(36).slice(2, 7)}`;

for (const id of ['reroll', 'shuffle']) {
  $(id).addEventListener('click', () => {
    $('seed').value = randomSeed();
    focused = null;
    regenerate();
  });
}

$('clearFilters').addEventListener('click', () => {
  for (const [, sel] of traitSelects) {
    sel.value = '';
    sel.classList.remove('is-pinned');
  }
  regenerate();
});

// --- export ---------------------------------------------------------------

const sanitise = (s) => String(s).replace(/[^a-z0-9_-]+/gi, '_');

function download(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

$('dlFace').addEventListener('click', () => {
  if (!focused) focused = makeGenome(seeds[focusIndex], genomeOpts(opts));
  download(
    faceToDataURL(focused, {
      size: 1024,
      dpr: 1,
      lod: 1,
      weight: opts.weight,
      shake: opts.shake,
      paper: opts.paper,
    }),
    `face-${sanitise(focused.seed)}.png`,
  );
});

$('dlSheet').addEventListener('click', () => {
  const cols = Math.max(1, Math.round(Math.sqrt(opts.count * 1.4)));
  const sheet = renderSheet(
    seeds.map((s) => makeGenome(s, genomeOpts(opts))),
    {
      cell: 220,
      cols,
      dpr: 1,
      lod: 1,
      weight: opts.weight,
      shake: opts.shake,
      paper: opts.paper ? { seed: opts.seed } : false,
      sheetSeed: opts.seed,
    },
  );
  download(sheet.toDataURL('image/png'), `doodle-faces-${sanitise(opts.seed)}.png`);
});

$('dlAtlas').addEventListener('click', () => {
  const count = Math.max(opts.count, 64); // an atlas is only useful with a real pool
  const name = `faces-${sanitise(opts.seed)}`;
  const { canvas, manifest } = buildAtlas(atlasSeeds(opts.seed, count), {
    cell: 192,
    name,
    lod: 1,
    paper: false, // transparent, so the engine composites it over its own background
    weight: opts.weight,
    shake: opts.shake,
    ...genomeOpts(opts),
  });
  manifest.rootSeed = opts.seed;
  manifest.preset = opts.preset;
  download(canvas.toDataURL('image/png'), `${name}.png`);
  download(
    `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest, null, 2))}`,
    `${name}.json`,
  );
});

$('copySeed').addEventListener('click', () => copy(focused ? focused.seed : opts.seed));
$('copyGenome').addEventListener('click', () => copy(JSON.stringify(compact(focused), null, 2)));

// --- keyboard -------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (mode === 'focus' && e.key === 'ArrowLeft') focusOn(focusIndex - 1);
  else if (mode === 'focus' && e.key === 'ArrowRight') focusOn(focusIndex + 1);
  else if (e.key === 'r') {
    $('seed').value = randomSeed();
    focused = null;
    regenerate();
  } else if (e.key === 'f') setMode(mode === 'focus' ? 'sheet' : 'focus');
  else if (e.key === 'c') setMode(mode === 'compare' ? 'sheet' : 'compare');
  else if (e.key === 'k' && mode === 'focus') toggleFav();
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (mode === 'focus') drawPortrait();
    else if (mode === 'compare') drawCompare();
  }, 140);
});

// --- boot -----------------------------------------------------------------

/** Restore whatever a share link described, before the first render. */
function applyUrl() {
  const url = new URL(location.href);
  const p = url.searchParams;
  if (p.get('seed')) $('seed').value = p.get('seed');
  if (p.get('preset') && PRESETS[p.get('preset')]) $('preset').value = p.get('preset');
  for (const [key] of TRAITS) {
    const v = p.get(`p_${key}`);
    const sel = traitSelects.get(key);
    if (v && [...sel.options].some((o) => o.value === v)) {
      sel.value = v;
      sel.classList.add('is-pinned');
    }
  }
  for (const k of ['color', 'turn', 'mood', 'weight', 'shake']) {
    const v = p.get(k);
    if (v !== null && Number.isFinite(+v)) $(k).value = v;
  }

  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  let edited = null;
  if (hash.get('g')) {
    try {
      const g = decodeGenome(hash.get('g'));
      if (g && g.head && g.pen) edited = g;
    } catch {
      /* a mangled link should not stop the page loading */
    }
  }
  const i = p.get('i');
  return { index: i !== null && Number.isFinite(+i) ? +i : null, edited };
}

loadFavs();
const restored = applyUrl();
document.body.dataset.mode = 'sheet';
regenerate();
renderFavs();

if (restored.edited) {
  focused = restored.edited;
  if (restored.index !== null) focusIndex = restored.index;
  setMode('focus');
} else if (restored.index !== null) {
  focusOn(restored.index);
  setMode('focus');
}

// handy in the console
Object.assign(window, { drawFace, makeGenome, renderFace, renderSheet, PRESETS });

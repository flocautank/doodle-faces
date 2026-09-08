/**
 * Hair and facial hair.
 *
 * A hairstyle is a closed "shell" ring: an outer boundary inflated out from
 * the skull, an inner boundary that follows the skull back up, and a hairline
 * across the forehead. One construction covers everything from a buzz cut to
 * shoulder-length, just by moving where the ring starts and stops.
 *
 * The shell is then filled three ways depending on tone:
 *   dark  -> solid ink blob
 *   mid   -> dense hatching
 *   light -> sparse hatching
 * plus edge fuzz, which is what stops it looking like a stamped shape.
 */

import { closedCurve, ellipsePath, openCurve, pathBounds, pt, resample } from './ink.js?v=e1ff722724';

/**
 * Per-style shell parameters.
 *  puffX/puffY : how far the shell inflates past the skull
 *  hairT       : hairline height, 0 = crown, 1 = chin
 *  sideT       : how far down the sides the mass reaches
 *  hairline    : forehead edge shape
 *  render      : fill treatment
 */
const HAIR_PARAMS = {
  buzz: { puffX: 0.01, puffY: 0.04, hairT: 0.28, sideT: 0.3, hairline: 'straight', render: 'stipple' },
  shortHatch: { puffX: 0.03, puffY: 0.1, hairT: 0.26, sideT: 0.32, hairline: 'wavy', render: 'flow', len: 5 },
  flatTop: { puffX: 0.04, puffY: 0.16, hairT: 0.24, sideT: 0.3, hairline: 'straight', render: 'flow', len: 6, flat: true },
  messy: { puffX: 0.06, puffY: 0.13, hairT: 0.25, sideT: 0.33, hairline: 'wavy', render: 'flow', len: 6, spread: 0.5, tufts: 12 },
  mop: { puffX: 0.09, puffY: 0.14, hairT: 0.3, sideT: 0.4, hairline: 'arc', render: 'flow', len: 8, tufts: 7 },
  curly: { puffX: 0.11, puffY: 0.16, hairT: 0.28, sideT: 0.38, hairline: 'wavy', render: 'scribble' },
  spiky: { puffX: 0.04, puffY: 0.14, hairT: 0.25, sideT: 0.3, hairline: 'wavy', render: 'flow', len: 6, spikes: 11 },
  long: { puffX: 0.08, puffY: 0.11, hairT: 0.28, sideT: 0.84, hairline: 'peak', render: 'flow', len: 11, spread: 0.12 },
  bob: { puffX: 0.09, puffY: 0.12, hairT: 0.3, sideT: 0.6, hairline: 'arc', render: 'flow', len: 9, spread: 0.14 },
  fringe: { puffX: 0.03, puffY: 0.09, hairT: 0.34, sideT: 0.32, hairline: 'arc', render: 'flow', len: 6 },
  receding: { puffX: 0.02, puffY: 0.07, hairT: 0.16, sideT: 0.32, hairline: 'receding', render: 'flow', len: 5 },
  combover: { puffX: 0.05, puffY: 0.11, hairT: 0.22, sideT: 0.32, hairline: 'swoop', render: 'flow', len: 8, sideways: true },
  bun: { puffX: 0.04, puffY: 0.09, hairT: 0.26, sideT: 0.36, hairline: 'straight', render: 'flow', len: 6, bun: true },
  pigtails: { puffX: 0.05, puffY: 0.1, hairT: 0.3, sideT: 0.38, hairline: 'arc', render: 'flow', len: 7, pigtails: true },
  mohawk: { puffX: 0.0, puffY: 0.22, hairT: 0.24, sideT: 0.28, hairline: 'straight', render: 'flow', len: 7, mohawk: true },
  afro: { puffX: 0.28, puffY: 0.32, hairT: 0.3, sideT: 0.46, hairline: 'arc', render: 'scribble' },
  dreads: { puffX: 0.09, puffY: 0.12, hairT: 0.28, sideT: 0.5, hairline: 'straight', render: 'flow', len: 9, ropes: 13 },
  ponytail: { puffX: 0.04, puffY: 0.08, hairT: 0.26, sideT: 0.36, hairline: 'swoop', render: 'flow', len: 7, ponytail: true },
  topknot: { puffX: 0.03, puffY: 0.06, hairT: 0.24, sideT: 0.3, hairline: 'straight', render: 'flow', len: 5, bun: true, shaved: true },
  shavedSides: { puffX: 0.05, puffY: 0.12, hairT: 0.24, sideT: 0.29, hairline: 'straight', render: 'flow', len: 6, shaved: true },
  bowl: { puffX: 0.07, puffY: 0.09, hairT: 0.36, sideT: 0.5, hairline: 'arc', render: 'flow', len: 7, spread: 0.1, bowl: true },
  pompadour: { puffX: 0.04, puffY: 0.24, hairT: 0.22, sideT: 0.3, hairline: 'swoop', render: 'flow', len: 9, spread: 0.14, sideways: true, sweptBack: true },
  braids: { puffX: 0.04, puffY: 0.08, hairT: 0.28, sideT: 0.38, hairline: 'peak', render: 'flow', len: 6, braids: 2 },
  waves: { puffX: 0.06, puffY: 0.1, hairT: 0.28, sideT: 0.36, hairline: 'wavy', render: 'scribble', wavy: true },
  cornrows: { puffX: 0.02, puffY: 0.05, hairT: 0.26, sideT: 0.34, hairline: 'straight', render: 'rows', rows: 7 },
  sidePuffs: { puffX: 0.04, puffY: 0.07, hairT: 0.3, sideT: 0.36, hairline: 'arc', render: 'flow', len: 6, puffs: true },
};

/**
 * Resolve a style's table entry against this face's own variation, so that two
 * heads sharing a style still differ in volume, hairline, side length and the
 * character of the pen marks. A pure function of the genome, so the colour wash
 * and the ink see exactly the same shape.
 */
export function hairPlan(an, g) {
  const style = g.hair.style;
  if (style === 'none') return null;
  const base = HAIR_PARAMS[style];
  if (!base) return null;
  const h = g.hair;

  const puffX = Math.max(0, base.puffX * h.puff);
  const puffY = Math.max(0.01, base.puffY * h.puff * h.height);
  const hairT = clamp(base.hairT + h.hairTShift, 0.08, 0.46);
  const sideT = clamp(base.sideT + h.sideShift, hairT + 0.02, 0.92);

  // one temple fuller than the other, and its hairline a touch off
  const a = h.asym * h.asymSide;
  return Object.assign({}, base, {
    puffX,
    puffY,
    hairT,
    sideT,
    hairline: h.hairline || base.hairline,
    puffXR: puffX * (1 + a * 0.5),
    puffXL: puffX * (1 - a * 0.5),
    sideTR: clamp(sideT * (1 + a * 0.22), hairT + 0.02, 0.94),
    sideTL: clamp(sideT * (1 - a * 0.22), hairT + 0.02, 0.94),
    hairTR: clamp(hairT + a * 0.03, 0.06, 0.46),
    hairTL: clamp(hairT - a * 0.03, 0.06, 0.46),
    len: (base.len || 6) * h.strokeLen,
    spread: (base.spread || 0.22) * h.spread,
    curl: 0.8 * h.curl,
    swirl: h.swirl,
    turns: h.turns,
    part: h.part,
  });
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

/** The hair mass, in face-box coordinates, already tilted. */
export function hairRegion(an, g) {
  const p = hairPlan(an, g);
  if (!p) return null;
  if (p.mohawk) return an.tiltPath(mohawkShape(an, p));

  let shell = hairShell(an, p);
  if (p.flat) {
    const flatY = an.cy - an.h * (1 + p.puffY) * 0.94;
    shell = shell.map((q) => pt(q.x, Math.max(q.y, flatY)));
  }
  return an.tiltPath(shell);
}

export function drawHair(ink, an, g) {
  const p = hairPlan(an, g);
  if (!p) return;
  const rng = ink.rng;

  if (p.mohawk) {
    const spiked = addSpikes(mohawkShape(an, p), an, 16, g.hair.messiness * 1.4, rng);
    const tilted = an.tiltPath(spiked);
    paintHairMass(ink, tilted, g.hair, p, an);
    edgeFuzz(ink, tilted, an, 20, g.hair.messiness);
    return;
  }

  let shell = hairShell(an, p);
  if (p.flat) {
    const flatY = an.cy - an.h * (1 + p.puffY) * 0.94;
    shell = shell.map((q) => pt(q.x, Math.max(q.y, flatY)));
  }
  if (p.bowl) {
    // a bowl cut is defined by its hem: one flat line all the way round
    const hemY = an.yAt(p.sideT);
    shell = shell.map((q) => pt(q.x, Math.min(q.y, hemY)));
  }
  if (p.spikes) shell = addSpikes(shell, an, p.spikes, g.hair.messiness, rng);

  const tilted = an.tiltPath(shell);
  paintHairMass(ink, tilted, g.hair, p, an);
  edgeFuzz(ink, tilted, an, Math.round(11 * g.hair.density), g.hair.messiness);

  if (p.tufts) addTufts(ink, tilted, an, Math.round(p.tufts * g.hair.messiness), rng);
  if (p.shaved) drawShavedSides(ink, an, g, p);
  if (p.braids) drawBraids(ink, an, g, p);
  if (p.puffs) drawSidePuffs(ink, an, g, p);
  if (p.ropes) drawDreads(ink, an, g, p);
  if (p.ponytail) drawPonytail(ink, an, g, p);
  if (p.bun) {
    const by = an.cy - an.h * (1 + p.puffY) - 3.2 * g.hair.puff;
    const r = 5.4 * g.hair.density;
    const ball = ellipsePath(p.part * 1.5, by, r, r * 0.92, 0, Math.PI * 2, 22);
    const tb = an.tiltPath(ball);
    paintHairMass(ink, tb, g.hair, { render: 'scribble', turns: p.turns }, an);
    ink.outline(tb, { width: 0.8, passes: 2, wobble: 0.7, alpha: 0.6 });
  }
  if (p.pigtails) {
    for (const side of [-1, 1]) {
      const y = an.yAt(side === p.part ? 0.46 : 0.42);
      const x = side * (an.halfWidth(y, side > 0 ? p.puffXR : p.puffXL, p.puffY) + 4.4);
      const r = 4.6 * g.hair.density * (side === p.part ? 1.12 : 0.94);
      const ball = ellipsePath(x, y, r, r * 1.15, 0, Math.PI * 2, 20);
      const tb = an.tiltPath(ball);
      paintHairMass(ink, tb, g.hair, { render: 'scribble', turns: p.turns }, an);
      ink.outline(tb, { width: 0.8, passes: 2, wobble: 0.7, alpha: 0.55 });
    }
  }
}

// ---------------------------------------------------------------------------

/**
 * The shell is one closed ring: down the outer edge, back up the skull, across
 * the forehead, then down and out again on the other side. Each side carries
 * its own puff and length, which is where the asymmetry comes from.
 */
function hairShell(an, o) {
  const H = an.h * (1 + o.puffY);
  const yTop = an.cy - H;
  const hairTR = o.hairTR !== undefined ? o.hairTR : o.hairT;
  const hairTL = o.hairTL !== undefined ? o.hairTL : o.hairT;
  const yHairR = an.yAt(hairTR);
  const yHairL = an.yAt(hairTL);
  const ySideR = an.yAt(Math.max(o.sideTR !== undefined ? o.sideTR : o.sideT, hairTR + 0.02));
  const ySideL = an.yAt(Math.max(o.sideTL !== undefined ? o.sideTL : o.sideT, hairTL + 0.02));
  const puffXR = o.puffXR !== undefined ? o.puffXR : o.puffX;
  const puffXL = o.puffXL !== undefined ? o.puffXL : o.puffX;

  const steps = 26;
  const outerR = [];
  const outerL = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const yr = yTop + (ySideR - yTop) * t;
    const yl = yTop + (ySideL - yTop) * t;
    // the shell follows the same profile bulge as the skull, so hair and head
    // agree at the back of a turned head
    outerR.push(pt(an.profileX(an.halfWidth(yr, puffXR, o.puffY), yr), yr));
    outerL.push(pt(an.profileX(-an.halfWidth(yl, puffXL, o.puffY), yl), yl));
  }

  const isteps = 14;
  const innerR = [];
  const innerL = [];
  for (let i = 0; i <= isteps; i++) {
    const t = i / isteps;
    const yr = ySideR + (yHairR - ySideR) * t;
    const yl = ySideL + (yHairL - ySideL) * t;
    innerR.push(pt(an.halfWidth(yr) * 0.98, yr));
    innerL.push(pt(-an.halfWidth(yl) * 0.98, yl));
  }

  const line = hairlinePath(
    o.hairline,
    an.halfWidth(yHairR) * 0.98,
    an.halfWidth(yHairL) * 0.98,
    yHairR,
    yHairL,
    an,
    o,
  );

  return [...outerR, ...innerR, ...line, ...innerL.reverse(), ...outerL.reverse()];
}

/**
 * Forehead edge, running right -> left. The two ends can sit at different
 * heights and widths, so an asymmetric shell closes cleanly.
 */
function hairlinePath(kind, hwR, hwL, yR, yL, an, o) {
  const part = o.part !== undefined ? o.part : 1;
  const mid = (yR + yL) / 2;
  const a = pt(hwR, yR);
  const z = pt(-hwL, yL);
  switch (kind) {
    case 'arc':
      return openCurve([a, pt(hwR * 0.5, mid + an.h * 0.06), pt(0, mid + an.h * 0.08), pt(-hwL * 0.5, mid + an.h * 0.055), z], 7);
    case 'peak':
      return openCurve([a, pt(hwR * 0.55, mid - an.h * 0.02), pt(0, mid + an.h * 0.07), pt(-hwL * 0.55, mid - an.h * 0.02), z], 7);
    case 'receding':
      return openCurve([
        pt(hwR, yR + an.h * 0.16),
        pt(hwR * 0.66, mid + an.h * 0.05),
        pt(hwR * 0.3, mid - an.h * 0.03),
        pt(0, mid + an.h * 0.03),
        pt(-hwL * 0.3, mid - an.h * 0.03),
        pt(-hwL * 0.66, mid + an.h * 0.05),
        pt(-hwL, yL + an.h * 0.16),
      ], 6);
    case 'swoop':
      return openCurve([
        pt(hwR, yR + an.h * (part > 0 ? 0.02 : 0.12)),
        pt(hwR * 0.3 * part, mid + an.h * 0.09),
        pt(-hwL * 0.6 * part, mid - an.h * 0.01),
        pt(-hwL, yL + an.h * (part > 0 ? 0.12 : 0.02)),
      ], 8);
    case 'wavy': {
      const out = [];
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = hwR - (hwR + hwL) * t;
        const y = yR + (yL - yR) * t;
        out.push(pt(x, y + Math.sin(t * Math.PI * 3.2) * an.h * 0.022 + an.h * 0.012));
      }
      return out;
    }
    default:
      return openCurve([a, pt(0, mid + an.h * 0.025), z], 8);
  }
}

// ---------------------------------------------------------------------------

function paintHairMass(ink, path, hair, p, an) {
  const tone = hair.tone;
  const density = hair.density !== undefined ? hair.density : 1;
  const b = pathBounds(path);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const part = hair.part !== undefined ? hair.part : 1;
  const swirl = p.swirl !== undefined ? p.swirl : 0;

  // Sitting the origin well below the skull keeps the strokes nearly parallel
  // over the crown and only fanning gently at the temples. Put it close to the
  // head instead and the hair sprays out like a fountain. `swirl` slides it
  // sideways, which tips the whole comb direction.
  const origin = p.sideways
    ? pt(cx + (an ? an.w * 2.4 * part : 0), an ? an.cy : cy)
    : pt(
        (an ? an.cx : cx) + (an ? an.w * swirl : 0),
        an ? an.cy + an.h * 2.4 : cy,
      );
  const area = b.w * b.h;
  const len = p.len !== undefined ? p.len : 6;
  const spread = p.spread !== undefined ? p.spread : 0.22;
  const curl = p.curl !== undefined ? p.curl : 0.8;
  const turns = p.turns !== undefined ? p.turns : 0.75;

  if (p.render === 'scribble') {
    if (tone === 'dark') {
      ink.fill(path, { alpha: 0.9, wobble: 0.9, edge: false });
      ink.scribble(path, { radius: 2.4, width: 0.7, alpha: 0.32, turns });
    } else {
      ink.scribble(path, {
        radius: 2.2 / density,
        width: 0.85,
        alpha: tone === 'mid' ? 0.75 : 0.55,
        loops: Math.round((area / 22) * density),
        turns,
      });
    }
  } else if (p.render === 'rows') {
    // tight lines running front to back, each one ticked like a braid
    const rows = p.rows || 7;
    const b2 = pathBounds(path);
    ink.clipped(path, () => {
      for (let i = 0; i < rows; i++) {
        const t = (i + 0.5) / rows;
        const px = b2.minX + b2.w * t;
        ink.stroke([pt(px, b2.minY - 2), pt(px + (t - 0.5) * 4, b2.maxY + 2)], {
          width: 1.3,
          passes: 2,
          wobble: 0.5,
          alpha: 0.85,
        });
        for (let k = 1; k < 6; k++) {
          const py = b2.minY + (b2.h * k) / 6;
          ink.stroke([pt(px - 1.1, py), pt(px + 1.1, py)], {
            width: 0.5,
            passes: 1,
            wobble: 0.25,
            alpha: 0.5,
          });
        }
      }
    });
  } else if (p.render === 'stipple') {
    const count = Math.round((area / 7) * density);
    ink.clipped(path, () => {
      for (let i = 0; i < count; i++) {
        const x = b.minX + ink.rng.next() * b.w;
        const y = b.minY + ink.rng.next() * b.h;
        ink.dot(x, y, ink.rng.range(0.22, 0.44), { alpha: tone === 'dark' ? 0.8 : 0.55 });
      }
    });
  } else if (tone === 'dark') {
    ink.fill(path, { alpha: 0.9, wobble: 0.85, edge: false });
    // a few lighter strokes on top keep the blob from looking printed
    ink.flow(path, { origin, count: Math.round(area / 26), length: len, spread, curl, width: 0.55, alpha: 0.3 });
  } else {
    const per = tone === 'mid' ? 4.6 : 9.5;
    ink.flow(path, {
      origin,
      count: Math.round((area / per) * density),
      length: len,
      spread,
      curl,
      width: tone === 'mid' ? 0.72 : 0.6,
      alpha: tone === 'mid' ? 0.8 : 0.58,
    });
  }

  // silhouette line, drawn light so the strokes stay dominant
  ink.outline(path, { width: 0.7, passes: 1, wobble: 0.9, alpha: 0.5 });
}

/**
 * Short strokes that cross the outer edge — the single biggest reason hand-drawn
 * hair reads as hair rather than as a filled region.
 */
function edgeFuzz(ink, path, an, count, messiness) {
  const dense = resample(path, 2.6);
  const rng = ink.rng;
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng.next() * dense.length);
    const a = dense[Math.max(0, idx - 1)];
    const c = dense[Math.min(dense.length - 1, idx + 1)];
    const p = dense[idx];
    // only fuzz the upper silhouette; the inner hairline should stay crisp
    if (p.y > an.cy + an.h * 0.15) continue;
    let tx = c.x - a.x;
    let ty = c.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = -ty;
    const ny = tx;
    const out = rng.range(0.6, 2) * messiness;
    const inn = rng.range(1, 3);
    ink.stroke([pt(p.x - nx * inn, p.y - ny * inn), pt(p.x + nx * out, p.y + ny * out)], {
      width: rng.range(0.4, 0.75),
      passes: 1,
      wobble: 0.5,
      alpha: rng.range(0.35, 0.7),
      phase: rng.next() * 60,
    });
  }
}

/** Bigger flicks of hair sticking out — messy and mop tops. */
function addTufts(ink, path, an, count, rng) {
  const dense = resample(path, 3.2);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng.next() * dense.length);
    const p = dense[idx];
    if (p.y > an.cy - an.h * 0.1) continue;
    const dir = Math.atan2(p.y - an.cy, p.x - an.cx) + rng.gauss(0, 0.4);
    const len = rng.range(3, 8);
    const tip = pt(p.x + Math.cos(dir) * len, p.y + Math.sin(dir) * len);
    const mid = pt(
      (p.x + tip.x) / 2 - Math.sin(dir) * rng.gauss(0, 2),
      (p.y + tip.y) / 2 + Math.cos(dir) * rng.gauss(0, 2),
    );
    ink.stroke(openCurve([p, mid, tip], 6), {
      width: rng.range(0.5, 0.9),
      passes: 1,
      wobble: 0.5,
      alpha: 0.65,
      phase: rng.next() * 40,
    });
  }
}

/** Push the top of the shell out into triangular spikes. */
function addSpikes(path, an, count, messiness, rng) {
  const out = [];
  const topLimit = an.cy - an.h * 0.35;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    out.push(p);
    if (p.y > topLimit) continue;
    if (rng.next() > count / 40) continue;
    const dir = Math.atan2(p.y - an.cy, p.x - an.cx);
    const len = rng.range(3, 9) * messiness;
    out.push(pt(p.x + Math.cos(dir) * len, p.y + Math.sin(dir) * len));
  }
  return out;
}

/** Clipper-short temples under a taller top — the fade the barber gave up on. */
function drawShavedSides(ink, an, g, p) {
  const rng = ink.rng;
  for (const side of [-1, 1]) {
    const yA = an.yAt(p.hairT + 0.02);
    const yB = an.yAt(0.56);
    const band = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const y = yA + ((yB - yA) * i) / steps;
      band.push(pt(side * an.halfWidth(y) * 0.99, y));
    }
    for (let i = steps; i >= 0; i--) {
      const y = yA + ((yB - yA) * i) / steps;
      band.push(pt(side * an.halfWidth(y) * 0.5, y));
    }
    const path = an.tiltPath(band);
    const b = pathBounds(path);
    const count = Math.round(((b.w * b.h) / 8) * g.hair.density);
    ink.clipped(path, () => {
      for (let i = 0; i < count; i++) {
        ink.dot(b.minX + rng.next() * b.w, b.minY + rng.next() * b.h, rng.range(0.2, 0.4), {
          alpha: g.hair.tone === 'dark' ? 0.7 : 0.45,
        });
      }
    });
  }
}

/** Two plaits hanging from the temples, ticked across like rope. */
function drawBraids(ink, an, g, p) {
  const rng = ink.rng;
  for (const side of [-1, 1]) {
    const yTop = an.yAt(0.36);
    const x0 = side * an.halfWidth(yTop, p.puffX, p.puffY) * 0.96;
    const drop = 22 * g.hair.length;
    const sway = side * rng.range(2, 5);
    const spine = an.tiltPath(openCurve([
      pt(x0, yTop),
      pt(x0 + sway * 0.6, yTop + drop * 0.5),
      pt(x0 + sway, yTop + drop),
    ], 12));
    ink.stroke(spine, { width: 1.4, passes: 2, wobble: 0.6, alpha: 0.8 });
    // the chevrons that make a rope read as a plait
    const n = 7;
    for (let i = 1; i <= n; i++) {
      const q = spine[Math.floor(((spine.length - 1) * i) / (n + 1))];
      const w = 2.4 * (1 - i / (n + 2));
      ink.stroke([pt(q.x - w, q.y - w * 0.5), pt(q.x + w, q.y + w * 0.5)], {
        width: 0.7,
        passes: 1,
        wobble: 0.3,
        alpha: 0.7,
      });
      ink.stroke([pt(q.x - w, q.y + w * 0.5), pt(q.x + w, q.y - w * 0.5)], {
        width: 0.55,
        passes: 1,
        wobble: 0.3,
        alpha: 0.5,
      });
    }
    // the tie at the end
    const end = spine[spine.length - 1];
    ink.stroke([pt(end.x - 1.8, end.y - 0.6), pt(end.x + 1.8, end.y + 0.6)], {
      width: 1.6,
      passes: 2,
      wobble: 0.3,
    });
  }
}

/** Two round bunches sitting either side of the head. */
function drawSidePuffs(ink, an, g, p) {
  for (const side of [-1, 1]) {
    const y = an.yAt(0.38);
    const r = 6 * g.hair.density;
    const x = side * (an.halfWidth(y, p.puffX, p.puffY) + r * 0.55);
    const ball = ellipsePath(x, y, r, r * 1.05, 0, Math.PI * 2, 22);
    const tb = an.tiltPath(ball);
    paintHairMass(ink, tb, g.hair, { render: 'scribble', turns: p.turns }, an);
    ink.outline(tb, { width: 0.8, passes: 2, wobble: 0.8, alpha: 0.6 });
  }
}

/**
 * Ropes of hair falling past the shell.
 *
 * They hang off the *sides* of the skull, not off the crown: a rope starting
 * above the forehead would fall straight down over the face, which is what
 * this used to do and it looked like a curtain.
 */
function drawDreads(ink, an, g, p) {
  const rng = ink.rng;
  const count = Math.round(p.ropes * g.hair.density);
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    // spread the anchors down the temple, from the hairline to just past the ear
    const t = p.hairT + 0.05 + (i / count) * 0.42 + rng.range(-0.03, 0.03);
    const startY = an.yAt(Math.min(0.72, t));
    const x0 = side * an.halfWidth(startY, p.puffX, p.puffY) * rng.range(0.9, 1.02);
    const drop = rng.range(12, 26) * g.hair.length;
    const sway = rng.gauss(0, 2) + side * rng.range(1, 5);
    const rope = openCurve(
      [
        pt(x0, startY),
        pt(x0 + sway * 0.5, startY + drop * 0.45),
        pt(x0 + sway, startY + drop),
      ],
      9,
    );
    const path = an.tiltPath(rope);
    ink.stroke(path, {
      width: rng.range(1.5, 2.6),
      passes: 2,
      wobble: 0.8,
      alpha: g.hair.tone === 'dark' ? 0.9 : 0.7,
      phase: rng.next() * 40,
    });
    // the little cross-ticks that read as twisted rope
    for (let k = 1; k < 5; k++) {
      const q = path[Math.floor((path.length - 1) * (k / 5))];
      ink.stroke([pt(q.x - 1.4, q.y - 0.5), pt(q.x + 1.4, q.y + 0.5)], {
        width: 0.5,
        passes: 1,
        wobble: 0.3,
        alpha: 0.45,
      });
    }
  }
}

/** A tail gathered at the back and hanging down one side. */
function drawPonytail(ink, an, g, p) {
  const side = g.hair.part;
  const yTie = an.yAt(0.34);
  const xTie = side * an.halfWidth(yTie, p.puffX, p.puffY) * 0.94;
  const len = 20 * g.hair.length;
  const tail = closedCurve(
    [
      pt(xTie, yTie - 2),
      pt(xTie + side * 5, yTie + len * 0.35),
      pt(xTie + side * 3.5, yTie + len),
      pt(xTie - side * 2, yTie + len * 0.9),
      pt(xTie - side * 3.5, yTie + len * 0.3),
    ],
    9,
  );
  const path = an.tiltPath(tail);
  paintHairMass(ink, path, g.hair, { render: 'flow', len: 9, spread: 0.12, curl: 0.4 }, an);
  // the tie
  ink.stroke(
    an.tiltPath([pt(xTie - side * 2.4, yTie - 1), pt(xTie + side * 2.6, yTie + 1.4)]),
    { width: 1.6, passes: 2, wobble: 0.4, alpha: 0.85 },
  );
}

function mohawkShape(an, p) {
  const H = an.h * (1 + p.puffY);
  const yTop = an.cy - H;
  const bandW = an.w * (0.14 + 0.12 * Math.min(1.4, p.puffX * 6 + 0.5));
  const yBase = an.yAt(0.3);
  return closedCurve(
    [
      pt(-bandW, yBase),
      pt(-bandW * 0.8, yTop + 2),
      pt(0, yTop - 2),
      pt(bandW * 0.8, yTop + 2),
      pt(bandW, yBase),
      pt(0, an.yAt(0.2)),
    ],
    9,
  );
}

// ---------------------------------------------------------------------------
// Facial hair
// ---------------------------------------------------------------------------

/**
 * Beard geometry, split out so the colour wash can use the same shapes.
 * Returns a list of closed paths, already tilted, or an empty list.
 */
export function beardRegions(an, g) {
  const b = g.beard;
  if (b.style === 'none') return [];
  const gap = b.gap !== undefined ? b.gap : 1;
  const ext = b.extent !== undefined ? b.extent : 0;
  const out = [];

  switch (b.style) {
    case 'stubble':
      out.push(lowerFace(an, clamp(0.58 + ext, 0.44, 0.7), an.mouthY + 4 * gap));
      break;
    case 'mustache': {
      const y = (an.noseY + an.mouthY) / 2 + 0.4;
      const hw = 4.4 * g.mouth.w * 1.15 * gap;
      out.push(closedCurve(
        [pt(-hw, y + 0.6), pt(-hw * 0.4, y - 1.9), pt(0, y - 1.2), pt(hw * 0.4, y - 1.9), pt(hw, y + 0.6), pt(0, y + 2.1)],
        8,
      ));
      break;
    }
    case 'soulPatch':
      out.push(ellipsePath(0, an.mouthY + 3.2, 1.7 * gap, 2.1 * gap, 0, Math.PI * 2, 14));
      break;
    case 'goatee': {
      const y = an.mouthY + 2.6;
      const w = 3.4 * gap;
      out.push(closedCurve([pt(-w, y - 1), pt(0, y - 2), pt(w, y - 1), pt(w * 0.7, y + 5.5), pt(-w * 0.7, y + 5.5)], 8));
      break;
    }
    case 'sideburns':
      for (const side of [-1, 1]) {
        const yA = an.yAt(clamp(0.4 + ext, 0.3, 0.5));
        const yB = an.yAt(clamp(0.66 + ext, 0.55, 0.8));
        const pts = [];
        const steps = 8;
        for (let i = 0; i <= steps; i++) {
          const y = yA + ((yB - yA) * i) / steps;
          pts.push(pt(side * an.halfWidth(y), y));
        }
        for (let i = steps; i >= 0; i--) {
          const y = yA + ((yB - yA) * i) / steps;
          pts.push(pt(side * an.halfWidth(y) * (0.82 - 0.08 * gap), y));
        }
        out.push(pts);
      }
      break;
    case 'chinStrap': {
      const from = clamp(0.5 + ext, 0.4, 0.62);
      const outer = jawBand(an, from, 1.0);
      const inner = jawBand(an, from, 0.86 - 0.06 * gap).reverse();
      out.push([...outer, ...inner]);
      break;
    }
    case 'handlebar': {
      // a moustache with the ends curled up past the corners of the mouth
      const y = (an.noseY + an.mouthY) / 2 + 0.5;
      const hw = 5.4 * g.mouth.w * gap;
      out.push(closedCurve([
        pt(-hw, y - 2.2),
        pt(-hw * 0.75, y + 1.2),
        pt(0, y - 0.6),
        pt(hw * 0.75, y + 1.2),
        pt(hw, y - 2.2),
        pt(hw * 0.6, y + 0.4),
        pt(0, y + 2.2),
        pt(-hw * 0.6, y + 0.4),
      ], 8));
      break;
    }
    case 'fuManchu': {
      // a thin moustache with two strands dropping past the jaw
      const y = (an.noseY + an.mouthY) / 2 + 0.6;
      const hw = 4.2 * g.mouth.w;
      out.push(closedCurve([pt(-hw, y - 0.4), pt(0, y - 1.6), pt(hw, y - 0.4), pt(0, y + 1.2)], 8));
      for (const side of [-1, 1]) {
        const dx = side * hw * 0.9;
        out.push(closedCurve([
          pt(dx - 0.9, y),
          pt(dx + 0.9, y),
          pt(dx + side * 1.2, an.bottom + an.h * 0.3 * (g.beard.length || 1)),
          pt(dx + side * 1.2 - 1.6, an.bottom + an.h * 0.3 * (g.beard.length || 1)),
        ], 8));
      }
      break;
    }
    case 'neckbeard': {
      // nothing on the face, everything under the jaw
      const yA = an.yAt(0.82);
      const right = [];
      const left = [];
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const y = yA + ((an.bottom - yA) * i) / steps;
        right.push(pt(an.halfWidth(y) * 0.98, y));
        left.push(pt(-an.halfWidth(y) * 0.98, y));
      }
      const hwA = an.halfWidth(yA) * 0.98;
      out.push([
        ...right,
        pt(hwA * 0.7, an.bottom + an.h * 0.26),
        pt(-hwA * 0.7, an.bottom + an.h * 0.26),
        ...left.reverse(),
      ]);
      break;
    }
    case 'vandyke': {
      // moustache plus a floating chin tuft, nothing joining them
      const my = (an.noseY + an.mouthY) / 2 + 0.5;
      const hwM = 4.4 * g.mouth.w;
      out.push(closedCurve([pt(-hwM, my + 0.4), pt(0, my - 1.9), pt(hwM, my + 0.4), pt(0, my + 1.8)], 8));
      const cy2 = an.mouthY + 4;
      out.push(closedCurve([pt(-2.6, cy2 - 1.4), pt(2.6, cy2 - 1.4), pt(1.5, cy2 + 5), pt(-1.5, cy2 + 5)], 8));
      break;
    }
    case 'muttonChops':
      // Fat side whiskers hugging the jaw, chin left bare. The inner edge stays
      // close to the outer one and only flares near the bottom, so it reads as
      // a whisker rather than a panel bolted across the cheek.
      for (const side of [-1, 1]) {
        const yA = an.yAt(clamp(0.4 + ext, 0.3, 0.5));
        const yB = an.yAt(clamp(0.84 + ext, 0.74, 0.92));
        const pts = [];
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
          const y = yA + ((yB - yA) * i) / steps;
          pts.push(pt(side * an.halfWidth(y) * 1.0, y));
        }
        for (let i = steps; i >= 0; i--) {
          const t = i / steps;
          const y = yA + (yB - yA) * t;
          const inset = 0.78 - 0.22 * t * t * gap;
          pts.push(pt(side * an.halfWidth(y) * inset, y));
        }
        out.push(pts);
      }
      break;
    case 'longBeard':
    case 'braided': {
      const drop = an.h * (0.5 + 0.5 * (g.beard.length || 1));
      out.push(lowerFace(an, clamp(0.5 + ext, 0.38, 0.62), an.mouthY + 3 * gap));
      // the hanging part, below the chin
      const hwC = an.halfWidth(an.yAt(0.88));
      out.push(closedCurve(
        [
          pt(-hwC, an.yAt(0.82)),
          pt(hwC, an.yAt(0.82)),
          pt(hwC * 0.72, an.bottom + drop * 0.55),
          pt(0, an.bottom + drop),
          pt(-hwC * 0.72, an.bottom + drop * 0.55),
        ],
        9,
      ));
      const my = (an.noseY + an.mouthY) / 2 + 0.6;
      const hwM = 4.6 * g.mouth.w * 1.15;
      out.push(closedCurve(
        [pt(-hwM, my + 0.6), pt(-hwM * 0.4, my - 2), pt(0, my - 1.1), pt(hwM * 0.4, my - 2), pt(hwM, my + 0.6), pt(0, my + 2.2)],
        8,
      ));
      break;
    }
    default: {
      // full
      out.push(lowerFace(an, clamp(0.52 + ext, 0.4, 0.64), an.mouthY + 3 * gap));
      const my = (an.noseY + an.mouthY) / 2 + 0.6;
      const hw = 4.6 * g.mouth.w * 1.1;
      out.push(closedCurve(
        [pt(-hw, my + 0.6), pt(-hw * 0.4, my - 1.8), pt(0, my - 1.1), pt(hw * 0.4, my - 1.8), pt(hw, my + 0.6), pt(0, my + 2)],
        8,
      ));
    }
  }

  return out.map((path) => an.tiltPath(path));
}

export function drawBeard(ink, an, g) {
  const b = g.beard;
  if (b.style === 'none') return;
  const regions = beardRegions(an, g);
  if (regions.length === 0) return;
  const rng = ink.rng;
  const len = 3.6 * (b.strokeLen !== undefined ? b.strokeLen : 1);

  // Beard strokes grow away from a point up behind the nose, so they fan
  // downwards over the chin and sideways along the jaw.
  const origin = an.tiltPoint(pt(an.cx, an.noseY - an.h * 0.25));

  // Stubble is dots, not strokes.
  if (b.style === 'stubble') {
    const path = regions[0];
    const bb = pathBounds(path);
    const count = Math.round((bb.w * bb.h) / (9 / b.density));
    ink.clipped(path, () => {
      for (let i = 0; i < count; i++) {
        ink.dot(bb.minX + rng.next() * bb.w, bb.minY + rng.next() * bb.h, rng.range(0.2, 0.38), { alpha: 0.5 });
      }
    });
    return;
  }

  // A big beard filled solid would swallow the mouth, and outlining the mass
  // reads as a notch in the jaw — so the strokes carry both jobs.
  const solid = !['full', 'chinStrap', 'neckbeard'].includes(b.style);
  const outline = !['full', 'sideburns', 'neckbeard'].includes(b.style);

  for (const path of regions) {
    const bb = pathBounds(path);
    const area = bb.w * bb.h;
    if (b.tone === 'dark' && solid) {
      ink.fill(path, { alpha: 0.86, wobble: 0.8, edge: false });
      ink.flow(path, { origin, count: Math.round(area / 26), length: len, width: 0.5, alpha: 0.28 });
    } else if (b.tone === 'dark') {
      ink.flow(path, {
        origin,
        count: Math.round(area / 5),
        length: len,
        spread: 0.3,
        curl: 0.5,
        width: 0.7,
        alpha: 0.8,
      });
    } else {
      const per = b.tone === 'mid' ? 7.5 : 14;
      ink.flow(path, {
        origin,
        count: Math.round((area / per) * b.density),
        length: len,
        spread: 0.28,
        curl: 0.6,
        width: b.tone === 'mid' ? 0.68 : 0.58,
        alpha: b.tone === 'mid' ? 0.78 : 0.56,
      });
    }
    if (outline) ink.outline(path, { width: 0.6, passes: 1, wobble: 0.9, alpha: 0.4 });
  }
}

/**
 * Region from `fromT` down around the chin, following the skull.
 * `gapY`, when given, pulls the inner boundary down past the mouth so the
 * beard leaves the lips bare — which is what a real beard does.
 */
function lowerFace(an, fromT, gapY) {
  const yA = an.yAt(fromT);
  const right = [];
  const left = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const y = yA + ((an.bottom - yA) * i) / steps;
    const hw = an.halfWidth(y) * 0.99;
    right.push(pt(hw, y));
    left.push(pt(-hw, y));
  }
  const hwA = an.halfWidth(yA) * 0.99;
  const dip = gapY ?? yA + an.h * 0.12;
  const inner = openCurve(
    [pt(-hwA, yA), pt(-hwA * 0.55, (yA + dip) / 2), pt(0, dip), pt(hwA * 0.55, (yA + dip) / 2), pt(hwA, yA)],
    7,
  );
  return [...right, ...left.reverse(), ...inner];
}

function jawBand(an, fromT, scale) {
  const yA = an.yAt(fromT);
  const right = [];
  const left = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const y = yA + ((an.bottom - yA) * i) / steps;
    const hw = an.halfWidth(y) * scale;
    right.push(pt(hw, y));
    left.push(pt(-hw, y));
  }
  return [...right, ...left.reverse()];
}

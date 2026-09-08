/**
 * Hand-drawn ink primitives on a Canvas2D context.
 *
 * Everything here fakes a wobbly ballpoint pen on textured paper:
 *  - paths are resampled then displaced by smooth noise (slow drift, not fuzz)
 *  - each line is drawn in several passes, so corners double up like real ink
 *  - width varies along the stroke and tapers at both ends
 *  - the pen occasionally skips, leaving a tiny gap
 *
 * Written in a deliberately plain style (explicit params, no closures over
 * state) so it can be ported to GDScript almost line for line.
 */

import { makeFbm1D, makeRng } from './rng.js?v=e1ff722724';

// ---------------------------------------------------------------------------
// Path construction helpers. A "path" is a flat array of {x, y}.
// ---------------------------------------------------------------------------

export function pt(x, y) {
  return { x, y };
}

/** Points along an ellipse. `from`/`to` in radians, 0 = right, CW on screen. */
export function ellipsePath(cx, cy, rx, ry, from = 0, to = Math.PI * 2, steps = 48) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push(pt(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
  }
  return out;
}

/** Cubic bezier sampled into points. */
export function bezierPath(p0, p1, p2, p3, steps = 24) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
    const y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
    out.push(pt(x, y));
  }
  return out;
}

/**
 * Smooth closed curve through control points (Catmull-Rom).
 * This is how head silhouettes and hair masses are described: a handful of
 * anchor points, then let the curve do the work.
 */
export function closedCurve(anchors, stepsPerSpan = 10) {
  const n = anchors.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = anchors[(i - 1 + n) % n];
    const p1 = anchors[i];
    const p2 = anchors[(i + 1) % n];
    const p3 = anchors[(i + 2) % n];
    for (let s = 0; s < stepsPerSpan; s++) {
      const t = s / stepsPerSpan;
      out.push(catmull(p0, p1, p2, p3, t));
    }
  }
  out.push(out[0]);
  return out;
}

/** Smooth open curve through control points. */
export function openCurve(anchors, stepsPerSpan = 10) {
  const n = anchors.length;
  if (n < 2) return anchors.slice();
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = anchors[Math.max(0, i - 1)];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[Math.min(n - 1, i + 2)];
    for (let s = 0; s < stepsPerSpan; s++) {
      out.push(catmull(p0, p1, p2, p3, s / stepsPerSpan));
    }
  }
  out.push(anchors[n - 1]);
  return out;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return pt(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  );
}

/** Resample a polyline so segments are roughly `spacing` px long. */
export function resample(path, spacing) {
  if (path.length < 2) return path.slice();
  const out = [path[0]];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let d = spacing - carry;
    while (d <= len) {
      out.push(pt(a.x + (dx * d) / len, a.y + (dy * d) / len));
      d += spacing;
    }
    carry = (len - (d - spacing)) % spacing;
  }
  out.push(path[path.length - 1]);
  return out;
}

export function pathBounds(path) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of path) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Even-odd point-in-polygon, used to trim hatching to a shape. */
export function pointInPath(path, x, y) {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const xi = path[i].x;
    const yi = path[i].y;
    const xj = path[j].x;
    const yj = path[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Scale a closed path in/out around its own centre — handy for inner outlines. */
export function insetPath(path, amount) {
  const b = pathBounds(path);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const sx = b.w > 0 ? Math.max(0, (b.w - amount * 2) / b.w) : 1;
  const sy = b.h > 0 ? Math.max(0, (b.h - amount * 2) / b.h) : 1;
  return path.map((p) => pt(cx + (p.x - cx) * sx, cy + (p.y - cy) * sy));
}

// ---------------------------------------------------------------------------
// The pen
// ---------------------------------------------------------------------------

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 * @param {number|string} opts.seed     stroke wobble seed
 * @param {number} opts.pxPerUnit       device px per drawing unit; only used to
 *                                      stop hairlines vanishing at small sizes,
 *                                      since the caller already applies the
 *                                      scale via ctx.scale()
 * @param {string} opts.color           ink colour, e.g. 'rgb(28,26,30)'
 * @param {number} opts.weight          base line width multiplier
 * @param {number} opts.shake           wobble multiplier (0.5 steady .. 2 jittery)
 * @param {number} opts.alpha           pen darkness; scales every stroke alpha
 * @param {number} opts.skip            how dry the pen runs, added to each stroke
 * @param {number} opts.fill            ceiling on solid-fill opacity
 * @param {number} opts.lod             0..1 level of detail; 1 is full
 */
export function makeInk(ctx, opts = {}) {
  const pxPerUnit = opts.pxPerUnit ?? 1;
  /**
   * Level of detail, 0..1.
   *
   * A face is described in drawing units, so a 64px thumbnail used to cost
   * exactly as much as a 512px portrait: same resampling, same stroke counts,
   * same everything, then scaled down until none of it was visible. `lod`
   * thins the work out where it cannot be seen — longer segments, fewer flow
   * strokes, wider hatching. It is also what makes dragging a portrait around
   * feel live: drop to a coarse lod while the pointer is down, redraw at full
   * detail when it comes up.
   */
  const lod = Math.max(0.2, Math.min(1, opts.lod ?? 1));
  const rng = makeRng(opts.seed ?? 1);
  const drift = makeFbm1D(rng.fork('drift'), 3);
  const grit = makeFbm1D(rng.fork('grit'), 2);
  const press = makeFbm1D(rng.fork('press'), 2);

  const base = {
    color: opts.color ?? 'rgb(30,28,32)',
    weight: opts.weight ?? 1,
    shake: opts.shake ?? 1,
    // Pen character. Callers pass explicit per-stroke alphas all over the
    // place, so rather than override them these scale them: a pencil lightens
    // everything by the same ratio, a marker darkens it.
    alphaMul: (opts.alpha ?? 0.84) / 0.84,
    skipExtra: (opts.skip ?? 0.08) - 0.08,
    fillCap: opts.fill ?? 1,
  };

  // Geometry stays in drawing units — the caller scales the context — so the
  // only thing pxPerUnit does is keep the thinnest lines visible.
  const s = 1;
  const minWidth = 0.45 / Math.max(0.0001, pxPerUnit);

  function widthPx(w) {
    return Math.max(minWidth, w * base.weight);
  }

  /**
   * Displace a resampled path by smooth noise along its normals.
   * `phase` decorrelates the passes so each pass wanders differently.
   */
  function wobble(path, amp, freq, phase) {
    const out = new Array(path.length);
    for (let i = 0; i < path.length; i++) {
      const prev = path[Math.max(0, i - 1)];
      const nextP = path[Math.min(path.length - 1, i + 1)];
      let tx = nextP.x - prev.x;
      let ty = nextP.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      const t = i / Math.max(1, path.length - 1);
      const n = drift(t * freq + phase);
      const j = grit(t * freq * 6 + phase * 3) * 0.35;
      const d = (n + j) * amp;
      // normal is (-ty, tx)
      out[i] = pt(path[i].x - ty * d, path[i].y + tx * d);
    }
    return out;
  }

  /** Draw one pass as short tapered segments, with occasional pen skips. */
  function pass(path, o) {
    const n = path.length;
    if (n < 2) return;
    ctx.strokeStyle = o.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = o.alpha;

    for (let i = 1; i < n; i++) {
      const t = i / (n - 1);
      // taper: thin at both ends unless closed
      const taper = o.closed ? 1 : Math.min(1, Math.sin(Math.PI * Math.min(1, t * 1.15)) * 1.25 + 0.15);
      const p = 0.72 + press(t * 4 + o.phase * 5) * 0.42;
      const w = widthPx(o.width * taper * p);
      if (w <= 0.05) continue;
      // pen skip: a short dry patch every so often
      if (o.skip > 0 && grit(t * 11 + o.phase * 7) > 1 - o.skip) continue;
      ctx.beginPath();
      ctx.moveTo(path[i - 1].x, path[i - 1].y);
      ctx.lineTo(path[i].x, path[i].y);
      ctx.lineWidth = w;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const ink = {
    rng,
    pxPerUnit,
    lod,
    s,

    /** Override defaults for a while. */
    with(over, fn) {
      const saved = { ...base };
      Object.assign(base, over);
      try {
        return fn();
      } finally {
        Object.assign(base, saved);
      }
    },

    /**
     * Draw a wobbly line through `path`.
     * @param {object} o
     * @param {number} o.width   line width in units (1 ~= a fine pen)
     * @param {number} o.passes  how many overlapping strokes (2 = sketchy)
     * @param {number} o.wobble  displacement amplitude in units
     * @param {number} o.alpha
     * @param {number} o.skip    0..0.3 chance of dry gaps
     * @param {boolean} o.closed no end taper
     * @param {string} o.color
     */
    stroke(path, o = {}) {
      const width = o.width ?? 1;
      // a third overlapping pass is pure cost below about 100px
      const passes = lod < 0.6 ? Math.min(2, o.passes ?? 2) : (o.passes ?? 2);
      const amp = (o.wobble ?? 0.9) * base.shake * s;
      const freq = o.freq ?? 3.2;
      const alpha = (o.alpha ?? 0.84) * base.alphaMul;
      const color = o.color ?? base.color;
      const dense = resample(path, Math.max(1.1, (2.4 * s) / lod));

      for (let k = 0; k < passes; k++) {
        const phase = (o.phase ?? 0) + k * 13.37 + rng.next() * 3;
        const jitterAmp = amp * (k === 0 ? 1 : 1.15);
        const wob = wobble(dense, jitterAmp, freq, phase);
        pass(wob, {
          color,
          alpha: alpha * (k === 0 ? 1 : 0.78),
          width: width * (k === 0 ? 1 : 0.82),
          phase,
          skip: Math.max(0, (o.skip ?? 0.06) + base.skipExtra),
          closed: o.closed ?? false,
        });
      }
    },

    /** Same as stroke() but for closed shapes (no taper, wraps around). */
    outline(path, o = {}) {
      const p = path[0] === path[path.length - 1] ? path : [...path, path[0]];
      ink.stroke(p, { ...o, closed: true, skip: o.skip ?? 0.03 });
    },

    /** A short straight tick — eyelashes, freckle dashes, stitches. */
    tick(x1, y1, x2, y2, o = {}) {
      ink.stroke([pt(x1, y1), pt(x2, y2)], { passes: 1, wobble: 0.35, ...o });
    },

    /** Solid-ish ink blob: fill the shape, then rough up the edge. */
    fill(path, o = {}) {
      const amp = (o.wobble ?? 0.7) * base.shake * s;
      const dense = resample(path, Math.max(1.2, (2.6 * s) / lod));
      const wob = wobble(dense, amp, o.freq ?? 3, o.phase ?? 0);
      ctx.save();
      ctx.fillStyle = o.color ?? base.color;
      ctx.globalAlpha = Math.min((o.alpha ?? 0.9) * base.alphaMul, base.fillCap);
      ctx.beginPath();
      ctx.moveTo(wob[0].x, wob[0].y);
      for (let i = 1; i < wob.length; i++) ctx.lineTo(wob[i].x, wob[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (o.edge !== false) {
        ink.outline(path, {
          width: o.edgeWidth ?? 0.8,
          passes: 1,
          wobble: (o.wobble ?? 0.7) * 1.4,
          alpha: 0.5,
          color: o.color ?? base.color,
        });
      }
    },

    /** Run `fn` with drawing clipped to `path`. */
    clipped(path, fn) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.closePath();
      ctx.clip();
      try {
        fn();
      } finally {
        ctx.restore();
      }
    },

    /**
     * Parallel hatching inside a closed shape — the workhorse for hair,
     * beanies, beards and shading.
     * @param {object} o
     * @param {number} o.angle    radians; 0 = horizontal lines
     * @param {number} o.spacing  gap between lines, in units
     * @param {number} o.width
     * @param {number} o.jitter   per-line spacing randomness 0..1
     * @param {number} o.cross    if set, a second layer at angle+cross
     */
    hatch(path, o = {}) {
      const angle = o.angle ?? -Math.PI / 2;
      const spacing = (Math.max(0.6, o.spacing ?? 2.2) * s) / lod;
      const jitter = o.jitter ?? 0.5;
      const b = pathBounds(path);
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const diag = Math.hypot(b.w, b.h) * 0.62 + 4;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      ink.clipped(path, () => {
        for (let d = -diag; d <= diag; d += spacing) {
          const off = d + (rng.next() - 0.5) * spacing * jitter;
          // line centre, walking perpendicular to the hatch direction
          const mx = cx + -sa * off;
          const my = cy + ca * off;
          const half = diag * (0.9 + rng.next() * 0.35);
          const a = pt(mx - ca * half, my - sa * half);
          const z = pt(mx + ca * half, my + sa * half);
          ink.stroke([a, z], {
            width: (o.width ?? 0.7) * (0.75 + rng.next() * 0.5),
            passes: 1,
            wobble: o.wobble ?? 0.5,
            freq: 5,
            alpha: (o.alpha ?? 0.6) * (0.6 + rng.next() * 0.5),
            skip: o.skip ?? 0.1,
            phase: rng.next() * 40,
          });
        }
        if (o.cross) {
          const inner = { ...o, angle: angle + o.cross, cross: 0, spacing: (o.spacing ?? 2.2) * 1.4 };
          const angle2 = inner.angle;
          const ca2 = Math.cos(angle2);
          const sa2 = Math.sin(angle2);
          const sp2 = (Math.max(0.6, inner.spacing) * s) / lod;
          for (let d = -diag; d <= diag; d += sp2) {
            const off = d + (rng.next() - 0.5) * sp2 * jitter;
            const mx = cx + -sa2 * off;
            const my = cy + ca2 * off;
            const half = diag * (0.85 + rng.next() * 0.3);
            ink.stroke([pt(mx - ca2 * half, my - sa2 * half), pt(mx + ca2 * half, my + sa2 * half)], {
              width: (o.width ?? 0.7) * 0.8,
              passes: 1,
              wobble: 0.5,
              freq: 5,
              alpha: (o.alpha ?? 0.6) * 0.55,
              skip: 0.12,
              phase: rng.next() * 40,
            });
          }
        }
      });
    },

    /**
     * Short strokes flowing outward from `origin`, clipped to `path`.
     *
     * This is what makes hair read as hair: real pen strokes are short and
     * follow the direction the hair grows, whereas parallel hatching across a
     * whole shape reads as a barcode.
     *
     * @param {object} o
     * @param {{x:number,y:number}} o.origin  strokes point away from here
     * @param {number} o.count
     * @param {number} o.length   mean stroke length in units
     * @param {number} o.spread   direction jitter in radians
     * @param {number} o.curl     sideways bow of each stroke
     */
    flow(path, o = {}) {
      const b = pathBounds(path);
      const origin = o.origin ?? pt((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
      const count = Math.max(1, Math.round((o.count ?? (b.w * b.h) / 9) * lod));
      const meanLen = o.length ?? 6;
      const spread = o.spread ?? 0.22;
      const curl = o.curl ?? 0.9;

      ink.clipped(path, () => {
        let placed = 0;
        let tries = 0;
        const maxTries = count * 10;
        while (placed < count && tries < maxTries) {
          tries++;
          const x = b.minX + rng.next() * b.w;
          const y = b.minY + rng.next() * b.h;
          if (!pointInPath(path, x, y)) continue;
          placed++;

          let dx = x - origin.x;
          let dy = y - origin.y;
          const d = Math.hypot(dx, dy) || 1;
          const a = Math.atan2(dy / d, dx / d) + rng.gauss(0, spread);
          const len = meanLen * rng.range(0.55, 1.5);
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const x0 = x - ca * len * 0.5;
          const y0 = y - sa * len * 0.5;
          const x1 = x + ca * len * 0.5;
          const y1 = y + sa * len * 0.5;
          const bow = rng.gauss(0, curl);
          const mid = pt((x0 + x1) / 2 - sa * bow, (y0 + y1) / 2 + ca * bow);
          ink.stroke([pt(x0, y0), mid, pt(x1, y1)], {
            width: (o.width ?? 0.7) * rng.range(0.7, 1.35),
            passes: 1,
            wobble: 0.35,
            freq: 4,
            alpha: (o.alpha ?? 0.7) * rng.range(0.6, 1.05),
            skip: 0.05,
            phase: rng.next() * 90,
          });
        }
      });
    },

    /**
     * Loose back-and-forth scribble inside a shape — curly hair, thick beards.
     */
    scribble(path, o = {}) {
      const b = pathBounds(path);
      const loops = Math.max(1, Math.round((o.loops ?? (b.w * b.h) / (26 * s * s)) * lod));
      const r = (o.radius ?? 2.4) * s;
      // `turns` above 1 closes the loop and keeps going, which is what turns an
      // arc into the little "e" curl that reads as curly hair.
      const turns = o.turns ?? 0.75;
      ink.clipped(path, () => {
        for (let i = 0; i < loops; i++) {
          const x = b.minX + rng.next() * b.w;
          const y = b.minY + rng.next() * b.h;
          const rr = r * (0.55 + rng.next() * 0.9);
          const from = rng.next() * Math.PI * 2;
          const span = Math.PI * 2 * turns * (0.7 + rng.next() * 0.7);
          const steps = Math.max(8, Math.round(Math.abs(span) * 3));
          ink.stroke(ellipsePath(x, y, rr, rr * (0.6 + rng.next() * 0.7), from, from + span, steps), {
            width: (o.width ?? 0.75) * (0.8 + rng.next() * 0.5),
            passes: 1,
            wobble: 0.5,
            alpha: (o.alpha ?? 0.6) * (0.55 + rng.next() * 0.5),
            skip: 0.06,
            phase: rng.next() * 50,
          });
        }
      });
    },

    /**
     * A flat patch of colour, of the sort a hand-coloured print gets: muted,
     * matte, and deliberately off-register from the ink it belongs to.
     *
     * @param {object} o
     * @param {string} o.color
     * @param {number} o.alpha
     * @param {[number,number]} o.offset  displacement in units
     * @param {number} o.scale            grow/shrink about the patch centre
     * @param {number} o.rotate           radians about the patch centre
     * @param {number} o.wobble           edge irregularity
     * @param {number} o.feather          extra soft halo pass
     */
    wash(path, o = {}) {
      const [dx, dy] = o.offset ?? [0, 0];
      const scale = o.scale ?? 1;
      const rot = o.rotate ?? 0;
      const b = pathBounds(path);
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const ca = Math.cos(rot);
      const sa = Math.sin(rot);

      const moved = path.map((p) => {
        const ox = (p.x - cx) * scale;
        const oy = (p.y - cy) * scale;
        return pt(cx + ox * ca - oy * sa + dx, cy + ox * sa + oy * ca + dy);
      });

      const paint = (pp, alpha) => {
        const dense = resample(pp, Math.max(1.4, (3 * s) / lod));
        const wob = wobble(dense, (o.wobble ?? 1.1) * base.shake * s, 2.2, o.phase ?? 0);
        ctx.save();
        ctx.fillStyle = o.color ?? 'rgb(201,141,99)';
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(wob[0].x, wob[0].y);
        for (let i = 1; i < wob.length; i++) ctx.lineTo(wob[i].x, wob[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      const alpha = o.alpha ?? 0.55;
      if (o.feather) paint(insetPath(moved, -(o.feather * s)), alpha * 0.35);
      paint(moved, alpha);
    },

    /** Little ink dot — pupils, freckles, moles. */
    dot(x, y, radius, o = {}) {
      const r = radius * s;
      ctx.save();
      ctx.fillStyle = o.color ?? base.color;
      ctx.globalAlpha = Math.min((o.alpha ?? 0.88) * base.alphaMul, base.fillCap);
      ctx.beginPath();
      // 3-lobed irregular dot reads as ink, a perfect circle reads as vector
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const rr = r * (0.82 + 0.3 * Math.abs(drift(i * 0.7 + x * 0.13 + y * 0.07)));
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };

  return ink;
}

// ---------------------------------------------------------------------------
// Paper
// ---------------------------------------------------------------------------

const paperTileCache = new Map();

/** A cached 128px noise tile, reused across every face on the page. */
function noiseTile(kind, strength) {
  const key = `${kind}:${strength}`;
  if (paperTileCache.has(key)) return paperTileCache.get(key);
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const cx = c.getContext('2d');
  const img = cx.createImageData(size, size);
  const rng = makeRng(`paper-${kind}`);
  for (let i = 0; i < size * size; i++) {
    const v = rng.next();
    const g = 128 + (v - 0.5) * 255 * strength;
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  paperTileCache.set(key, c);
  return c;
}

/**
 * Paint aged paper into the whole canvas: warm base, soft blotches,
 * fine grain, a few fibres, and a gentle vignette.
 */
export function paintPaper(ctx, w, h, opts = {}) {
  const rng = makeRng(opts.seed ?? 'paper');
  const tone = opts.tone ?? '#e9e5da';
  const grain = opts.grain ?? 0.5;

  ctx.save();
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, w, h);

  // soft tonal blotches
  const blots = Math.round(3 + (w * h) / 90000);
  for (let i = 0; i < blots; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    const r = Math.max(w, h) * (0.18 + rng.next() * 0.4);
    const dark = rng.chance(0.55);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = (0.02 + rng.next() * 0.045) * grain * 2;
    g.addColorStop(0, dark ? `rgba(120,105,80,${a})` : `rgba(255,253,246,${a * 1.3})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // fine grain
  if (grain > 0) {
    const tile = noiseTile('fine', 1);
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.16 * grain;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);

    const coarse = noiseTile('coarse', 0.6);
    ctx.globalAlpha = 0.1 * grain;
    ctx.fillStyle = ctx.createPattern(coarse, 'repeat');
    ctx.save();
    ctx.scale(3, 3);
    ctx.fillRect(0, 0, w / 3, h / 3);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // paper fibres
  const fibres = Math.round(((w + h) / 60) * (opts.lod ?? 1));
  ctx.lineWidth = 1;
  for (let i = 0; i < fibres; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    const len = 6 + rng.next() * 40;
    const a = rng.next() * Math.PI;
    ctx.strokeStyle = rng.chance(0.5) ? 'rgba(150,138,115,0.09)' : 'rgba(255,255,255,0.11)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }

  // vignette
  if (opts.vignette !== false) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(90,76,50,0.11)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}

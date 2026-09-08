/**
 * Turns a genome into concrete geometry in the 100-unit face box
 * (origin at the centre, y down, x/y roughly in [-50, 50]).
 *
 * Kept separate from drawing so features, hair, hats and accessories all
 * agree on where the head actually is — and, importantly, so they all get the
 * same head *turn* for free.
 */

import { pt } from './ink.js';
import { makeFbm1D, makeRng } from './rng.js';

/** Smooth piecewise interpolation through (t, value) control points. */
function curveAt(points, t) {
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, v0] = points[i];
    const [t1, v1] = points[i + 1];
    if (t <= t1) {
      const u = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      const s = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * s;
    }
  }
  return points[points.length - 1][1];
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function makeAnatomy(genome) {
  const g = genome;
  const cx = 0;
  const cy = 2;
  const w = g.head.w;
  const h = g.head.h;
  const n = g.head.exp || 2.05;
  const yaw = g.head.yaw || 0;
  const lopsided = g.head.lopsided || 0;

  // Width multiplier down the face: brow band, then jaw band.
  const widthCurve = [
    [0.0, 1.0],
    [0.22, g.head.brow],
    [0.5, 1.0],
    [0.78, g.head.jaw],
    [1.0, 0.9],
  ];

  const top = cy - h;
  const bottom = cy + h;

  /** Normalised height 0 (crown) .. 1 (chin) -> absolute y. */
  const yAt = (tn) => top + (bottom - top) * tn;
  /** Absolute y -> normalised height. */
  const tAt = (y) => (y - top) / (bottom - top);

  // A per-face lumpiness, driven by absolute y so that the head outline, the
  // hair shell and the beard all bulge in the same places.
  const lump = makeFbm1D(makeRng(`${g.seed}:skull`), 2);

  /**
   * Half-width of the head at absolute y.
   * `grow` inflates the whole silhouette (used for hair and hats).
   */
  function halfWidth(y, growX = 0, growY = 0) {
    const W = w * (1 + growX);
    const H = h * (1 + growY);
    const v = (y - cy) / H;
    if (Math.abs(v) >= 1) return 0;
    const bulge = Math.pow(1 - Math.pow(Math.abs(v), n), 1 / n);
    const taper = curveAt(widthCurve, clamp((y - (cy - H)) / (2 * H), 0, 1));
    return W * bulge * taper * (1 + lump(y * 0.075) * 0.06);
  }

  const cosY = Math.cos(yaw);

  /**
   * Turning the head.
   *
   * The face is treated as if painted on a cylinder: a point at horizontal
   * position u = x/w sits at angle asin(u), and turning by `yaw` moves it to
   * sin(asin(u) + yaw). Dividing by cos(yaw) renormalises so the silhouette
   * keeps its width — otherwise the whole head would narrow, which is correct
   * for a cylinder but wrong for a doodle.
   *
   * The result: the centre line slides toward the side being faced, features
   * bunch up on that side and spread out on the other, and the outline stays
   * put. Anything outside the skull (hair puff, hats, ears) passes through
   * unchanged, so nothing gets sheared off.
   */
  // A real head narrows as it turns away. Renormalising by cos(yaw) alone keeps
  // the silhouette at full width, which past about 20 degrees stops reading as
  // a turn and starts reading as a lumpy blob — so give back a little of the
  // narrowing the renormalisation removed.
  const narrow = 1 - 0.18 * Math.min(1, Math.abs(yaw) / 0.5);

  function turnX(x) {
    const u = x / w;
    if (Math.abs(u) >= 1) return x * narrow;
    return ((w * Math.sin(Math.asin(u) + yaw)) / cosY) * narrow;
  }

  // Lines the profile needs to know about, computed before the transforms so
  // the silhouette can bulge in the right places.
  const noseLine = yAt(0.6) + g.nose.y * h;
  const mouthLine = yAt(0.76) + g.mouth.y * h;
  const facing = yaw === 0 ? 0 : Math.sign(yaw);

  /**
   * The part of a turned head that the cylinder can't give you: a nose and
   * lips pushing out past the leading edge, and the cranium swinging out
   * behind. Without these the head just looks like a frontal face whose
   * features slid sideways.
   */
  function profileX(x, y) {
    const a = Math.abs(yaw);
    if (a < 0.18) return x;
    const k = Math.min(1, (a - 0.18) / 0.3);
    const s = x >= 0 ? 1 : -1;
    let out = 0;
    if (s === facing) {
      const dn = (y - noseLine) / (h * 0.3);
      out += Math.exp(-dn * dn) * h * 0.13 * k;
      const dl = (y - mouthLine) / (h * 0.26);
      out += Math.exp(-dl * dl) * h * 0.05 * k;
    } else {
      const db = (y - (cy - h * 0.3)) / (h * 0.6);
      out += Math.exp(-db * db) * h * 0.09 * k;
    }
    return x + s * out;
  }

  const tilt = g.head.tilt;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);

  /**
   * Frontal coordinates -> final drawing coordinates: turn, then lopsided
   * skew, then the head tilt. Every drawing function goes through this, so a
   * feature only ever has to know where it sits on an imaginary flat face.
   */
  function tiltPoint(p) {
    let x = turnX(p.x);
    if (lopsided) x *= 1 + lopsided * Math.sign(x);
    const dx = x - cx;
    const dy = p.y - cy;
    return pt(cx + dx * cosT - dy * sinT, cy + dx * sinT + dy * cosT);
  }

  function tiltPath(path) {
    return path.map(tiltPoint);
  }

  /**
   * Closed silhouette, sampled top-to-bottom down the right side and back up
   * the left. `growX/growY` inflate it for hair/hat shells.
   */
  function silhouette(growX = 0, growY = 0, steps = 44) {
    const H = h * (1 + growY);
    const yTop = cy - H;
    const yBot = cy + H;
    const right = [];
    const left = [];
    for (let i = 0; i <= steps; i++) {
      const y = yTop + ((yBot - yTop) * i) / steps;
      const hw = halfWidth(y, growX, growY);
      right.push(pt(profileX(cx + hw, y), y));
      left.push(pt(profileX(cx - hw, y), y));
    }
    return [...right, ...left.reverse()];
  }

  return {
    genome: g,
    cx,
    cy,
    w,
    h,
    top,
    bottom,
    exp: n,
    yaw,
    /** +1 when the head faces right, -1 when it faces left, 0 dead-on. */
    facing,
    /** 0 (frontal) .. 1 (fully turned), for scaling how much a feature reacts. */
    turn: Math.min(1, Math.abs(yaw) / 0.5),
    yAt,
    tAt,
    halfWidth,
    silhouette,
    profileX,
    turnX,
    tiltPoint,
    tiltPath,

    // Feature lines, as normalised heights down the face.
    eyeY: yAt(0.46) + g.eyes.y * h,
    browY: yAt(0.46) + g.eyes.y * h - h * (0.17 + g.brows.y),
    noseY: yAt(0.6) + g.nose.y * h,
    mouthY: yAt(0.76) + g.mouth.y * h,
    earY: yAt(0.5) + g.ears.y * h,

    /** Horizontal distance from centre to each eye, before the turn. */
    eyeGap: w * g.eyes.spacing,
  };
}

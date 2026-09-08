/**
 * Face features: ears, eyes, brows, nose, mouth, tusks, marks and props.
 * Every function takes (ink, anatomy, genome) and draws in the 100-unit box.
 *
 * Positions are given in *frontal* coordinates — as if the face were flat and
 * facing you. `an.tiltPath` applies the head turn, the lopsided skew and the
 * tilt on the way out, so nothing here has to think about the pose except
 * where the pose genuinely changes the drawing (a hidden far ear, a nose seen
 * from three-quarters).
 */

import { closedCurve, ellipsePath, openCurve, pt } from './ink.js?v=df44e11666';

function withTilt(an, x, y) {
  const p = an.tiltPoint(pt(x, y));
  return [p.x, p.y];
}

const clampNum = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Expression is applied as a lens, not as a trait.
 *
 * Past a threshold the mouth style itself is substituted — you cannot smile
 * with a frown — but everything else is a continuous nudge, so a face keeps
 * its own eyes and brows while changing mood.
 */
function moodMouth(style, e) {
  if (e >= 0.4) {
    if (style === 'smile') return 'grin';
    if (['line', 'wavy', 'pursed', 'smirk', 'dot', 'frown', 'stitched', 'zigzag', 'twoLines'].includes(style)) return 'smile';
    return style;
  }
  if (e <= -0.4) {
    if (['smile', 'grin', 'line', 'wavy', 'pursed', 'smirk', 'dot', 'o'].includes(style)) return 'frown';
    return style;
  }
  return style;
}

function rotateAround(path, cx, cy, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return path.map((p) => pt(cx + (p.x - cx) * c - (p.y - cy) * s, cy + (p.x - cx) * s + (p.y - cy) * c));
}

// ---------------------------------------------------------------------------
// Ears
// ---------------------------------------------------------------------------

export function drawEars(ink, an, g) {
  const e = g.ears;
  if (e.style === 'hidden') return;

  for (const side of [-1, 1]) {
    // Turn a head to the right and the viewer sees the ear on the *left* of
    // the image — the other one swings behind the skull and disappears.
    const visible = an.facing === 0 || side === -an.facing;
    const shrink = visible ? 1 + an.turn * 0.3 : 1 - an.turn * 0.95;
    if (shrink < 0.18) continue;

    const y = an.earY;
    const x = side * (an.halfWidth(y) - 0.4);
    const r = 2.5 * e.size * shrink;
    const long = e.long ? 1.9 : 1;

    const half = (rx, ry, spanScale = 1) => {
      const span = (Math.PI / 2) * spanScale;
      return side > 0
        ? ellipsePath(x, y, rx, ry, -span, span, 16)
        : ellipsePath(x, y, rx, ry, Math.PI - span, Math.PI + span, 16);
    };

    if (e.style === 'arc') {
      ink.stroke(an.tiltPath(half(r * 0.8, r * 1.15, 0.92)), { width: 0.85, passes: 2, wobble: 0.55 });
    } else if (e.style === 'round') {
      ink.stroke(an.tiltPath(half(r, r * 1.1)), { width: 0.85, passes: 2, wobble: 0.5 });
      ink.stroke(an.tiltPath(half(r * 0.42, r * 0.5, 0.8)), { width: 0.55, passes: 1, wobble: 0.4, alpha: 0.5 });
    } else if (e.style === 'big') {
      ink.stroke(an.tiltPath(half(r * 1.7, r * 1.5)), { width: 0.9, passes: 2, wobble: 0.6 });
      ink.stroke(an.tiltPath(half(r * 0.8, r * 0.75, 0.85)), { width: 0.55, passes: 1, wobble: 0.4, alpha: 0.45 });
    } else if (e.style === 'droopy') {
      // a long lobe sagging below the jawline
      ink.stroke(
        an.tiltPath(openCurve([
          pt(x, y - r * 0.9),
          pt(x + side * r * 1.15, y + r * 0.2),
          pt(x + side * r * 0.7, y + r * 2.4),
          pt(x - side * r * 0.1, y + r * 2.1),
        ], 9)),
        { width: 0.85, passes: 2, wobble: 0.5 },
      );
    } else if (e.style === 'cauliflower') {
      // a lumpy scribbled blob — the ear of somebody who took a few
      const blob = ellipsePath(x + side * r * 0.45, y, r * 1.05, r * 1.3, 0, Math.PI * 2, 16);
      ink.scribble(an.tiltPath(blob), { radius: r * 0.35, width: 0.65, alpha: 0.65, turns: 1.1 });
      ink.outline(an.tiltPath(blob), { width: 0.8, passes: 2, wobble: 0.9, alpha: 0.7 });
    } else if (e.style === 'pointy') {
      // Elf/orc/goblin ears: a leaf sweeping up and back at roughly 45°.
      // It needs real width — push the tip much further up than out and it
      // stops reading as an ear and starts reading as an antenna.
      const tipOut = r * (1.0 + 0.5 * long);
      const tipUp = r * (1.3 + 0.9 * long);
      const tip = pt(x + side * tipOut, y - tipUp);
      // front edge, from the lobe up to the point
      ink.stroke(
        an.tiltPath(openCurve([pt(x, y + r * 0.9), pt(x + side * r * 0.95, y + r * 0.05), tip], 8)),
        { width: 0.9, passes: 2, wobble: 0.5 },
      );
      // back edge, returning to the skull
      ink.stroke(
        an.tiltPath(openCurve([tip, pt(x + side * r * 0.3, y - r * 0.55), pt(x - side * r * 0.1, y - r * 0.9)], 8)),
        { width: 0.85, passes: 2, wobble: 0.5 },
      );
      // inner fold, running most of the way to the point
      ink.stroke(
        an.tiltPath(openCurve([
          pt(x + side * r * 0.35, y + r * 0.35),
          pt(x + side * tipOut * 0.7, y - tipUp * 0.55),
        ], 6)),
        { width: 0.5, passes: 1, wobble: 0.4, alpha: 0.45 },
      );
    }
  }
}

/**
 * Horns.
 *
 * They root at the *edge* of the skull near the crown and sweep clear of the
 * silhouette. Rooted further in and kept short, they end up buried in the hair
 * and read as stray pen marks rather than horns.
 */
export function drawHorns(ink, an, g) {
  const h = g.horns;
  if (!h) return;
  const yBase = an.yAt(0.17);
  for (const side of [-1, 1]) {
    const x0 = side * an.halfWidth(yBase) * 0.9 * h.spread;
    const s = 11 * h.size;
    let path;
    if (h.style === 'straight') {
      path = openCurve([
        pt(x0, yBase),
        pt(x0 + side * s * 0.28, yBase - s * 0.9),
        pt(x0 + side * s * 0.5, yBase - s * 1.75),
      ], 9);
    } else if (h.style === 'ram') {
      // out, down, and curling back under itself
      path = openCurve([
        pt(x0, yBase),
        pt(x0 + side * s * 0.95, yBase - s * 0.5),
        pt(x0 + side * s * 1.15, yBase + s * 0.45),
        pt(x0 + side * s * 0.55, yBase + s * 0.75),
      ], 11);
    } else {
      path = openCurve([
        pt(x0, yBase),
        pt(x0 + side * s * 0.72, yBase - s * 0.7),
        pt(x0 + side * s * 0.62, yBase - s * 1.6),
      ], 11);
    }
    const tp = an.tiltPath(path);
    // drawn twice at different widths so it tapers to a point
    ink.stroke(tp, { width: 3.6 * h.size, passes: 2, wobble: 0.5, alpha: 0.9 });
    ink.stroke(tp.slice(Math.floor(tp.length * 0.5)), { width: 1.8 * h.size, passes: 2, wobble: 0.4, alpha: 0.85 });
    // ridges
    for (let i = 1; i < 4; i++) {
      const q = tp[Math.floor(((tp.length - 1) * i) / 4)];
      ink.stroke([pt(q.x - 1.5 * h.size, q.y), pt(q.x + 1.5 * h.size, q.y)], {
        width: 0.55,
        passes: 1,
        wobble: 0.3,
        alpha: 0.5,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Eyes
// ---------------------------------------------------------------------------

/** Styles that only make sense applied to both eyes at once. */
const PAIR_STYLES = new Set(['mismatched', 'wink']);

export function drawEyes(ink, an, g) {
  const e = g.eyes;

  for (const side of [-1, 1]) {
    let style = e.style;
    if (e.style === 'mismatched') {
      style = side < 0 ? (PAIR_STYLES.has(e.styleB) ? 'oval' : e.styleB) : 'round';
    } else if (e.style === 'wink') {
      style = side === g.hair.part ? 'closed' : 'oval';
    }

    // the two eyes disagree slightly — that is most of the charm
    const k = side < 0 ? 1 : 1 + e.asym;
    // The eye on the side being faced is sliding away round the curve, so it
    // is the one that gets foreshortened.
    const leading = an.facing !== 0 && side === an.facing;
    const squash = leading ? 1 - an.turn * 0.45 : 1;

    const size = e.size * k;
    const x = side * an.eyeGap * (1 + (side < 0 ? 0 : e.asym * 0.15));
    const y = an.eyeY + (side < 0 ? 0 : e.heightAsym);

    drawOneEye(ink, an, g, x, y, size, side, style, squash);

    if (e.bags) {
      ink.stroke(an.tiltPath(ellipsePath(x, y + 3.4 * size, 3 * size, 1.6 * size, -Math.PI * 0.85, -Math.PI * 0.15, 10)), {
        width: 0.5,
        passes: 1,
        wobble: 0.45,
        alpha: 0.42,
      });
    }
  }
}

function drawOneEye(ink, an, g, x, y, size, side, style, squash) {
  const e = g.expression || 0;
  const rx = 3.5 * size * squash;
  // smiling narrows the eyes; scowling drops the upper lid over them
  const ry = 2.6 * size * (1 - Math.abs(e) * 0.3);
  const pupilR = 0.95 * size * g.eyes.pupil;
  const T = (p) => an.tiltPath(p);

  switch (style) {
    case 'dot':
      ink.dot(...withTilt(an, x, y), pupilR * 1.9);
      return;

    case 'beady':
      ink.stroke(T(ellipsePath(x, y, rx * 0.5, rx * 0.5, 0, Math.PI * 2, 14)), {
        width: 0.8,
        passes: 2,
        wobble: 0.45,
        closed: true,
      });
      ink.dot(...withTilt(an, x, y), pupilR * 1.1);
      return;

    case 'line':
      ink.stroke(T(ellipsePath(x, y + ry * 0.5, rx, ry * 0.9, -Math.PI * 0.82, -Math.PI * 0.18, 12)), {
        width: 1.0,
        passes: 2,
        wobble: 0.5,
      });
      ink.dot(...withTilt(an, x, y + ry * 0.05), pupilR * 1.1);
      return;

    case 'closed':
      // a contented upward arc, the classic ^_^
      ink.stroke(T(ellipsePath(x, y + ry * 0.9, rx, ry * 1.3, -Math.PI * 0.78, -Math.PI * 0.22, 12)), {
        width: 1.15,
        passes: 2,
        wobble: 0.5,
      });
      return;

    case 'sleepy':
      ink.stroke(T(ellipsePath(x, y, rx, ry * 1.25, -Math.PI * 0.95, -Math.PI * 0.05, 14)), {
        width: 1.05,
        passes: 2,
        wobble: 0.5,
      });
      ink.dot(...withTilt(an, x, y - ry * 0.1), pupilR * 1.15);
      return;

    case 'squint':
      ink.stroke(T(ellipsePath(x, y - ry * 0.4, rx, ry, Math.PI * 0.15, Math.PI * 0.85, 12)), {
        width: 0.95,
        passes: 2,
        wobble: 0.5,
      });
      ink.stroke(T(ellipsePath(x, y + ry * 0.35, rx * 0.9, ry * 0.8, -Math.PI * 0.85, -Math.PI * 0.15, 10)), {
        width: 0.7,
        passes: 1,
        wobble: 0.5,
        alpha: 0.55,
      });
      return;

    case 'glare': {
      // heavy angled lid crushing a small pupil — permanently unimpressed
      const lidIn = side * -1;
      ink.stroke(
        T(openCurve([
          pt(x - rx, y - ry * 0.1 + lidIn * ry * 0.5),
          pt(x, y - ry * 0.55),
          pt(x + rx, y - ry * 0.1 - lidIn * ry * 0.5),
        ], 8)),
        { width: 2.0, passes: 2, wobble: 0.45 },
      );
      ink.stroke(T(ellipsePath(x, y + ry * 0.5, rx * 0.85, ry * 0.75, -Math.PI * 0.9, -Math.PI * 0.1, 10)), {
        width: 0.7,
        passes: 1,
        wobble: 0.45,
        alpha: 0.6,
      });
      ink.dot(...withTilt(an, x, y + ry * 0.05), pupilR * 0.95);
      return;
    }

    case 'googly': {
      // a big loose ring with the pupil rattling around inside it
      const r = rx * 1.15;
      ink.stroke(T(ellipsePath(x, y, r, r, 0, Math.PI * 2, 22)), {
        width: 0.9,
        passes: 2,
        wobble: 0.7,
        closed: true,
      });
      const a = (side + 1) * 1.7 + size;
      ink.dot(...withTilt(an, x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4), pupilR * 1.5);
      return;
    }

    case 'slit': {
      // reptilian: a wide almond with a vertical bar for a pupil
      ink.stroke(T(ellipsePath(x, y, rx * 1.15, ry * 0.85, 0, Math.PI * 2, 22)), {
        width: 0.9,
        passes: 2,
        wobble: 0.5,
        closed: true,
      });
      ink.fill(
        T(closedCurve([
          pt(x - pupilR * 0.5, y - ry * 0.62),
          pt(x + pupilR * 0.5, y - ry * 0.62),
          pt(x + pupilR * 0.5, y + ry * 0.62),
          pt(x - pupilR * 0.5, y + ry * 0.62),
        ], 5)),
        { alpha: 0.9, wobble: 0.4, edge: false },
      );
      return;
    }

    case 'hollow':
      // an empty socket — no pupil at all, which is unsettling for free
      ink.stroke(T(ellipsePath(x, y, rx, ry * 1.1, 0, Math.PI * 2, 24)), {
        width: 1.1,
        passes: 2,
        wobble: 0.6,
        closed: true,
      });
      ink.hatch(T(ellipsePath(x, y, rx * 0.9, ry, 0, Math.PI * 2, 20)), {
        angle: -1.2,
        spacing: 1.6,
        width: 0.5,
        alpha: 0.35,
      });
      return;

    case 'sideways': {
      // both pupils shoved hard to one side, looking off the page
      const dir = side >= 0 ? 1 : 1; // same direction for both, that is the joke
      ink.stroke(T(ellipsePath(x, y, rx, ry, 0, Math.PI * 2, 24)), {
        width: 0.95,
        passes: 2,
        wobble: 0.5,
        closed: true,
      });
      ink.dot(...withTilt(an, x + dir * rx * 0.5, y), pupilR * 1.1);
      return;
    }

    case 'angry': {
      // inner corner dragged down, outer corner up
      const inner = -side;
      ink.stroke(
        T(openCurve([
          pt(x + inner * rx, y - ry * 0.9),
          pt(x, y - ry * 0.3),
          pt(x - inner * rx, y - ry * 0.55),
        ], 8)),
        { width: 1.3, passes: 2, wobble: 0.45 },
      );
      ink.stroke(T(ellipsePath(x, y + ry * 0.35, rx * 0.9, ry * 0.85, -Math.PI * 0.9, -Math.PI * 0.1, 12)), {
        width: 0.8,
        passes: 2,
        wobble: 0.45,
      });
      ink.dot(...withTilt(an, x, y), pupilR);
      return;
    }

    case 'teary': {
      ink.stroke(T(ellipsePath(x, y, rx, ry * 1.15, 0, Math.PI * 2, 24)), {
        width: 0.95,
        passes: 2,
        wobble: 0.5,
        closed: true,
      });
      ink.dot(...withTilt(an, x, y + ry * 0.15), pupilR * 1.1);
      // a drop hanging off the lower lid
      const dx = x + side * rx * 0.45;
      ink.stroke(
        T(closedCurve([pt(dx, y + ry * 1.1), pt(dx + 1.1, y + ry * 2.1), pt(dx, y + ry * 3), pt(dx - 1.1, y + ry * 2.1)], 7)),
        { width: 0.7, passes: 2, wobble: 0.4, closed: true, alpha: 0.7 },
      );
      return;
    }

    case 'cross': {
      const r = rx * 0.8;
      ink.stroke(T([pt(x - r, y - r * 0.8), pt(x + r, y + r * 0.8)]), { width: 1.2, passes: 2, wobble: 0.45 });
      ink.stroke(T([pt(x + r, y - r * 0.8), pt(x - r, y + r * 0.8)]), { width: 1.2, passes: 2, wobble: 0.45 });
      return;
    }

    case 'star': {
      const r = rx * 0.95;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI + 0.4;
        ink.stroke(T([pt(x - Math.cos(a) * r, y - Math.sin(a) * r), pt(x + Math.cos(a) * r, y + Math.sin(a) * r)]), {
          width: 0.95,
          passes: 1,
          wobble: 0.4,
        });
      }
      return;
    }

    case 'spiral': {
      const turns = 2.4;
      const steps = 34;
      const path = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * Math.PI * 2 * turns;
        const r = rx * 0.95 * t;
        path.push(pt(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9));
      }
      ink.stroke(T(path), { width: 0.8, passes: 1, wobble: 0.35, freq: 6 });
      return;
    }

    default: {
      // the outlined family: oval / wide / round / wonky
      let ex = rx;
      let ey = ry;
      let rot = 0;
      let px = 0;
      let py = 0;
      if (style === 'wide') {
        ex = rx * 1.25;
        ey = ry * 1.35;
      } else if (style === 'round') {
        ex = rx * 0.95;
        ey = rx * 0.95;
      } else if (style === 'wonky') {
        ex = rx * (1 + 0.2 * side);
        ey = ry * (1 - 0.12 * side);
        rot = 0.35 * side;
        px = ex * 0.28 * side;
        py = -ey * 0.2;
      }

      // a turned head also drags the pupils toward the direction of the look
      px += an.facing * an.turn * ex * 0.3;

      let lid = ellipsePath(x, y, ex, ey, 0, Math.PI * 2, 26);
      if (rot) lid = rotateAround(lid, x, y, rot);
      ink.stroke(T(lid), { width: 0.95, passes: 2, wobble: 0.55, closed: true, skip: 0.05 });

      if (style === 'wide' || style === 'round') {
        ink.stroke(T(ellipsePath(x + px, y + py, ey * 0.62, ey * 0.62, 0, Math.PI * 2, 16)), {
          width: 0.6,
          passes: 1,
          wobble: 0.4,
          alpha: 0.5,
          closed: true,
        });
      }
      ink.dot(...withTilt(an, x + px, y + py), pupilR * (style === 'wide' ? 1.2 : 1));

      // a heavy lid, for a face that has had enough
      if (e <= -0.45) {
        ink.stroke(
          T(openCurve([
            pt(x - ex, y - ey * 0.25 - side * ey * 0.4),
            pt(x, y - ey * 0.75),
            pt(x + ex, y - ey * 0.25 + side * ey * 0.4),
          ], 8)),
          { width: 1.7, passes: 2, wobble: 0.45, alpha: 0.85 },
        );
      }

      if (g.eyes.lashes) {
        for (let i = -1; i <= 1; i++) {
          const a = -Math.PI / 2 + i * 0.5;
          const sx = x + Math.cos(a) * ex * 0.85;
          const sy = y + Math.sin(a) * ey * 0.85;
          ink.stroke(an.tiltPath([pt(sx, sy), pt(sx + Math.cos(a) * 2, sy + Math.sin(a) * 2)]), {
            width: 0.55,
            passes: 1,
            wobble: 0.25,
            alpha: 0.6,
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Brows
// ---------------------------------------------------------------------------

export function drawBrows(ink, an, g) {
  const b = g.brows;

  // A heavy orbital ridge, for the kin that have one. Drawn first, so the
  // brows themselves sit on top of it.
  if (b.ridge) {
    // Kept above the eye line and narrow: swept across the whole brow it stops
    // reading as bone and starts reading as a blindfold.
    const y = an.browY - 0.6;
    const hw = an.halfWidth(y) * 0.66;
    const ridge = closedCurve(
      [pt(-hw, y + 0.8), pt(-hw * 0.5, y - 2.2), pt(hw * 0.5, y - 2.2), pt(hw, y + 0.8), pt(0, y + 1.6)],
      8,
    );
    ink.hatch(an.tiltPath(ridge), { angle: -1.35, spacing: 2.1, width: 0.5, alpha: 0.24, jitter: 0.7 });
    ink.stroke(
      an.tiltPath(openCurve([pt(-hw, y + 0.6), pt(0, y - 1.9), pt(hw, y + 0.6)], 9)),
      { width: 1.3, passes: 2, wobble: 0.6, alpha: 0.6 },
    );
  }

  if (b.style === 'none' && !g.props.monobrow) return;
  const th = b.thickness;

  // A single brow straight across, which is a whole personality on its own.
  if (g.props.monobrow) {
    const y = an.browY;
    const hw = an.eyeGap + 3.6;
    ink.stroke(
      an.tiltPath(openCurve([pt(-hw, y + 1), pt(-hw * 0.4, y - 1.2), pt(hw * 0.4, y - 1.1), pt(hw, y + 1.2)], 8)),
      { width: 2.2 * th, passes: 3, wobble: 0.6 },
    );
    return;
  }

  const e = g.expression || 0;
  for (const side of [-1, 1]) {
    const x = side * an.eyeGap * (1 + (side > 0 ? g.eyes.asym * 0.15 : 0));
    // delighted brows ride up; a scowl drags the inner ends down towards the nose
    const y = an.browY + (side > 0 ? b.lift * an.h * 0.05 : 0) - e * 2.1;
    const moodRot = -e * 0.46 * side;
    const leading = an.facing !== 0 && side === an.facing;
    const halfW = 3.5 * (0.9 + th * 0.2) * (leading ? 1 - an.turn * 0.4 : 1);

    if (b.style === 'thin' || b.style === 'thick' || b.style === 'bushy') {
      const arc = openCurve([
        pt(x - halfW, y + 0.9),
        pt(x, y - 1.1 - th * 0.3),
        pt(x + halfW, y + 0.7),
      ], 8);
      const tilted = an.tiltPath(rotateAround(arc, x, y, b.angle * side + moodRot));
      if (b.style === 'bushy') {
        const region = closedCurve(
          [pt(x - halfW * 1.1, y + 1.6), pt(x, y - 2.2 - th * 0.6), pt(x + halfW * 1.1, y + 1.4), pt(x, y + 2.2)],
          8,
        );
        ink.scribble(an.tiltPath(region), { radius: 1.1, width: 0.7, alpha: 0.7, loops: Math.round(16 * th) });
        ink.stroke(tilted, { width: 1.1 * th, passes: 2, wobble: 0.7, alpha: 0.6 });
      } else {
        ink.stroke(tilted, {
          width: (b.style === 'thick' ? 2.1 : 0.85) * th,
          passes: b.style === 'thick' ? 3 : 2,
          wobble: 0.55,
        });
      }
    } else if (b.style === 'angled') {
      ink.stroke(an.tiltPath(rotateAround([pt(x + halfW * side, y + 1.4), pt(x - halfW * side, y - 1.4)], x, y, moodRot)), {
        width: 1.5 * th,
        passes: 2,
        wobble: 0.5,
      });
    } else if (b.style === 'arched') {
      ink.stroke(an.tiltPath(ellipsePath(x, y + 2.2, halfW, 3.2 * th, -Math.PI * 0.88, -Math.PI * 0.12, 12)), {
        width: 1.0 * th,
        passes: 2,
        wobble: 0.5,
      });
    } else if (b.style === 'zigzag') {
      const n = 4;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        pts.push(pt(x - halfW + (2 * halfW * i) / n, y + (i % 2 === 0 ? 1.2 : -1.2) * th));
      }
      ink.stroke(an.tiltPath(pts), { width: 1.0 * th, passes: 2, wobble: 0.4 });
    } else if (b.style === 'stubby') {
      // a short fat dash sitting well above the eye
      ink.stroke(an.tiltPath([pt(x - halfW * 0.55, y), pt(x + halfW * 0.55, y - 0.4)]), {
        width: 2.6 * th,
        passes: 3,
        wobble: 0.4,
      });
    } else if (b.style === 'sparse') {
      // three or four separate hairs, not a line
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const px = x - halfW + 2 * halfW * t;
        const py = y - Math.sin(t * Math.PI) * 1.4;
        ink.stroke(an.tiltPath([pt(px, py + 1), pt(px + 0.4, py - 1.2)]), {
          width: 0.75 * th,
          passes: 1,
          wobble: 0.35,
          alpha: 0.8,
        });
      }
    } else if (b.style === 'worried') {
      ink.stroke(
        an.tiltPath([
          pt(x - halfW * (side > 0 ? -1 : 1), y - 1.5),
          pt(x, y - 0.2),
          pt(x + halfW * (side > 0 ? -1 : 1), y + 1.3),
        ]),
        { width: 1.2 * th, passes: 2, wobble: 0.5 },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Nose
// ---------------------------------------------------------------------------

export function drawNose(ink, an, g) {
  const nz = g.nose;
  // A turned head drags the nose toward the side being faced, harder than the
  // cylinder projection alone would.
  const x = nz.x * an.w + an.cx + an.facing * an.turn * an.w * 0.12;
  const y = an.noseY;
  const s = nz.size;
  const bridgeTop = an.eyeY + 1.2;
  const T = (p) => an.tiltPath(p);
  // which way a one-sided nose points: downwind of the turn, else the parting
  const dir = an.facing !== 0 ? an.facing : g.hair.part;

  switch (nz.style) {
    case 'hook':
      ink.stroke(
        T(openCurve([
          pt(x - dir * 0.4, bridgeTop),
          pt(x, y - 1.5 * s),
          pt(x + dir * 0.6, y + 1.4 * s),
          pt(x - dir * 2.6 * s, y + 2.2 * s),
        ], 8)),
        { width: 1.05, passes: 2, wobble: 0.55 },
      );
      break;

    case 'twoLines':
      for (const side of [-1, 1]) {
        ink.stroke(
          T(openCurve([
            pt(x + side * 1.3 * s, y - 2.4 * s),
            pt(x + side * 1.6 * s, y + 0.9 * s),
            pt(x + side * 0.9 * s, y + 2.1 * s),
          ], 7)),
          { width: 0.9, passes: 2, wobble: 0.5 },
        );
      }
      break;

    case 'triangle':
      ink.stroke(T([pt(x, y - 3 * s), pt(x + 2.2 * s, y + 2.2 * s), pt(x - 2.2 * s, y + 2.2 * s)]), {
        width: 0.95,
        passes: 2,
        wobble: 0.6,
      });
      break;

    case 'button':
      ink.stroke(T(ellipsePath(x, y, 2.1 * s, 1.8 * s, Math.PI * 0.1, Math.PI * 0.9, 12)), {
        width: 1.0,
        passes: 2,
        wobble: 0.5,
      });
      ink.stroke(T([pt(x - 0.3, bridgeTop), pt(x, y - 1.9 * s)]), { width: 0.6, passes: 1, wobble: 0.5, alpha: 0.45 });
      break;

    case 'snub':
      // small, tipped up, with the nostrils showing
      ink.stroke(
        T(openCurve([pt(x - 1.9 * s, y + 1.4 * s), pt(x, y - 1.2 * s), pt(x + 1.9 * s, y + 1.4 * s)], 8)),
        { width: 1.0, passes: 2, wobble: 0.5 },
      );
      for (const side of [-1, 1]) ink.dot(...withTilt(an, x + side * 1.1 * s, y + 1.1 * s), 0.5 * s);
      break;

    case 'long':
      ink.stroke(
        T(openCurve([pt(x - 0.5, bridgeTop - 1.5), pt(x, y), pt(x + 0.4, y + 3.4 * s), pt(x - dir * 1.8 * s, y + 4 * s)], 9)),
        { width: 1.0, passes: 2, wobble: 0.6 },
      );
      break;

    case 'wide':
      ink.stroke(T(ellipsePath(x, y + 0.4 * s, 3.2 * s, 2.1 * s, Math.PI * 0.05, Math.PI * 0.95, 14)), {
        width: 1.0,
        passes: 2,
        wobble: 0.55,
      });
      for (const side of [-1, 1]) ink.dot(...withTilt(an, x + side * 2 * s, y + 1.1 * s), 0.55 * s);
      break;

    case 'bulb':
      ink.stroke(T(ellipsePath(x, y + 0.2 * s, 2.4 * s, 2.4 * s, -Math.PI * 0.15, Math.PI * 1.15, 20)), {
        width: 1.0,
        passes: 2,
        wobble: 0.6,
      });
      ink.stroke(T([pt(x - 0.4, bridgeTop), pt(x + 0.2, y - 2.2 * s)]), { width: 0.6, passes: 1, wobble: 0.5, alpha: 0.45 });
      break;

    case 'broken':
      // a bridge that changes its mind twice
      ink.stroke(
        T([
          pt(x - dir * 0.6, bridgeTop),
          pt(x + dir * 1.5 * s, y - 2.2 * s),
          pt(x - dir * 1.1 * s, y - 0.2 * s),
          pt(x + dir * 0.9 * s, y + 1.8 * s),
          pt(x - dir * 1.6 * s, y + 2.4 * s),
        ]),
        { width: 1.15, passes: 2, wobble: 0.5 },
      );
      break;

    case 'roman':
      // a straight bridge with a bump halfway down
      ink.stroke(
        T(openCurve([
          pt(x - dir * 0.4, bridgeTop),
          pt(x + dir * 1.4 * s, y - 2 * s),
          pt(x + dir * 0.9 * s, y + 0.6 * s),
          pt(x - dir * 1.4 * s, y + 2.2 * s),
        ], 9)),
        { width: 1.05, passes: 2, wobble: 0.45 },
      );
      break;

    case 'beak':
      // long, thin, and hooked well past the mouth line
      ink.stroke(
        T(openCurve([
          pt(x - dir * 0.4, bridgeTop - 1),
          pt(x + dir * 1.2 * s, y),
          pt(x + dir * 2.2 * s, y + 3.4 * s),
          pt(x - dir * 0.6 * s, y + 3.8 * s),
        ], 10)),
        { width: 1.0, passes: 2, wobble: 0.5 },
      );
      break;

    case 'tiny':
      ink.stroke(T(ellipsePath(x, y, 1.1 * s, 0.9 * s, Math.PI * 0.1, Math.PI * 0.9, 8)), {
        width: 0.9,
        passes: 2,
        wobble: 0.4,
      });
      break;

    case 'flat':
      // barely there: a wide shallow line with two nostril ticks
      ink.stroke(T([pt(x - 2.4 * s, y + 0.6 * s), pt(x + 2.4 * s, y + 0.4 * s)]), {
        width: 0.95,
        passes: 2,
        wobble: 0.5,
      });
      for (const side of [-1, 1]) {
        ink.stroke(T([pt(x + side * 1.9 * s, y + 0.5 * s), pt(x + side * 2.3 * s, y - 0.8 * s)]), {
          width: 0.65,
          passes: 1,
          wobble: 0.35,
          alpha: 0.6,
        });
      }
      break;

    case 'snout': {
      // a flat muzzle with two big nostrils
      const snout = ellipsePath(x, y + 0.4 * s, 3.4 * s, 2.4 * s, 0, Math.PI * 2, 20);
      ink.stroke(T(snout), { width: 1.05, passes: 2, wobble: 0.6, closed: true });
      for (const side of [-1, 1]) {
        ink.fill(T(ellipsePath(x + side * 1.5 * s, y + 0.4 * s, 0.85 * s, 1.25 * s, 0, Math.PI * 2, 12)), {
          alpha: 0.8,
          wobble: 0.5,
        });
      }
      break;
    }
  }

  if (nz.nostrils && nz.style !== 'wide' && nz.style !== 'snout' && nz.style !== 'snub') {
    for (const side of [-1, 1]) ink.dot(...withTilt(an, x + side * 1.9 * s, y + 1.6 * s), 0.5 * s);
  }
}

// ---------------------------------------------------------------------------
// Mouth
// ---------------------------------------------------------------------------

export function drawMouth(ink, an, g) {
  const m = g.mouth;
  const e = g.expression || 0;
  const x = an.cx + m.x * an.w + an.facing * an.turn * an.w * 0.06;
  const y = an.mouthY;
  const hw = 4.6 * m.w;
  const T = (p) => an.tiltPath(p);
  const lips = g.props.lipstick;
  const style = moodMouth(m.style, e);
  // below the substitution threshold the mood just bends the line
  const curve = clampNum(m.curve + e * 1.8, -3, 3);

  switch (style) {
    case 'line':
      ink.stroke(T(openCurve([pt(x - hw, y), pt(x, y + curve * 0.9), pt(x + hw, y - curve * 0.3)], 8)), {
        width: 1.1,
        passes: 2,
        wobble: 0.55,
      });
      break;

    case 'smile':
      ink.stroke(T(ellipsePath(x, y - 2.2, hw, 3.4, Math.PI * 0.12, Math.PI * 0.88, 16)), {
        width: 1.1,
        passes: 2,
        wobble: 0.5,
      });
      break;

    case 'frown':
      ink.stroke(T(ellipsePath(x, y + 2.4, hw, 3.0, -Math.PI * 0.88, -Math.PI * 0.12, 16)), {
        width: 1.1,
        passes: 2,
        wobble: 0.5,
      });
      break;

    case 'open': {
      const shape = closedCurve([pt(x - hw * 0.8, y - 1), pt(x, y - 2.2), pt(x + hw * 0.8, y - 1), pt(x, y + 3.4)], 9);
      ink.stroke(T(shape), { width: 1.0, passes: 2, wobble: 0.5, closed: true });
      ink.hatch(T(shape), { angle: -1.15, spacing: 1.5, width: 0.55, alpha: 0.42 });
      break;
    }

    case 'wavy':
      ink.stroke(
        T(openCurve([pt(x - hw, y - 0.8), pt(x - hw * 0.4, y + 1.2), pt(x + hw * 0.35, y - 1.3), pt(x + hw, y + 0.6)], 8)),
        { width: 1.0, passes: 2, wobble: 0.5 },
      );
      break;

    case 'smirk': {
      const dir = an.facing !== 0 ? an.facing : g.hair.part;
      ink.stroke(T(openCurve([pt(x - dir * hw, y + 1.2), pt(x, y + 0.2), pt(x + dir * hw * 0.9, y - 2.2)], 9)), {
        width: 1.1,
        passes: 2,
        wobble: 0.5,
      });
      break;
    }

    case 'teeth': {
      const box = closedCurve(
        [pt(x - hw * 0.85, y - 1.6), pt(x + hw * 0.85, y - 1.6), pt(x + hw * 0.8, y + 2.2), pt(x - hw * 0.8, y + 2.2)],
        6,
      );
      ink.stroke(T(box), { width: 1.0, passes: 2, wobble: 0.45, closed: true });
      for (let i = -1; i <= 1; i++) {
        ink.stroke(T([pt(x + i * hw * 0.42, y - 1.4), pt(x + i * hw * 0.42, y + 2)]), {
          width: 0.5,
          passes: 1,
          wobble: 0.3,
          alpha: 0.5,
        });
      }
      break;
    }

    case 'gap': {
      // teeth, one of them missing
      const box = closedCurve(
        [pt(x - hw * 0.85, y - 1.6), pt(x + hw * 0.85, y - 1.6), pt(x + hw * 0.8, y + 2.2), pt(x - hw * 0.8, y + 2.2)],
        6,
      );
      ink.stroke(T(box), { width: 1.0, passes: 2, wobble: 0.45, closed: true });
      const missing = g.hair.part;
      for (let i = -1; i <= 1; i++) {
        if (i === missing) continue;
        ink.stroke(T([pt(x + i * hw * 0.42, y - 1.4), pt(x + i * hw * 0.42, y + 2)]), {
          width: 0.5,
          passes: 1,
          wobble: 0.3,
          alpha: 0.5,
        });
      }
      const gapShape = closedCurve(
        [
          pt(x + (missing - 0.5) * hw * 0.42, y - 1.4),
          pt(x + (missing + 0.5) * hw * 0.42, y - 1.4),
          pt(x + (missing + 0.5) * hw * 0.42, y + 2),
          pt(x + (missing - 0.5) * hw * 0.42, y + 2),
        ],
        5,
      );
      ink.fill(T(gapShape), { alpha: 0.8, wobble: 0.5, edge: false });
      break;
    }

    case 'grin': {
      // a wide crescent with corner ticks and a line of teeth
      const grin = ellipsePath(x, y - 2.6, hw * 1.15, 4.4, Math.PI * 0.08, Math.PI * 0.92, 20);
      ink.stroke(T(grin), { width: 1.2, passes: 2, wobble: 0.5 });
      ink.stroke(T(ellipsePath(x, y - 2.6, hw * 1.15, 1.6, Math.PI * 0.12, Math.PI * 0.88, 14)), {
        width: 0.6,
        passes: 1,
        wobble: 0.4,
        alpha: 0.55,
      });
      for (let i = -1; i <= 1; i++) {
        const px = x + i * hw * 0.5;
        ink.stroke(T([pt(px, y - 1.4), pt(px, y + 0.6)]), { width: 0.5, passes: 1, wobble: 0.3, alpha: 0.45 });
      }
      break;
    }

    case 'tongue': {
      const shape = closedCurve([pt(x - hw * 0.9, y - 1), pt(x, y - 2.4), pt(x + hw * 0.9, y - 1), pt(x, y + 3.2)], 9);
      ink.stroke(T(shape), { width: 1.0, passes: 2, wobble: 0.5, closed: true });
      const side = g.hair.part;
      const tongue = closedCurve(
        [
          pt(x + side * hw * 0.2, y + 0.6),
          pt(x + side * hw * 0.85, y + 1.6),
          pt(x + side * hw * 0.7, y + 4.4),
          pt(x - side * hw * 0.1, y + 3.4),
        ],
        8,
      );
      ink.stroke(T(tongue), { width: 0.9, passes: 2, wobble: 0.6, closed: true });
      ink.hatch(T(tongue), { angle: -1.2, spacing: 1.6, width: 0.5, alpha: 0.35 });
      break;
    }

    case 'fangs': {
      ink.stroke(T(openCurve([pt(x - hw, y - 0.4), pt(x, y + 1), pt(x + hw, y - 0.4)], 9)), {
        width: 1.1,
        passes: 2,
        wobble: 0.5,
      });
      for (const side of [-1, 1]) {
        const fx = x + side * hw * 0.52;
        ink.fill(
          T(closedCurve([pt(fx - 1.1, y + 0.2), pt(fx + 1.1, y + 0.2), pt(fx + 0.2, y + 3.4)], 5)),
          { alpha: 0.85, wobble: 0.45 },
        );
      }
      break;
    }

    case 'zigzag': {
      const n = 6;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        pts.push(pt(x - hw + (2 * hw * i) / n, y + (i % 2 === 0 ? -1.1 : 1.1)));
      }
      ink.stroke(T(pts), { width: 1.0, passes: 2, wobble: 0.35 });
      break;
    }

    case 'buck': {
      // a thin line with two big front teeth hanging under it
      ink.stroke(T(openCurve([pt(x - hw, y - 0.4), pt(x, y + 0.4), pt(x + hw, y - 0.4)], 8)), {
        width: 1.0,
        passes: 2,
        wobble: 0.45,
      });
      for (const side of [-1, 1]) {
        const tx = x + side * hw * 0.28;
        ink.stroke(
          T(closedCurve([
            pt(tx - hw * 0.24, y + 0.2),
            pt(tx + hw * 0.24, y + 0.2),
            pt(tx + hw * 0.22, y + 3.4),
            pt(tx - hw * 0.22, y + 3.4),
          ], 5)),
          { width: 0.8, passes: 2, wobble: 0.35, closed: true },
        );
      }
      break;
    }

    case 'drool': {
      ink.stroke(T(openCurve([pt(x - hw, y - 0.6), pt(x, y + 1.4), pt(x + hw, y - 0.6)], 9)), {
        width: 1.1,
        passes: 2,
        wobble: 0.5,
      });
      const side = g.hair.part;
      ink.stroke(
        T(openCurve([pt(x + side * hw * 0.7, y + 0.8), pt(x + side * hw * 0.78, y + 3.6), pt(x + side * hw * 0.7, y + 5.4)], 8)),
        { width: 0.7, passes: 2, wobble: 0.6, alpha: 0.65 },
      );
      ink.dot(...withTilt(an, x + side * hw * 0.7, y + 5.8), 0.9, { alpha: 0.7 });
      break;
    }

    case 'stitched': {
      ink.stroke(T([pt(x - hw, y), pt(x + hw, y)]), { width: 1.0, passes: 2, wobble: 0.4 });
      for (let i = -2; i <= 2; i++) {
        const px = x + (i * hw) / 2.4;
        ink.stroke(T([pt(px, y - 1.6), pt(px, y + 1.6)]), {
          width: 0.7,
          passes: 1,
          wobble: 0.3,
          alpha: 0.8,
        });
      }
      break;
    }

    case 'dot':
      ink.dot(...withTilt(an, x, y), hw * 0.22);
      break;

    case 'o':
      ink.stroke(T(ellipsePath(x, y, hw * 0.42, hw * 0.5, 0, Math.PI * 2, 18)), {
        width: 1.0,
        passes: 2,
        wobble: 0.5,
        closed: true,
      });
      break;

    case 'pursed':
      ink.stroke(T([pt(x - hw * 0.7, y), pt(x + hw * 0.7, y)]), { width: 1.2, passes: 2, wobble: 0.5 });
      for (const side of [-1, 1]) {
        ink.stroke(T([pt(x + side * hw * 0.7, y - 1.2), pt(x + side * hw * 0.8, y + 1.2)]), {
          width: 0.6,
          passes: 1,
          wobble: 0.4,
          alpha: 0.55,
        });
      }
      break;
  }

  // A universal cue. Most mouth styles have no curve to bend and many faces
  // have no brows at all, so without this the mood barely reads: two short
  // ticks at the corners turn any mouth up or down.
  if (Math.abs(e) > 0.18) {
    const lift = e * 2.6;
    for (const side of [-1, 1]) {
      const cx2 = x + side * hw * 0.95;
      ink.stroke(
        T(openCurve([pt(cx2 - side * 1.2, y + 0.2), pt(cx2 + side * 0.9, y - lift)], 6)),
        { width: 1.0, passes: 2, wobble: 0.4, alpha: 0.8 },
      );
    }
  }

  if (lips) drawLipstick(ink, an, g, x, y, hw);
  drawTusks(ink, an, g, x, y, hw);
  void style;
}

/** A filled pair of lips over whatever mouth shape was drawn. */
function drawLipstick(ink, an, g, x, y, hw) {
  const upper = closedCurve(
    [pt(x - hw, y + 0.2), pt(x - hw * 0.45, y - 2), pt(x, y - 0.8), pt(x + hw * 0.45, y - 2), pt(x + hw, y + 0.2)],
    8,
  );
  const lower = closedCurve(
    [pt(x - hw, y + 0.2), pt(x, y + 3), pt(x + hw, y + 0.2)],
    9,
  );
  ink.fill(an.tiltPath(upper), { alpha: 0.78, wobble: 0.7, edge: false });
  ink.fill(an.tiltPath(lower), { alpha: 0.82, wobble: 0.7, edge: false });
}

/** Lower tusks, for the kin that come with them. */
function drawTusks(ink, an, g, x, y, hw) {
  const kind = g.mouth.tusks;
  if (!kind || kind === 'none') return;
  const s = g.mouth.tuskSize;
  const sides = kind === 'single' ? [g.hair.part] : [-1, 1];
  for (const side of sides) {
    const tx = x + side * hw * 0.78;
    const w = 1.3 * s;
    const hgt = 4.6 * s;
    const tusk = closedCurve(
      [
        pt(tx - w, y + 1.4),
        pt(tx + w, y + 1.2),
        pt(tx + w * 0.55 + side * 0.6, y - hgt * 0.55),
        pt(tx - side * 0.2, y - hgt),
      ],
      7,
    );
    ink.stroke(an.tiltPath(tusk), { width: 1.0, passes: 2, wobble: 0.5, closed: true });
  }
}

// ---------------------------------------------------------------------------
// Freckles, blush, wrinkles, dimples, mole, warts, chin crease
// ---------------------------------------------------------------------------

export function drawMarks(ink, an, g) {
  const mk = g.marks;
  const rng = ink.rng;

  if (mk.freckles > 0) {
    for (let i = 0; i < mk.freckles; i++) {
      const side = rng.chance(0.5) ? -1 : 1;
      const y = an.noseY + rng.range(-3, 4);
      const maxX = an.halfWidth(y) * 0.92;
      const x = side * rng.range(an.eyeGap * 0.35, maxX);
      ink.dot(...withTilt(an, x, y), rng.range(0.28, 0.5), { alpha: 0.55 });
    }
  }

  if (mk.blush) {
    for (const side of [-1, 1]) {
      const y = an.noseY + 1.5;
      const cxx = side * (an.eyeGap + 3.2);
      const region = ellipsePath(cxx, y, 4.2, 2.6, 0, Math.PI * 2, 18);
      ink.hatch(an.tiltPath(region), { angle: -0.9, spacing: 1.5, width: 0.45, alpha: 0.3, jitter: 0.7 });
    }
  }

  if (mk.wrinkles > 0) {
    for (let i = 0; i < mk.wrinkles; i++) {
      const y = an.browY - 3 - i * 2.4;
      const hw = an.halfWidth(y) * 0.62;
      ink.stroke(an.tiltPath(openCurve([pt(-hw, y + 0.5), pt(0, y - 0.7), pt(hw, y + 0.4)], 7)), {
        width: 0.5,
        passes: 1,
        wobble: 0.5,
        alpha: 0.38,
      });
    }
  }

  if (mk.dimples) {
    for (const side of [-1, 1]) {
      const y = an.mouthY - 0.5;
      const x = side * (4.6 * g.mouth.w + 2);
      ink.stroke(
        an.tiltPath(ellipsePath(x, y, 1.4, 2.4, side > 0 ? -2.2 : Math.PI + 2.2, side > 0 ? 0.2 : Math.PI - 0.2, 8)),
        { width: 0.55, passes: 1, wobble: 0.4, alpha: 0.45 },
      );
    }
  }

  if (mk.mole) {
    const side = rng.chance(0.5) ? -1 : 1;
    const y = an.mouthY - rng.range(0, 6);
    ink.dot(...withTilt(an, side * (an.eyeGap + rng.range(2, 6)), y), 0.7, { alpha: 0.8 });
  }

  if (mk.warts > 0) {
    for (let i = 0; i < mk.warts; i++) {
      const side = rng.chance(0.5) ? -1 : 1;
      const y = an.noseY + rng.range(-6, 8);
      const x = side * rng.range(an.eyeGap * 0.4, an.halfWidth(y) * 0.85);
      const r = rng.range(0.9, 1.7);
      ink.stroke(an.tiltPath(ellipsePath(x, y, r, r * 0.9, 0, Math.PI * 2, 10)), {
        width: 0.7,
        passes: 1,
        wobble: 0.6,
        closed: true,
        alpha: 0.7,
      });
      if (rng.chance(0.5)) ink.dot(...withTilt(an, x, y), 0.35, { alpha: 0.6 });
    }
  }

  if (mk.chinLine) {
    const y = an.yAt(0.9);
    ink.stroke(an.tiltPath(ellipsePath(0, y - 2.4, 2.6, 2.6, Math.PI * 0.2, Math.PI * 0.8, 10)), {
      width: 0.55,
      passes: 1,
      wobble: 0.45,
      alpha: 0.4,
    });
  }
}

// ---------------------------------------------------------------------------
// Props — the things that make a face a character rather than a head
// ---------------------------------------------------------------------------

/** Drawn after the eyes, before the glasses. */
export function drawProps(ink, an, g) {
  const p = g.props;
  if (!p) return;

  if (p.eyeliner) drawEyeliner(ink, an, g);
  if (p.eyepatch) drawEyepatch(ink, an, g);
  if (p.earring) drawEarring(ink, an, g);
  if (p.nosePiercing) drawNosePiercing(ink, an, g);
  if (p.tattoo) drawTattoo(ink, an, g);
  if (p.scar) drawScar(ink, an, g);
  if (p.cigarette) drawCigarette(ink, an, g);
}

function drawEyeliner(ink, an, g) {
  for (const side of [-1, 1]) {
    const leading = an.facing !== 0 && side === an.facing;
    const size = g.eyes.size * (side < 0 ? 1 : 1 + g.eyes.asym);
    const rx = 3.5 * size * (leading ? 1 - an.turn * 0.45 : 1);
    const ry = 2.6 * size;
    const x = side * an.eyeGap;
    const y = an.eyeY + (side < 0 ? 0 : g.eyes.heightAsym);
    ink.stroke(an.tiltPath(ellipsePath(x, y, rx * 1.08, ry * 1.08, -Math.PI * 0.95, -Math.PI * 0.05, 14)), {
      width: 1.7,
      passes: 2,
      wobble: 0.4,
      alpha: 0.9,
    });
    // the wing
    ink.stroke(
      an.tiltPath([pt(x + side * rx * 1.02, y - ry * 0.25), pt(x + side * rx * 1.75, y - ry * 1.05)]),
      { width: 1.3, passes: 2, wobble: 0.35, alpha: 0.85 },
    );
  }
}

function drawEyepatch(ink, an, g) {
  const side = g.props.eyepatchSide;
  const x = side * an.eyeGap;
  const y = an.eyeY;
  const patch = closedCurve(
    [pt(x - 4.6, y - 3.4), pt(x + 4.6, y - 3.2), pt(x + 4.2, y + 3.6), pt(x - 4.4, y + 3.4)],
    8,
  );
  ink.fill(an.tiltPath(patch), { alpha: 0.92, wobble: 0.8 });
  // strap over the skull, disappearing behind the head on both sides
  const yTop = an.browY - 4;
  ink.stroke(
    an.tiltPath(openCurve([
      pt(-an.halfWidth(yTop) * 1.02, yTop - 1.5),
      pt(x * 0.4, y - 4.4),
      pt(an.halfWidth(y) * 1.02, y + 1),
    ], 9)),
    { width: 0.9, passes: 2, wobble: 0.7, alpha: 0.75 },
  );
}

function drawEarring(ink, an, g) {
  const side = g.props.earringSide;
  // hangs off the near ear when the head is turned, so it stays visible
  const s = an.facing !== 0 ? -an.facing : side;
  const y = an.earY + 3.2;
  const x = s * (an.halfWidth(y) + 0.4);
  if (g.props.earringStyle === 'hoop') {
    ink.stroke(an.tiltPath(ellipsePath(x, y + 1.8, 1.9, 2.2, 0, Math.PI * 2, 16)), {
      width: 0.8,
      passes: 2,
      wobble: 0.5,
      closed: true,
    });
  } else {
    ink.dot(...withTilt(an, x, y), 1.1, { alpha: 0.9 });
  }
}

function drawNosePiercing(ink, an, g) {
  const s = g.nose.size;
  const x = an.cx + g.nose.x * an.w + an.facing * an.turn * an.w * 0.12;
  const y = an.noseY;
  if (ink.rng.chance(0.5)) {
    // septum ring
    ink.stroke(an.tiltPath(ellipsePath(x, y + 2.4 * s, 1.6, 1.4, 0.15, Math.PI - 0.15, 12)), {
      width: 0.75,
      passes: 2,
      wobble: 0.45,
    });
  } else {
    ink.dot(...withTilt(an, x + 2 * s * g.hair.part, y + 1.2 * s), 0.6, { alpha: 0.9 });
  }
}

function drawTattoo(ink, an, g) {
  const side = g.props.tattooSide;
  const y = an.eyeY + 4;
  const x = side * (an.eyeGap + 5);
  const rng = ink.rng;
  const kind = rng.int(0, 2);
  if (kind === 0) {
    // three short bars
    for (let i = 0; i < 3; i++) {
      ink.stroke(an.tiltPath([pt(x - 1.6 + i * 1.6, y - 2), pt(x - 2.4 + i * 1.6, y + 2)]), {
        width: 1.0,
        passes: 2,
        wobble: 0.4,
        alpha: 0.75,
      });
    }
  } else if (kind === 1) {
    // a small solid triangle
    ink.fill(an.tiltPath(closedCurve([pt(x, y - 2.6), pt(x + 2.3, y + 1.6), pt(x - 2.3, y + 1.6)], 5)), {
      alpha: 0.8,
      wobble: 0.5,
    });
  } else {
    // a teardrop under the eye
    ink.fill(an.tiltPath(closedCurve([pt(x, y - 2.2), pt(x + 1.3, y + 0.6), pt(x, y + 1.8), pt(x - 1.3, y + 0.6)], 6)), {
      alpha: 0.8,
      wobble: 0.5,
    });
  }
}

function drawScar(ink, an, g) {
  const side = g.props.scarSide;
  const x = side * (an.eyeGap + 1);
  const yA = an.browY - 3;
  const yB = an.eyeY + 4.5;
  ink.stroke(an.tiltPath(openCurve([pt(x - 0.8, yA), pt(x + 0.6, (yA + yB) / 2), pt(x - 0.4, yB)], 8)), {
    width: 1.0,
    passes: 2,
    wobble: 0.4,
  });
  for (let i = 0; i < 3; i++) {
    const t = 0.22 + i * 0.28;
    const y = yA + (yB - yA) * t;
    ink.stroke(an.tiltPath([pt(x - 1.7, y - 0.4), pt(x + 1.7, y + 0.4)]), {
      width: 0.6,
      passes: 1,
      wobble: 0.3,
      alpha: 0.6,
    });
  }
}

function drawCigarette(ink, an, g) {
  const side = g.props.cigaretteSide;
  const x = an.cx + side * 4.6 * g.mouth.w * 0.8;
  const y = an.mouthY + 0.6;
  const len = 9;
  const tip = pt(x + side * len, y + 2.2);
  ink.stroke(an.tiltPath([pt(x, y), tip]), { width: 1.6, passes: 2, wobble: 0.3 });
  ink.dot(...withTilt(an, tip.x, tip.y), 0.9, { alpha: 0.85 });
  // a curl of smoke
  const smoke = openCurve(
    [tip, pt(tip.x + side * 2, tip.y - 4), pt(tip.x - side * 1.5, tip.y - 8), pt(tip.x + side * 2.5, tip.y - 12)],
    8,
  );
  ink.stroke(an.tiltPath(smoke), { width: 0.5, passes: 1, wobble: 1.1, alpha: 0.35 });
}

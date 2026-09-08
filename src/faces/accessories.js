/**
 * Glasses and hats. Drawn on top of the face, so they read as objects sitting
 * in front of it rather than as part of the skull.
 */

import { closedCurve, ellipsePath, openCurve, pt } from './ink.js?v=e1ff722724';

// ---------------------------------------------------------------------------
// Glasses
// ---------------------------------------------------------------------------

/**
 * The lens outlines, already tilted. Shared with the colour wash so a tinted
 * lens lines up with the frame that holds it.
 */
export function lensRegions(an, g) {
  const gl = g.glasses;
  if (gl.style === 'none') return [];
  const s = gl.size;
  const y = an.eyeY;
  const gap = an.eyeGap;

  if (gl.style === 'monocle') {
    const r = 4.6 * s;
    return [an.tiltPath(ellipsePath(gl.side * gap, y, r, r, 0, Math.PI * 2, 24))];
  }

  const lensW = (gl.style === 'sunglasses' || gl.style === 'aviator' ? 4.6 : gl.style === 'goggles' ? 5 : 4.1) * s;
  const lensH = (gl.style === 'sunglasses' ? 3.4 : gl.style === 'goggles' ? 4.2 : gl.style === 'pince' ? 2.8 : 3.5) * s;
  const out = [];
  for (const side of [-1, 1]) {
    const x = side * gap;
    if (gl.style === 'aviator') {
      // teardrop: wide and flat on top, tapering to a point at the outer base
      out.push(closedCurve([
        pt(x - lensW, y - lensH * 0.85),
        pt(x + lensW, y - lensH * 0.9),
        pt(x + side * lensW * 0.55, y + lensH * 1.15),
        pt(x - side * lensW * 0.75, y + lensH * 0.7),
      ], 9));
    } else if (gl.style === 'cateye') {
      // the outer top corner flicks up
      out.push(closedCurve([
        pt(x - side * lensW, y - lensH * 0.4),
        pt(x + side * lensW * 0.5, y - lensH * 1.5),
        pt(x + side * lensW, y - lensH * 0.5),
        pt(x + side * lensW * 0.75, y + lensH),
        pt(x - side * lensW * 0.85, y + lensH * 0.8),
      ], 9));
    } else if (gl.style === 'goggles') {
      out.push(closedCurve([
        pt(x - lensW * 0.9, y - lensH * 0.8),
        pt(x + lensW * 0.9, y - lensH * 0.8),
        pt(x + lensW, y + lensH * 0.5),
        pt(x, y + lensH),
        pt(x - lensW, y + lensH * 0.5),
      ], 10));
    } else if (gl.style === 'pince') {
      out.push(ellipsePath(x, y, lensW * 0.82, lensH, 0, Math.PI * 2, 20));
    } else if (gl.style === 'square') {
      out.push(closedCurve(
        [pt(x - lensW, y - lensH), pt(x + lensW, y - lensH), pt(x + lensW, y + lensH), pt(x - lensW, y + lensH)],
        7,
      ));
    } else if (gl.style === 'sunglasses') {
      out.push(closedCurve(
        [
          pt(x - lensW * (side < 0 ? 1.05 : 0.9), y - lensH * 0.95),
          pt(x + lensW * (side < 0 ? 0.9 : 1.05), y - lensH * 0.9),
          pt(x + lensW * (side < 0 ? 0.75 : 1.0), y + lensH * 0.9),
          pt(x - lensW * (side < 0 ? 1.0 : 0.75), y + lensH * 1.0),
        ],
        9,
      ));
    } else {
      out.push(ellipsePath(x, y, lensW, lensH, 0, Math.PI * 2, 24));
    }
  }
  return out.map((p) => an.tiltPath(p));
}

export function drawGlasses(ink, an, g) {
  const gl = g.glasses;
  if (gl.style === 'none') return;
  const s = gl.size;
  const th = gl.thickness;
  const y = an.eyeY;
  const gap = an.eyeGap;
  const T = (p) => an.tiltPath(p);

  if (gl.style === 'monocle') {
    const side = gl.side;
    const x = side * gap;
    const r = 4.6 * s;
    ink.outline(T(ellipsePath(x, y, r, r, 0, Math.PI * 2, 24)), { width: 1.3 * th, passes: 2, wobble: 0.55 });
    // cord dangling off towards the jaw
    ink.stroke(
      T(openCurve([pt(x + side * r, y + r * 0.4), pt(x + side * (r + 3), y + 8), pt(x + side * (r + 1), y + 16)], 8)),
      { width: 0.55, passes: 1, wobble: 0.9, alpha: 0.5 },
    );
    return;
  }

  const lensW = (gl.style === 'sunglasses' ? 4.6 : 4.1) * s;
  const lensH = (gl.style === 'sunglasses' ? 3.4 : 3.5) * s;

  for (const side of [-1, 1]) {
    const x = side * gap;
    let lens;
    if (gl.style === 'square') {
      lens = closedCurve(
        [pt(x - lensW, y - lensH), pt(x + lensW, y - lensH), pt(x + lensW, y + lensH), pt(x - lensW, y + lensH)],
        7,
      );
    } else if (gl.style === 'sunglasses') {
      // the reference's aviator blobs: wider at the outer corner
      lens = closedCurve(
        [
          pt(x - lensW * (side < 0 ? 1.05 : 0.9), y - lensH * 0.95),
          pt(x + lensW * (side < 0 ? 0.9 : 1.05), y - lensH * 0.9),
          pt(x + lensW * (side < 0 ? 0.75 : 1.0), y + lensH * 0.9),
          pt(x - lensW * (side < 0 ? 1.0 : 0.75), y + lensH * 1.0),
        ],
        9,
      );
    } else {
      lens = ellipsePath(x, y, lensW, lensH, 0, Math.PI * 2, 24);
    }

    if (gl.style === 'sunglasses' || gl.style === 'aviator') {
      ink.fill(T(lens), { alpha: 0.88, wobble: 0.8 });
    } else if (gl.style === 'goggles') {
      ink.outline(T(lens), { width: 1.9 * th, passes: 2, wobble: 0.5 });
      // a glint across the glass
      ink.stroke(T([pt(x - lensW * 0.5, y + lensH * 0.3), pt(x + lensW * 0.2, y - lensH * 0.45)]), {
        width: 0.8,
        passes: 1,
        wobble: 0.3,
        alpha: 0.45,
      });
    } else if (gl.style === 'halfRim') {
      const half = ellipsePath(x, y, lensW, lensH, 0, Math.PI, 14);
      ink.stroke(T(half), { width: 1.2 * th, passes: 2, wobble: 0.5 });
      ink.stroke(T([pt(x - lensW, y), pt(x + lensW, y)]), { width: 1.0 * th, passes: 2, wobble: 0.4 });
    } else {
      ink.outline(T(lens), { width: 1.25 * th, passes: 2, wobble: 0.5 });
    }

    if (gl.style === 'pince') continue; // pince-nez has no arms at all
    // arm running back towards the ear
    const yb = y - lensH * 0.25;
    const outer = x + side * lensW;
    const earX = side * (an.halfWidth(an.earY) + 1);
    ink.stroke(T(openCurve([pt(outer, yb), pt((outer + earX) / 2, yb - 1.2), pt(earX, an.earY - 1)], 7)), {
      width: 0.85 * th,
      passes: 2,
      wobble: 0.6,
      alpha: 0.75,
    });
  }

  if (gl.style === 'goggles') {
    // a band right round the skull rather than two arms
    const yb = y - lensH * 0.2;
    for (const side of [-1, 1]) {
      ink.stroke(
        T(openCurve([
          pt(side * (gap + lensW * 0.9), yb),
          pt(side * an.halfWidth(yb) * 1.04, yb - 1.4),
        ], 6)),
        { width: 2.1 * th, passes: 2, wobble: 0.5, alpha: 0.8 },
      );
    }
  }

  // bridge
  const bridgeY = y - (gl.style === 'sunglasses' || gl.style === 'aviator' ? 2.2 : 0.6);
  ink.stroke(T(openCurve([pt(-gap + lensW * 0.85, bridgeY), pt(0, bridgeY - 1.4), pt(gap - lensW * 0.85, bridgeY)], 7)), {
    width: 1.0 * th,
    passes: 2,
    wobble: 0.5,
  });
}

// ---------------------------------------------------------------------------
// Hats
// ---------------------------------------------------------------------------

const BRIM_T = 0.24; // where a hat meets the head

/** A dome that follows the skull, from its own top down to the brim line. */
function domePath(an, growX, growY, yBrim, steps = 22) {
  const yTop = an.cy - an.h * (1 + growY);
  const right = [];
  const left = [];
  for (let i = 0; i <= steps; i++) {
    const y = yTop + ((yBrim - yTop) * i) / steps;
    const hw = an.halfWidth(y, growX, growY);
    right.push(pt(hw, y));
    left.push(pt(-hw, y));
  }
  return [...right, ...left.reverse()];
}

/** A horizontal band hugging the skull between two heights. */
function bandPath(an, tA, tB, growX = 0.03, growY = 0.02, steps = 14) {
  const yA = an.yAt(tA);
  const yB = an.yAt(tB);
  const right = [];
  const left = [];
  for (let i = 0; i <= steps; i++) {
    const y = yA + ((yB - yA) * i) / steps;
    right.push(pt(an.halfWidth(y, growX, growY), y));
    left.push(pt(-an.halfWidth(y, growX, growY), y));
  }
  return [...right, ...left.reverse()];
}

/**
 * The hat's main mass, already tilted — what a colour wash should sit under.
 * Trim (bands, visors, bobbles) is left to drawHat.
 */
export function hatRegions(an, g) {
  const hat = g.hat;
  if (hat.style === 'none') return [];
  const yBrim = an.yAt(BRIM_T);

  switch (hat.style) {
    case 'beanie':
      return [an.tiltPath(domePath(an, 0.06, 0.2 * hat.height, yBrim))];
    case 'cap':
      return [an.tiltPath(domePath(an, 0.05, 0.17 * hat.height, yBrim, 20))];
    case 'bandana':
      return [an.tiltPath(bandPath(an, 0.2, 0.36))];
    case 'headband':
      return [an.tiltPath(bandPath(an, 0.24, 0.32))];
    case 'tophat': {
      const hwTop = an.w * 0.72;
      const yTop = an.cy - an.h * (1 + 0.62 * hat.height);
      return [an.tiltPath(closedCurve(
        [pt(-hwTop, yTop), pt(hwTop, yTop), pt(hwTop * 1.06, yBrim - 1), pt(-hwTop * 1.06, yBrim - 1)],
        8,
      ))];
    }
    case 'beret':
      return [an.tiltPath(beretShape(an, g))];
    case 'flatCap':
      return [an.tiltPath(flatCapShape(an, g))];
    case 'hood':
      return [an.tiltPath(hoodShape(an, g))];
    case 'fez':
      return [an.tiltPath(fezShape(an, g))];
    case 'crown':
      return [an.tiltPath(crownShape(an, g))];
    case 'helmet':
      return [an.tiltPath(helmetShape(an, g))];
    case 'cowboy':
      return [an.tiltPath(cowboyShape(an, g))];
    case 'wizard':
      return [an.tiltPath(wizardShape(an, g))];
    case 'nightcap':
      return [an.tiltPath(nightcapShape(an, g))];
    default:
      return [];
  }
}

/**
 * Slump a dome to one side: the higher up a point is, the further it slides.
 * That single shear is what turns a plain cap into a beret.
 */
function slump(path, an, yBrim, yTop, amount, dir) {
  const span = yBrim - yTop || 1;
  return path.map((p) => {
    const t = Math.max(0, Math.min(1, (yBrim - p.y) / span));
    return pt(p.x + dir * t * t * an.w * amount, p.y);
  });
}

/** A soft disc slumped to one side, with a little stalk on top. */
function beretShape(an, g) {
  const dir = g.hair.part;
  const yBrim = an.yAt(0.22);
  const grow = 0.13 * g.hat.height;
  const yTop = an.cy - an.h * (1 + grow);
  return slump(domePath(an, 0.05, grow, yBrim, 20), an, yBrim, yTop, 0.4, dir);
}

/** Newsboy cap: a low dome pulled forward, with a short stiff peak. */
function flatCapShape(an, g) {
  const dir = g.hair.part;
  const yBrim = an.yAt(0.27);
  const grow = 0.07 * g.hat.height;
  const yTop = an.cy - an.h * (1 + grow);
  return slump(domePath(an, 0.05, grow, yBrim, 20), an, yBrim, yTop, 0.22, dir);
}

/** The short stiff peak that sticks out of a flat cap. */
function flatCapPeak(an, g) {
  const dir = g.hair.part;
  const yBrim = an.yAt(0.27);
  const hw = an.halfWidth(yBrim, 0.05, 0.03);
  return closedCurve(
    [
      pt(dir * hw * 0.12, yBrim - 0.5),
      pt(dir * hw * 1.02, yBrim + 0.6),
      pt(dir * hw * 0.95, yBrim + 3.2),
      pt(dir * hw * 0.12, yBrim + 2.6),
    ],
    8,
  );
}

/**
 * A hood is a ring, built exactly like a hair shell: cloth arching clear of
 * the skull on the outside, the skull itself on the inside, and an opening
 * cut across the forehead. Built as one continuous ring so it can never
 * self-intersect.
 */
function hoodShape(an, g) {
  const growX = 0.13;
  const growY = 0.17 * g.hat.height;
  const yTop = an.cy - an.h * (1 + growY);
  const ySide = an.yAt(0.9);
  const yFace = an.yAt(0.28);

  const steps = 20;
  const outerR = [];
  const outerL = [];
  for (let i = 0; i <= steps; i++) {
    const y = yTop + ((ySide - yTop) * i) / steps;
    const hw = an.halfWidth(y, growX, growY);
    outerR.push(pt(hw, y));
    outerL.push(pt(-hw, y));
  }

  const inner = 12;
  const innerR = [];
  const innerL = [];
  for (let i = 0; i <= inner; i++) {
    const y = ySide + ((yFace - ySide) * i) / inner;
    const hw = an.halfWidth(y) * 1.0;
    innerR.push(pt(hw, y));
    innerL.push(pt(-hw, y));
  }

  const hwFace = an.halfWidth(yFace);
  const brow = openCurve(
    [pt(hwFace, yFace), pt(hwFace * 0.5, yFace + an.h * 0.05), pt(0, yFace + an.h * 0.07), pt(-hwFace * 0.5, yFace + an.h * 0.05), pt(-hwFace, yFace)],
    7,
  );

  return [...outerR, ...innerR, ...brow, ...innerL.reverse(), ...outerL.reverse()];
}

/** A short truncated cone with a tassel. */
function fezShape(an, g) {
  const yBrim = an.yAt(0.22);
  const hw = an.halfWidth(yBrim, 0.02, 0.02);
  const yTop = an.cy - an.h * (1 + 0.34 * g.hat.height);
  return closedCurve(
    [pt(-hw * 0.78, yTop), pt(hw * 0.78, yTop), pt(hw * 1.02, yBrim), pt(-hw * 1.02, yBrim)],
    8,
  );
}

/** Points, because somebody has to be in charge. */
function crownShape(an, g) {
  const yBase = an.yAt(0.24);
  const hw = an.halfWidth(yBase, 0.04, 0.02);
  const h = an.h * 0.32 * g.hat.height;
  const pts = [pt(-hw, yBase), pt(-hw, yBase - h * 0.45)];
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4;
    const t1 = (i + 0.5) / 4;
    pts.push(pt(-hw + 2 * hw * t0, yBase - h * 0.45));
    pts.push(pt(-hw + 2 * hw * t1, yBase - h));
  }
  pts.push(pt(hw, yBase - h * 0.45));
  pts.push(pt(hw, yBase));
  return pts;
}

/** A rounded helm with a nose guard. */
function helmetShape(an, g) {
  const yBrim = an.yAt(0.34);
  return domePath(an, 0.08, 0.1 * g.hat.height, yBrim, 22);
}

/** A wide brim with a tall rounded crown. */
function cowboyShape(an, g) {
  const yBrim = an.yAt(0.26);
  return domePath(an, 0.04, 0.2 * g.hat.height, yBrim, 20);
}

/** A tall cone leaning to one side. */
function wizardShape(an, g) {
  const dir = g.hair.part;
  const yBrim = an.yAt(0.24);
  const hw = an.halfWidth(yBrim, 0.12, 0.02);
  const tipY = an.cy - an.h * (1 + 1.25 * g.hat.height);
  return closedCurve(
    [
      pt(-hw, yBrim),
      pt(-hw * 0.3 + dir * hw * 0.5, (yBrim + tipY) / 2),
      pt(dir * hw * 1.3, tipY),
      pt(hw * 0.35 + dir * hw * 0.5, (yBrim + tipY) / 2),
      pt(hw, yBrim),
    ],
    10,
  );
}

/** A floppy cone flopping over, with a pompom on the end. */
function nightcapShape(an, g) {
  const dir = g.hair.part;
  const yBrim = an.yAt(0.24);
  const hw = an.halfWidth(yBrim, 0.05, 0.02);
  const topY = an.cy - an.h * (1 + 0.34 * g.hat.height);
  return closedCurve(
    [
      pt(-hw, yBrim),
      pt(-hw * 0.8, topY + 3),
      pt(dir * hw * 0.6, topY),
      pt(dir * hw * 1.75, topY + an.h * 0.34),
      pt(dir * hw * 1.35, topY + an.h * 0.44),
      pt(dir * hw * 0.2, topY + 6),
      pt(hw, yBrim),
    ],
    9,
  );
}

export function drawHat(ink, an, g) {
  const hat = g.hat;
  if (hat.style === 'none') return;
  const T = (p) => an.tiltPath(p);
  const paint = (path, o = {}) => {
    if (hat.tone === 'dark') {
      ink.fill(path, { alpha: 0.86, wobble: 0.8, edge: false });
      ink.hatch(path, { angle: o.angle ?? -Math.PI / 2, spacing: 2.8, width: 0.55, alpha: 0.26 });
    } else if (hat.tone === 'mid') {
      ink.hatch(path, { angle: o.angle ?? -Math.PI / 2, spacing: 1.35, width: 0.72, alpha: 0.7, jitter: 0.5 });
    } else {
      ink.hatch(path, { angle: o.angle ?? -Math.PI / 2, spacing: 2.4, width: 0.6, alpha: 0.45, jitter: 0.7 });
    }
    ink.outline(path, { width: 0.95, passes: 2, wobble: 0.6, alpha: 0.8 });
  };

  const yBrim = an.yAt(BRIM_T);
  const hwBrim = an.halfWidth(yBrim, 0.06, 0.04);

  if (hat.style === 'beanie') {
    const yTop = an.cy - an.h * (1 + 0.2 * hat.height);
    paint(T(domePath(an, 0.06, 0.2 * hat.height, yBrim)));

    // folded band
    const band = closedCurve(
      [pt(-hwBrim * 1.04, yBrim - 2.6), pt(hwBrim * 1.04, yBrim - 2.6), pt(hwBrim * 1.02, yBrim + 1.6), pt(-hwBrim * 1.02, yBrim + 1.6)],
      7,
    );
    ink.fill(T(band), { alpha: hat.tone === 'light' ? 0.5 : 0.9, wobble: 0.7 });

    // bobble
    const bx = an.cx + (ink.rng.chance(0.5) ? 1.5 : -1.5);
    const by = yTop - 2.4;
    const pom = ellipsePath(bx, by, 2.2, 2.0, 0, Math.PI * 2, 14);
    ink.fill(T(pom), { alpha: 0.85, wobble: 0.9 });
    return;
  }

  if (hat.style === 'cap') {
    const yTop = an.cy - an.h * (1 + 0.17 * hat.height);
    paint(T(domePath(an, 0.05, 0.17 * hat.height, yBrim, 20)), { angle: -1.2 });

    const dir = g.hair.part;
    // A bill that reaches out sideways and dips a little, rather than a slab
    // straight across the face.
    const visor = closedCurve(
      [
        pt(dir * hwBrim * 0.05, yBrim - 3.2),
        pt(dir * hwBrim * 0.9, yBrim - 3.6),
        pt(dir * hwBrim * 1.22, yBrim - 2.2),
        pt(dir * hwBrim * 1.12, yBrim - 0.5),
        pt(dir * hwBrim * 0.05, yBrim - 0.6),
      ],
      8,
    );
    if (hat.tone === 'dark') ink.fill(T(visor), { alpha: 0.85, wobble: 0.7 });
    else {
      ink.hatch(T(visor), { angle: 0.1, spacing: 1.3, width: 0.65, alpha: 0.6 });
      ink.outline(T(visor), { width: 0.95, passes: 2, wobble: 0.6 });
    }
    // button on top
    ink.dot(...tiltXY(an, an.cx, yTop + 0.6), 1.0);
    return;
  }

  if (hat.style === 'bandana') {
    const yA = an.yAt(0.2);
    const yB = an.yAt(0.36);
    paint(T(bandPath(an, 0.2, 0.36)), { angle: 0.15 });

    // knot + tails on one side
    const side = g.hair.part;
    const kx = side * an.halfWidth(yB, 0.03, 0.02);
    const knot = ellipsePath(kx, (yA + yB) / 2, 2.2, 2.0, 0, Math.PI * 2, 14);
    ink.fill(T(knot), { alpha: 0.8, wobble: 0.8 });
    for (let i = 0; i < 2; i++) {
      const tail = openCurve(
        [pt(kx, (yA + yB) / 2), pt(kx + side * 4, (yA + yB) / 2 + 3 + i * 3), pt(kx + side * 2.5, (yA + yB) / 2 + 8 + i * 4)],
        7,
      );
      ink.stroke(T(tail), { width: 0.9, passes: 2, wobble: 0.8, alpha: 0.7 });
    }
    return;
  }

  if (hat.style === 'headband') {
    const band = bandPath(an, 0.24, 0.32);
    if (hat.tone === 'dark') ink.fill(T(band), { alpha: 0.85, wobble: 0.6 });
    else paint(T(band), { angle: 0.1 });
    return;
  }

  if (hat.style === 'beret') {
    const shape = beretShape(an, g);
    paint(T(shape), { angle: -0.6 });
    // the stalk, on the crown of the slumped disc
    const crown = shape.reduce((acc, p) => (p.y < acc.y ? p : acc), shape[0]);
    ink.stroke(T([pt(crown.x, crown.y + 0.5), pt(crown.x + g.hair.part * 0.8, crown.y - 2.4)]), {
      width: 1.4,
      passes: 2,
      wobble: 0.5,
    });
    return;
  }

  if (hat.style === 'flatCap') {
    const peak = flatCapPeak(an, g);
    if (hat.tone === 'dark') ink.fill(T(peak), { alpha: 0.85, wobble: 0.6 });
    else {
      ink.hatch(T(peak), { angle: 0.1, spacing: 1.3, width: 0.6, alpha: 0.55 });
      ink.outline(T(peak), { width: 0.9, passes: 2, wobble: 0.55 });
    }
    paint(T(flatCapShape(an, g)), { angle: -0.9 });
    return;
  }

  if (hat.style === 'hood') {
    const shape = hoodShape(an, g);
    paint(T(shape), { angle: -1.25 });
    // folds falling from the opening
    for (let i = 0; i < 3; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const yA = an.yAt(0.36 + i * 0.07);
      const yB = an.yAt(0.78);
      const x = side * an.halfWidth(yA) * (1.06 + i * 0.05);
      ink.stroke(
        T(openCurve([pt(x, yA), pt(x + side * 2, (yA + yB) / 2), pt(x + side * 0.6, yB)], 8)),
        { width: 0.6, passes: 1, wobble: 0.7, alpha: 0.45 },
      );
    }
    return;
  }

  if (hat.style === 'fez') {
    paint(T(fezShape(an, g)), { angle: -1.4 });
    const top = an.yAt(0.22) - an.h * (1 + 0.34 * hat.height) + an.cy - an.yAt(0.22) + 0;
    const yTop = an.cy - an.h * (1 + 0.34 * hat.height);
    const dir = g.hair.part;
    ink.stroke(T(openCurve([pt(0, yTop), pt(dir * 4, yTop + 2), pt(dir * 6, yTop + 9)], 8)), {
      width: 0.8,
      passes: 2,
      wobble: 0.8,
      alpha: 0.75,
    });
    ink.dot(...tiltXY(an, dir * 6, yTop + 10.5), 1.4);
    void top;
    return;
  }

  if (hat.style === 'crown') {
    const shape = crownShape(an, g);
    paint(T(shape), { angle: -1.3 });
    // a jewel on each point
    const yBase = an.yAt(0.24);
    const hw = an.halfWidth(yBase, 0.04, 0.02);
    const hh = an.h * 0.32 * hat.height;
    for (let i = 0; i < 4; i++) {
      const x = -hw + 2 * hw * ((i + 0.5) / 4);
      ink.dot(...tiltXY(an, x, yBase - hh - 0.6), 1.1);
    }
    return;
  }

  if (hat.style === 'helmet') {
    paint(T(helmetShape(an, g)), { angle: -1.3 });
    // nose guard down the middle of the face
    const yA = an.yAt(0.34);
    ink.stroke(
      T(closedCurve([
        pt(-1.7, yA - 1),
        pt(1.7, yA - 1),
        pt(1.3, an.noseY - 1),
        pt(-1.3, an.noseY - 1),
      ], 6)),
      { width: 1.0, passes: 2, wobble: 0.5, closed: true },
    );
    return;
  }

  if (hat.style === 'cowboy') {
    paint(T(cowboyShape(an, g)), { angle: -1.2 });
    // the brim, sweeping wide and curling up at the ends
    const yBrim = an.yAt(0.26);
    const hw = an.halfWidth(yBrim, 0.04, 0.04);
    const brim = closedCurve(
      [
        pt(-hw * 1.85, yBrim - 2.6),
        pt(0, yBrim + 1.4),
        pt(hw * 1.85, yBrim - 2.6),
        pt(hw * 1.7, yBrim + 0.6),
        pt(0, yBrim + 4),
        pt(-hw * 1.7, yBrim + 0.6),
      ],
      9,
    );
    if (hat.tone === 'dark') ink.fill(T(brim), { alpha: 0.86, wobble: 0.7 });
    else {
      ink.hatch(T(brim), { angle: 0.1, spacing: 1.5, width: 0.6, alpha: 0.5 });
      ink.outline(T(brim), { width: 1.0, passes: 2, wobble: 0.6 });
    }
    return;
  }

  if (hat.style === 'wizard') {
    paint(T(wizardShape(an, g)), { angle: -1.1 });
    const yBrim = an.yAt(0.24);
    const hw = an.halfWidth(yBrim, 0.12, 0.02);
    const brim = closedCurve(
      [pt(-hw * 1.35, yBrim - 1.5), pt(hw * 1.35, yBrim - 1.5), pt(hw * 1.25, yBrim + 2.2), pt(-hw * 1.25, yBrim + 2.2)],
      8,
    );
    if (hat.tone === 'dark') ink.fill(T(brim), { alpha: 0.85, wobble: 0.7 });
    else {
      ink.hatch(T(brim), { angle: 0.1, spacing: 1.5, width: 0.6, alpha: 0.5 });
      ink.outline(T(brim), { width: 1.0, passes: 2, wobble: 0.6 });
    }
    return;
  }

  if (hat.style === 'nightcap') {
    const shape = nightcapShape(an, g);
    paint(T(shape), { angle: -1.2 });
    const dir = g.hair.part;
    const topY = an.cy - an.h * (1 + 0.34 * hat.height);
    const hw = an.halfWidth(an.yAt(0.24), 0.05, 0.02);
    const pom = ellipsePath(dir * hw * 1.6, topY + an.h * 0.4, 3, 2.8, 0, Math.PI * 2, 16);
    ink.fill(T(pom), { alpha: 0.85, wobble: 0.9 });
    return;
  }

  if (hat.style === 'tophat') {
    const hwTop = an.w * 0.72;
    const yTop = an.cy - an.h * (1 + 0.62 * hat.height);
    const crown = closedCurve(
      [pt(-hwTop, yTop), pt(hwTop, yTop), pt(hwTop * 1.06, yBrim - 1), pt(-hwTop * 1.06, yBrim - 1)],
      8,
    );
    paint(T(crown));
    const brim = closedCurve(
      [pt(-hwBrim * 1.5, yBrim - 1.2), pt(hwBrim * 1.5, yBrim - 1.2), pt(hwBrim * 1.45, yBrim + 2), pt(-hwBrim * 1.45, yBrim + 2)],
      8,
    );
    ink.fill(T(brim), { alpha: hat.tone === 'light' ? 0.55 : 0.88, wobble: 0.7 });
    return;
  }
}

function tiltXY(an, x, y) {
  const p = an.tiltPoint(pt(x, y));
  return [p.x, p.y];
}

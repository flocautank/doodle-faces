/**
 * The colour layer.
 *
 * The reference sheets are almost entirely ink, with the odd patch of muted
 * colour: a terracotta wash behind curly hair, dusty rose on the cheeks, a
 * teal dot for an earring. What sells it is that the colour never lines up
 * with the ink — it sits a couple of millimetres off, like a print whose
 * colour plate slipped. So every wash here is deliberately mis-registered.
 *
 * Drawn *before* the ink, so the pen work stays on top and stays legible.
 */

import { closedCurve, ellipsePath, pt } from './ink.js?v=df44e11666';

/**
 * @param {object} ink        an ink instance from makeInk()
 * @param {object} an         anatomy
 * @param {object} g          genome
 * @param {object} regions    { hair, hat, beard: [], lens: [] } — paths already
 *                            tilted, as returned by hairRegion / hatRegions /
 *                            beardRegions / lensRegions
 */
export function drawAccents(ink, an, g, regions = {}) {
  const accents = g.accents || [];
  if (accents.length === 0) return;

  for (const a of accents) {
    switch (resolveTarget(a.target, regions)) {
      case 'hair':
        washRegion(ink, regions.hair, a);
        break;
      case 'hat':
        washRegion(ink, regions.hat[0], a);
        break;
      case 'beard':
        // only the main mass, not the moustache — two washes read as a smudge
        washRegion(ink, regions.beard[0], a);
        break;
      case 'lens':
        for (const lens of regions.lens) washRegion(ink, lens, { ...a, alpha: a.alpha * 0.55 });
        break;
      case 'cheeks':
        drawCheeks(ink, an, g, a);
        break;
      case 'dot':
        drawDot(ink, an, g, a);
        break;
      case 'block':
        drawBlock(ink, an, g, a);
        break;
      case 'skin':
        // the whole head washed, badly registered — the boldest of the lot
        washRegion(ink, regions.head, { ...a, alpha: a.alpha * 0.5 });
        break;
    }
  }
}

/** Fall back to something this face actually has. */
function resolveTarget(target, regions) {
  if (target === 'hair' && !regions.hair) return 'cheeks';
  if (target === 'hat' && !(regions.hat && regions.hat.length)) return 'cheeks';
  if (target === 'beard' && !(regions.beard && regions.beard.length)) return 'cheeks';
  if (target === 'lens' && !(regions.lens && regions.lens.length)) return 'cheeks';
  if (target === 'skin' && !regions.head) return 'cheeks';
  return target;
}

function washRegion(ink, path, a) {
  if (!path) return;
  ink.wash(path, {
    color: a.color,
    alpha: a.alpha,
    offset: a.offset,
    scale: a.scale,
    rotate: a.rotate,
    wobble: a.wobble,
    phase: 7,
  });
}

// Cheeks read as flush, so they take the warm end of the palette whatever the
// look picked — a sage or teal cheek reads as illness, not blush.
const WARM = ['rgb(205,133,128)', 'rgb(198,128,80)', 'rgb(176,94,72)', 'rgb(152,111,139)'];

function drawCheeks(ink, an, g, a) {
  const color = WARM.includes(a.color) ? a.color : WARM[Math.abs(Math.round(a.x * 7)) % WARM.length];
  for (const side of [-1, 1]) {
    const y = an.noseY + 2 + a.y;
    const x = side * (an.eyeGap + 2.6) + a.x;
    const rx = 4.6 * a.size;
    const ry = 3.2 * a.size;
    // the two cheeks drift independently, as a hand-placed wash would
    ink.wash(an.tiltPath(ellipsePath(x, y, rx, ry, 0, Math.PI * 2, 20)), {
      color,
      alpha: a.alpha * 0.92,
      offset: [a.offset[0] * side * 0.5, a.offset[1] * 0.5],
      wobble: a.wobble * 1.4,
      feather: 1.2,
      phase: side > 0 ? 3 : 19,
    });
  }
}

function drawDot(ink, an, g, a) {
  // an earring, a badge, a stray splash of colour beside the head
  const side = a.x >= 0 ? 1 : -1;
  const y = an.earY + 2 + a.y * 2;
  const x = side * (an.halfWidth(y) + 2.4 * a.size);
  const r = 2.6 * a.size;
  ink.wash(an.tiltPath(ellipsePath(x, y, r, r * 1.04, 0, Math.PI * 2, 18)), {
    color: a.color,
    alpha: Math.min(0.92, a.alpha + 0.3),
    offset: [0, 0],
    wobble: a.wobble * 0.5,
    phase: 11,
  });
}

function drawBlock(ink, an, g, a) {
  // a rectangle of flat colour laid across part of the face, the way a
  // mis-cut colour plate would land
  const side = a.x >= 0 ? 1 : -1;
  const w = 7 * a.size;
  const h = 11 * a.size;
  const cx = side * (an.eyeGap + 1.5);
  const cy = an.eyeY + 1 + a.y;
  const rect = closedCurve(
    [pt(cx - w, cy - h), pt(cx + w, cy - h), pt(cx + w, cy + h), pt(cx - w, cy + h)],
    5,
  );
  ink.wash(an.tiltPath(rect), {
    color: a.color,
    alpha: a.alpha * 0.55,
    offset: a.offset,
    rotate: a.rotate * 0.5,
    wobble: a.wobble * 0.4,
    phase: 23,
  });
}

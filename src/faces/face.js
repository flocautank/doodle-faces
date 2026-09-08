/**
 * doodle-faces — public API.
 *
 * Zero dependencies, no build step, no framework. Everything is drawn into a
 * plain Canvas2D context, so the same code works in a web page, in an
 * OffscreenCanvas worker, or piped into any engine that can take a canvas.
 *
 *   import { renderFace } from './src/faces/face.js?v=e1ff722724';
 *   document.body.append(renderFace('gareth', { size: 256 }));
 *
 * Seeds are stable: the same seed always produces the same face, on every
 * machine, forever. Store the seed, not the pixels.
 */

import { makeAnatomy } from './anatomy.js?v=e1ff722724';
import { drawGlasses, drawHat, hatRegions, lensRegions } from './accessories.js?v=e1ff722724';
import {
  drawBrows, drawEars, drawEyes, drawHorns, drawMarks, drawMouth, drawNose, drawProps,
} from './features.js?v=e1ff722724';
import { beardRegions, drawBeard, drawHair, hairRegion } from './hair.js?v=e1ff722724';
import { drawAccents } from './color.js?v=e1ff722724';
import { makeInk, openCurve, paintPaper, pt } from './ink.js?v=e1ff722724';
import { makeGenome, makeGenomes } from './genome.js?v=e1ff722724';

export { makeGenome, makeGenomes } from './genome.js?v=e1ff722724';
export {
  BEARD_STYLES, BROW_STYLES, DEFAULT_WEIGHTS, EAR_STYLES, EYE_STYLES,
  GLASSES_STYLES, HAIR_STYLES, HAT_STYLES, HEAD_SHAPES, MOUTH_STYLES, NOSE_STYLES,
  PEN_NAMES, PEN_STYLES,
} from './genome.js?v=e1ff722724';
export { makeRng } from './rng.js?v=e1ff722724';
export { KIN, KIN_NAMES } from './kin.js?v=e1ff722724';
export { LOOKS, LOOK_NAMES } from './looks.js?v=e1ff722724';
export { paintPaper } from './ink.js?v=e1ff722724';
export { PRESETS } from './presets.js?v=e1ff722724';
export { makeRecipe, RECIPES, RECIPE_NAMES } from './recipes.js?v=e1ff722724';
export { breed, brood } from './breed.js?v=e1ff722724';

/** The drawing box. The face itself is 100 units, leaving room for hats. */
export const BOX = 128;

/** Alias kept for readability at call sites. */
export const generateFace = makeGenome;

/**
 * Draw one face into a context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object|string|number} face  a genome, or a seed to generate one from
 * @param {object} [opts]
 * @param {number} [opts.size]     side of the square to draw into (px)
 * @param {number} [opts.x=0]      top-left of that square
 * @param {number} [opts.y=0]
 * @param {boolean|object} [opts.paper=true]  false for a transparent cut-out,
 *                                            or { tone, grain, vignette }
 * @param {string} [opts.ink]      override the genome's ink colour
 * @param {number} [opts.weight]   extra line-weight multiplier
 * @param {number} [opts.shake]    extra wobble multiplier
 * @param {number} [opts.lod]      0..1 level of detail. Defaults to the drawn
 *   size; force it low for live dragging, high for an export.
 * @param {boolean} [opts.accents=true]  draw the colour layer
 * @param {number} [opts.turn=1]  how often heads are drawn turned. 0 = all frontal.
 * @param {number} [opts.color=1]  how often accents appear when generating from
 *   a seed: 0 = pure ink, 1 = the default sprinkle, 2 = generous. Ignored when
 *   you pass a genome, which already carries its accents.
 * @param {string} [opts.blend='multiply']  canvas blend mode for the ink.
 *   'multiply' lets overlapping strokes build up on the paper. Over a
 *   transparent background — an atlas destined for a game engine — use
 *   'source-over' instead, so the ink stays opaque whatever it lands on.
 */
export function drawFace(ctx, face, opts = {}) {
  const g = typeof face === 'object' && face !== null && face.head ? face : makeGenome(face, opts);
  const size = opts.size ?? Math.min(ctx.canvas.width, ctx.canvas.height);
  const ox = opts.x ?? 0;
  const oy = opts.y ?? 0;

  ctx.save();
  ctx.translate(ox, oy);

  if (opts.paper !== false) {
    const paperOpts = typeof opts.paper === 'object' ? opts.paper : {};
    paintPaper(ctx, size, size, {
      seed: `${g.seed}:paper`,
      lod: opts.lod ?? Math.max(0.35, Math.min(1, size / 190)),
      ...paperOpts,
    });
  }

  ctx.translate(size / 2, size / 2);
  const scale = size / BOX;
  ctx.scale(scale, scale);

  // Total device scale, so hairlines never disappear on small thumbnails.
  let pxPerUnit = scale;
  if (typeof ctx.getTransform === 'function') {
    try {
      pxPerUnit = Math.abs(ctx.getTransform().a) || scale;
    } catch {
      /* getTransform is unavailable in some polyfills; the estimate is fine */
    }
  }

  // Detail is chosen from the drawn size unless the caller overrides it: a
  // thumbnail cannot show what a portrait can, so it should not pay for it.
  const lod = opts.lod ?? Math.max(0.35, Math.min(1, size / 190));

  const ink = makeInk(ctx, {
    seed: `${g.seed}:ink`,
    pxPerUnit,
    lod,
    color: opts.ink ?? g.pen.ink,
    weight: g.pen.weight * (opts.weight ?? 1),
    shake: g.pen.shake * (opts.shake ?? 1),
    alpha: g.pen.alpha,
    skip: g.pen.skip,
    fill: g.pen.fill,
  });

  const an = makeAnatomy(g);

  const prevOp = ctx.globalCompositeOperation;

  // Colour first, under the ink: the pen work has to stay readable, and a wash
  // laid on top would grey it out.
  if ((g.accents || []).length > 0 && opts.accents !== false) {
    ctx.globalCompositeOperation = opts.blend ?? 'multiply';
    drawAccents(ink, an, g, {
      head: an.tiltPath(an.silhouette(0, 0, 40)),
      hair: hairRegion(an, g),
      hat: hatRegions(an, g),
      beard: beardRegions(an, g),
      lens: lensRegions(an, g),
    });
  }

  ctx.globalCompositeOperation = opts.blend ?? 'multiply';

  if (g.head.neck) drawNeck(ink, an, g);
  drawHead(ink, an, g);
  drawEars(ink, an, g);
  drawHair(ink, an, g);
  drawBrows(ink, an, g);
  drawEyes(ink, an, g);
  drawNose(ink, an, g);
  drawMarks(ink, an, g);
  drawBeard(ink, an, g);
  drawMouth(ink, an, g);
  drawProps(ink, an, g);
  drawGlasses(ink, an, g);
  drawHat(ink, an, g);
  // Horns come last: they grow through the hair and out past a hat, so drawing
  // them with the ears left them buried under a dark hair mass.
  drawHorns(ink, an, g);

  ctx.globalCompositeOperation = prevOp;
  ctx.restore();
  return g;
}

function drawHead(ink, an, g) {
  const outline = an.tiltPath(an.silhouette(0, 0, 52));
  ink.outline(outline, {
    width: 1.2,
    passes: g.pen.passes,
    wobble: 1.3,
    freq: 2.1,
    skip: 0.04,
  });
}

function drawNeck(ink, an, g) {
  const y0 = an.yAt(0.9);
  const y1 = an.bottom + an.h * 0.42;
  const hw = an.w * 0.34;
  for (const side of [-1, 1]) {
    ink.stroke(
      an.tiltPath(openCurve([pt(side * an.halfWidth(y0) * 0.86, y0), pt(side * hw, y1 - 3), pt(side * hw * 1.6, y1)], 7)),
      { width: 0.95, passes: 2, wobble: 0.7, alpha: 0.65 },
    );
  }
  void g;
}

/**
 * Render a face into a freshly created canvas element.
 *
 * @param {object|string|number} face seed or genome
 * @param {object} [opts] as drawFace, plus:
 * @param {number} [opts.size=256]
 * @param {number} [opts.dpr]  device pixel ratio; defaults to the screen's
 * @returns {HTMLCanvasElement}
 */
export function renderFace(face, opts = {}) {
  const size = opts.size ?? 256;
  const screen = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  // Small faces gain nothing from a 3x buffer, and it costs 9x the fill.
  const dpr = opts.dpr ?? Math.min(size < 200 ? 1.5 : 2, screen);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const genome = drawFace(ctx, face, { ...opts, size, x: 0, y: 0 });
  canvas.dataset.seed = genome.seed;
  return canvas;
}

/** Render a face straight to a PNG data URL. */
export function faceToDataURL(face, opts = {}) {
  return renderFace(face, opts).toDataURL('image/png');
}

/**
 * Render many faces onto one canvas — a contact sheet, or a game spritesheet.
 *
 * @param {Array<object|string|number>} faces
 * @param {object} [opts]
 * @param {number} [opts.cell=128]  cell size in px
 * @param {number} [opts.cols]      defaults to a near-square grid
 * @param {number} [opts.gap=0]
 * @returns {HTMLCanvasElement}
 */
export function renderSheet(faces, opts = {}) {
  const cell = opts.cell ?? 128;
  const gap = opts.gap ?? 0;
  const cols = opts.cols ?? Math.ceil(Math.sqrt(faces.length));
  const rows = Math.ceil(faces.length / cols);
  const dpr = opts.dpr ?? 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round((cols * cell + (cols - 1) * gap) * dpr);
  canvas.height = Math.round((rows * cell + (rows - 1) * gap) * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  if (opts.paper !== false) {
    paintPaper(ctx, canvas.width / dpr, canvas.height / dpr, {
      seed: opts.sheetSeed ?? 'sheet',
      ...(typeof opts.paper === 'object' ? opts.paper : {}),
    });
  }

  faces.forEach((face, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawFace(ctx, face, {
      ...opts,
      size: cell,
      x: col * (cell + gap),
      y: row * (cell + gap),
      // the sheet already has one continuous sheet of paper behind it
      paper: false,
    });
  });

  return canvas;
}

/** Convenience: `faces('village', 40)` -> 40 stable genomes. */
export const faces = makeGenomes;

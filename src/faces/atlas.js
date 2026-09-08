/**
 * Atlas export — bake a pool of faces into one image plus a manifest.
 *
 * This is the cheap way to use the generator from an engine that can't run the
 * JavaScript renderer: bake a few hundred faces once, ship the PNG, and look a
 * face up by hashing whatever id the game already has (a character id, a save
 * slot, a name). Every lookup is stable, and no renderer has to be maintained
 * twice.
 */

import { drawFace } from './face.js';
import { makeGenome } from './genome.js';
import { hashSeed } from './rng.js';

/**
 * @param {Array<string|number|object>} faces  seeds or genomes
 * @param {object} [opts]
 * @param {number} [opts.cell=192]     cell size in px
 * @param {number} [opts.cols]         defaults to a near-square grid
 * @param {boolean|object} [opts.paper=false]  transparent by default, which is
 *                                             what a game engine wants
 * @param {number} [opts.weight]
 * @param {number} [opts.shake]
 * @param {object} [opts.weights]      population preset
 * @param {object} [opts.force]        pinned traits, e.g. { hat: 'none' }
 * @param {string} [opts.ink]          ink colour override — pass a light one
 *                                     for a dark game background
 * @param {string} [opts.name='doodle-faces']
 * @returns {{ canvas: HTMLCanvasElement, manifest: object }}
 */
export function buildAtlas(faces, opts = {}) {
  const cell = opts.cell ?? 192;
  const cols = opts.cols ?? Math.ceil(Math.sqrt(faces.length));
  const rows = Math.ceil(faces.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');

  const entries = [];
  faces.forEach((face, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const genome = drawFace(ctx, face, {
      size: cell,
      x: col * cell,
      y: row * cell,
      paper: opts.paper ?? false,
      weight: opts.weight,
      shake: opts.shake,
      ink: opts.ink,
      weights: opts.weights,
      kin: opts.kin,
      look: opts.look,
      force: opts.force,
      color: opts.color,
      turn: opts.turn,
      // opaque ink, so the atlas composites over any background the game has
      blend: opts.blend ?? 'source-over',
    });
    entries.push({
      seed: genome.seed,
      index: i,
      x: col * cell,
      y: row * cell,
      w: cell,
      h: cell,
    });
  });

  const manifest = {
    format: 'doodle-faces-atlas',
    version: 1,
    name: opts.name ?? 'doodle-faces',
    image: `${opts.name ?? 'doodle-faces'}.png`,
    cell,
    cols,
    rows,
    count: entries.length,
    faces: entries,
  };

  return { canvas, manifest };
}

/**
 * Pick a cell from an atlas manifest for an arbitrary id.
 * Uses the same hash as the generator, so an id maps to the same cell in
 * JavaScript and in any port of `hashSeed`.
 */
export function atlasIndexFor(id, count) {
  return hashSeed(id) % count;
}

/** Build the seed list an atlas is baked from. */
export function atlasSeeds(rootSeed, count) {
  return Array.from({ length: count }, (_, i) => `${rootSeed}#${i}`);
}

/** Convenience: genomes for the same pool, if you want to inspect the traits. */
export function atlasGenomes(rootSeed, count, opts) {
  return atlasSeeds(rootSeed, count).map((s) => makeGenome(s, opts));
}

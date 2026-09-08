/**
 * Crossover — mix two genomes into a child.
 *
 * This is the payoff of keeping the genome as plain data. Enum traits are
 * inherited whole from one parent or the other (half a hairstyle is not a
 * hairstyle), while numbers are blended, with a little drift so a child is
 * never exactly the average of its parents.
 *
 * Useful for a family resemblance in a game: give siblings the same two
 * parents and different child seeds.
 */

import { makeRng } from './rng.js';

/**
 * Fields that must be taken whole from one parent. Everything else that is a
 * number gets blended; everything else that is not gets picked at random.
 */
const DISCRETE = new Set([
  'kin', 'look', 'shape', 'style', 'tone', 'hairline', 'ink', 'tusks',
  'target', 'hue', 'color', 'earringStyle',
]);

/** Fields nobody should inherit — they identify the individual. */
const SKIP = new Set(['seed', 'version']);

/**
 * @param {object} a  parent genome
 * @param {object} b  parent genome
 * @param {string|number} seed  the child's own seed
 * @param {object} [opts]
 * @param {number} [opts.bias=0.5]   0 = all of `a`, 1 = all of `b`
 * @param {number} [opts.drift=0.12] how far a blended number may wander past
 *   the two parents, as a fraction of their gap plus a touch of absolute jitter
 * @returns {object} a new genome
 */
export function breed(a, b, seed, opts = {}) {
  const rng = makeRng(`breed:${seed}`);
  const bias = opts.bias === undefined ? 0.5 : opts.bias;
  const drift = opts.drift === undefined ? 0.12 : opts.drift;

  const mix = (x, y, key) => {
    // discrete: inherit one side whole
    if (DISCRETE.has(key) || typeof x === 'string' || typeof x === 'boolean') {
      return rng.next() < bias ? y : x;
    }
    if (typeof x === 'number' && typeof y === 'number') {
      const t = rng.range(0.15, 0.85);
      const blended = x + (y - x) * t;
      const gap = Math.abs(y - x);
      return blended + rng.gauss(0, gap * drift + Math.abs(blended) * 0.02);
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      // accents: take one parent's set outright, otherwise they pile up
      return structuredCloneish(rng.next() < bias ? y : x);
    }
    if (x && y && typeof x === 'object' && typeof y === 'object') {
      const out = {};
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (SKIP.has(k)) continue;
        if (!(k in x)) out[k] = structuredCloneish(y[k]);
        else if (!(k in y)) out[k] = structuredCloneish(x[k]);
        else out[k] = mix(x[k], y[k], k);
      }
      return out;
    }
    // one side is null (no horns, say): inherit whichever exists, or neither
    return rng.next() < bias ? structuredCloneish(y) : structuredCloneish(x);
  };

  const child = mix(a, b, '');
  child.version = a.version || 2;
  child.seed = String(seed);
  // `kin`/`look` sit at the top level and must survive as strings
  child.kin = rng.next() < bias ? b.kin : a.kin;
  child.look = rng.next() < bias ? b.look : a.look;
  return child;
}

/** A tiny deep clone, so a child never shares structure with a parent. */
function structuredCloneish(v) {
  if (Array.isArray(v)) return v.map(structuredCloneish);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = structuredCloneish(v[k]);
    return out;
  }
  return v;
}

/** A whole brood from the same two parents. */
export function brood(a, b, rootSeed, count, opts) {
  return Array.from({ length: count }, (_, i) => breed(a, b, `${rootSeed}#${i}`, opts));
}

/**
 * Seeded pseudo-random number generation + smooth noise.
 * Zero dependencies. Deterministic: same seed -> same face, forever.
 */

/** Hash an arbitrary string/number into a 32-bit integer seed. */
export function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return (seed >>> 0) || 0x9e3779b9;
  }
  const str = String(seed ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 0x9e3779b9;
}

/** mulberry32 — small, fast, good enough distribution for art. */
export function makeRng(seed) {
  let a = hashSeed(seed);

  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    /** float in [0,1) */
    next,
    /** float in [min,max) */
    range: (min, max) => min + next() * (max - min),
    /** integer in [min,max] inclusive */
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    /** true with probability p */
    chance: (p) => next() < p,
    /** uniform pick */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /**
     * Weighted pick. Accepts either
     *   [['a', 3], ['b', 1]]  or  { a: 3, b: 1 }
     */
    weighted(table) {
      const entries = Array.isArray(table) ? table : Object.entries(table);
      if (entries.length === 0) return undefined;
      let total = 0;
      for (const [, w] of entries) total += w;
      let r = next() * total;
      for (const [value, w] of entries) {
        r -= w;
        if (r <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
    /** roughly normal distribution, clamped to +/- 3 sigma */
    gauss: (mean = 0, sigma = 1) => {
      const u = Math.max(next(), 1e-9);
      const v = next();
      const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return mean + Math.max(-3, Math.min(3, n)) * sigma;
    },
    /** derive an independent stream (so adding features never shifts old ones) */
    fork: (tag) => makeRng(hashSeed(tag) ^ Math.floor(next() * 0xffffffff)),
  };

  return rng;
}

/**
 * 1D value noise with smoothstep interpolation.
 * Used to give strokes a slow, organic drift instead of white-noise fuzz.
 */
export function makeNoise1D(rng, size = 256) {
  const table = new Float32Array(size);
  for (let i = 0; i < size; i++) table[i] = rng.next() * 2 - 1;

  return function noise(x) {
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    const a = table[((i % size) + size) % size];
    const b = table[(((i + 1) % size) + size) % size];
    return a + (b - a) * s;
  };
}

/** Fractal sum of value noise — a couple of octaves is plenty for pen wobble. */
export function makeFbm1D(rng, octaves = 3) {
  const layers = [];
  for (let o = 0; o < octaves; o++) {
    layers.push({ noise: makeNoise1D(rng), freq: 2 ** o, amp: 1 / 2 ** o });
  }
  let norm = 0;
  for (const l of layers) norm += l.amp;

  return function fbm(x) {
    let sum = 0;
    for (const l of layers) sum += l.noise(x * l.freq) * l.amp;
    return sum / norm;
  };
}

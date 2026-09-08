/**
 * The genome: a plain JSON description of one face.
 *
 * No canvas, no DOM, no drawing — just numbers and enum strings. That makes it
 * cheap to store (a save file keeps the seed, or the genome if you let players
 * customise), diffable, and portable to any renderer.
 *
 * It is built in layers, each one narrowing the one before:
 *   kin    what sort of creature — skull proportions and feature scale
 *   look   the archetype it is playing — styling bias and props
 *   traits the individual draws
 *
 * Coordinate convention used by the renderer: a 100x100 face box with the
 * origin at its centre, so x/y roughly in [-50, 50]. y grows downwards.
 */

import { makeRng } from './rng.js?v=df44e11666';
import { KIN_WEIGHTS, resolveKin } from './kin.js?v=df44e11666';
import { LOOK_BLOCKLIST, LOOK_WEIGHTS, resolveLook } from './looks.js?v=df44e11666';

export { KIN, KIN_NAMES, KIN_WEIGHTS } from './kin.js?v=df44e11666';
export { LOOKS, LOOK_NAMES, LOOK_WEIGHTS } from './looks.js?v=df44e11666';

export const HEAD_SHAPES = [
  'round', 'oval', 'egg', 'square', 'pear', 'long', 'wide', 'diamond',
  'heart', 'jug', 'bell', 'wedge', 'blob', 'brick',
];
export const EYE_STYLES = [
  'oval', 'dot', 'line', 'wide', 'sleepy', 'squint', 'round', 'wonky',
  'wink', 'cross', 'star', 'spiral', 'mismatched', 'closed', 'glare', 'beady',
  'googly', 'slit', 'hollow', 'sideways', 'angry', 'teary',
];
export const BROW_STYLES = ['none', 'thin', 'thick', 'angled', 'arched', 'bushy', 'worried', 'zigzag', 'stubby', 'sparse'];
export const NOSE_STYLES = [
  'hook', 'twoLines', 'triangle', 'button', 'long', 'wide', 'bulb', 'snub', 'broken', 'snout',
  'roman', 'beak', 'tiny', 'flat',
];
export const MOUTH_STYLES = [
  'line', 'smile', 'frown', 'open', 'wavy', 'smirk', 'teeth', 'o', 'pursed',
  'grin', 'tongue', 'fangs', 'gap', 'zigzag', 'buck', 'drool', 'stitched', 'dot',
];
export const HAIR_STYLES = [
  'none', 'buzz', 'shortHatch', 'flatTop', 'messy', 'mop', 'curly', 'spiky',
  'long', 'bob', 'fringe', 'receding', 'mohawk', 'bun', 'pigtails', 'combover',
  'afro', 'dreads', 'ponytail', 'topknot', 'shavedSides',
  'bowl', 'pompadour', 'braids', 'waves', 'cornrows', 'sidePuffs',
];
export const BEARD_STYLES = [
  'none', 'stubble', 'mustache', 'goatee', 'full', 'chinStrap', 'sideburns',
  'soulPatch', 'muttonChops', 'longBeard', 'braided',
  'handlebar', 'fuManchu', 'neckbeard', 'vandyke',
];
export const GLASSES_STYLES = [
  'none', 'round', 'square', 'sunglasses', 'halfRim', 'monocle',
  'aviator', 'cateye', 'goggles', 'pince',
];
export const HAT_STYLES = [
  'none', 'beanie', 'cap', 'bandana', 'headband', 'tophat', 'beret', 'flatCap', 'hood',
  'fez', 'crown', 'helmet', 'cowboy', 'wizard', 'nightcap',
];
export const EAR_STYLES = ['arc', 'round', 'big', 'pointy', 'hidden', 'droopy', 'cauliflower'];

/** Forehead edge shapes. A style suggests one, but any style can borrow another. */
export const HAIRLINES = ['straight', 'wavy', 'arc', 'peak', 'receding', 'swoop'];

/** How the pen behaves. The reference sheets swing from a fine nib to a fat marker. */
export const PEN_STYLES = {
  fine: { label: 'Fine nib', weight: 0.72, passes: 2, alpha: 0.86, skip: 0.05, shake: 1.0, fill: 0.88 },
  ballpoint: { label: 'Ballpoint', weight: 1.0, passes: 2, alpha: 0.82, skip: 0.08, shake: 1.1, fill: 0.9 },
  pencil: { label: 'Pencil', weight: 1.1, passes: 3, alpha: 0.5, skip: 0.2, shake: 1.25, fill: 0.6 },
  quill: { label: 'Quill', weight: 0.85, passes: 2, alpha: 0.9, skip: 0.14, shake: 1.6, fill: 0.9 },
  marker: { label: 'Marker', weight: 2.0, passes: 2, alpha: 0.94, skip: 0.02, shake: 0.85, fill: 0.96 },
  charcoal: { label: 'Charcoal', weight: 2.5, passes: 3, alpha: 0.62, skip: 0.18, shake: 1.45, fill: 0.82 },
  brush: { label: 'Brush', weight: 1.75, passes: 2, alpha: 0.9, skip: 0.03, shake: 1.3, fill: 0.94 },
  wax: { label: 'Wax crayon', weight: 2.9, passes: 2, alpha: 0.55, skip: 0.26, shake: 1.2, fill: 0.7 },
};
export const PEN_NAMES = Object.keys(PEN_STYLES);

export const PEN_WEIGHTS = { fine: 22, ballpoint: 26, pencil: 9, quill: 7, marker: 14, charcoal: 9, brush: 8, wax: 5 };

/**
 * Accent colours: muted, matte, printerly. Nothing saturated — the point is a
 * hand-coloured print, not a cartoon.
 */
export const ACCENT_COLORS = {
  terracotta: 'rgb(198,128,80)',
  rose: 'rgb(205,133,128)',
  sage: 'rgb(120,155,124)',
  teal: 'rgb(52,124,113)',
  mustard: 'rgb(198,158,66)',
  slate: 'rgb(118,136,161)',
  plum: 'rgb(152,111,139)',
  sky: 'rgb(126,161,184)',
  brick: 'rgb(176,94,72)',
  olive: 'rgb(140,141,80)',
  ash: 'rgb(158,150,140)',
};

/** Where an accent can land. */
export const ACCENT_TARGETS = ['hair', 'hat', 'beard', 'cheeks', 'lens', 'dot', 'block', 'skin'];

/**
 * Baseline weight tables — a plain human crowd. Kin and look tables layer on
 * top of these, and `opts.weights` on top of everything.
 */
export const DEFAULT_WEIGHTS = {
  head: {
    round: 16, oval: 12, egg: 9, square: 9, pear: 7, long: 7, wide: 9, diamond: 4,
    heart: 5, jug: 6, bell: 5, wedge: 4, blob: 5, brick: 4,
  },
  eyes: {
    oval: 14, dot: 9, line: 6, wide: 8, sleepy: 7, squint: 6, round: 9, wonky: 6,
    wink: 4, cross: 2, star: 2, spiral: 2, mismatched: 7, closed: 3, glare: 4, beady: 4,
    googly: 3, slit: 2, hollow: 2, sideways: 4, angry: 5, teary: 2,
  },
  brows: { none: 16, thin: 14, thick: 14, angled: 11, arched: 10, bushy: 12, worried: 10, zigzag: 3, stubby: 6, sparse: 4 },
  nose: {
    hook: 13, twoLines: 13, triangle: 9, button: 10, long: 9, wide: 9, bulb: 10, snub: 7, broken: 5, snout: 2,
    roman: 8, beak: 5, tiny: 6, flat: 6,
  },
  mouth: {
    line: 14, smile: 12, frown: 7, open: 5, wavy: 8, smirk: 9, teeth: 4, o: 4, pursed: 7,
    grin: 5, tongue: 3, fangs: 3, gap: 3, zigzag: 3, buck: 4, drool: 2, stitched: 2, dot: 3,
  },
  hair: {
    none: 5, buzz: 6, shortHatch: 9, flatTop: 5, messy: 9, mop: 7, curly: 6,
    spiky: 5, long: 5, bob: 4, fringe: 4, receding: 4, mohawk: 2, bun: 3,
    pigtails: 2, combover: 4, afro: 4, dreads: 3, ponytail: 4, topknot: 3, shavedSides: 4,
    bowl: 4, pompadour: 3, braids: 3, waves: 4, cornrows: 3, sidePuffs: 2,
  },
  beard: {
    none: 58, stubble: 7, mustache: 5, goatee: 4, full: 6, chinStrap: 3, sideburns: 4,
    soulPatch: 2, muttonChops: 3, longBeard: 3, braided: 2,
    handlebar: 3, fuManchu: 2, neckbeard: 2, vandyke: 3,
  },
  glasses: {
    none: 72, round: 7, square: 5, sunglasses: 4, halfRim: 3, monocle: 2,
    aviator: 3, cateye: 2, goggles: 2, pince: 2,
  },
  hat: {
    none: 78, beanie: 4, cap: 3, bandana: 2, headband: 2, tophat: 1, beret: 2, flatCap: 3, hood: 1,
    fez: 1, crown: 1, helmet: 1, cowboy: 1, wizard: 1, nightcap: 1,
  },
  ears: { arc: 32, round: 24, big: 13, pointy: 7, hidden: 17, droopy: 6, cauliflower: 4 },
};

/** Headwear that covers the crown, so whatever is under it mostly disappears. */
const COVERS_CROWN = new Set(['beanie', 'cap', 'hood', 'tophat', 'beret', 'flatCap']);

/** Hair long enough to fall out below a hat and still read. */
const FALLS_BELOW_HAT = new Set(['long', 'dreads', 'ponytail', 'bob', 'curly', 'pigtails', 'mop']);

/** Baseline prop probabilities, before a look nudges them. */
const DEFAULT_PROPS = {
  earring: 0.1,
  nosePiercing: 0.03,
  eyeliner: 0.05,
  lipstick: 0.05,
  tattoo: 0.03,
  scar: 0.05,
  cigarette: 0.03,
  eyepatch: 0.02,
  monobrow: 0.03,
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Head-shape and kin multipliers compound, so a broad skull on a broad kin can
 * run away into a slab. Clamp the absolute size, then clamp the aspect ratio —
 * that second step is what stops a wide-headed orc reading as a doormat.
 */
function headSize(hm, kin, rng) {
  let w = clamp(hm.w * kin.metrics.w * rng.range(0.92, 1.08), 23, 42);
  let h = clamp(hm.h * kin.metrics.h * rng.range(0.92, 1.08), 26, 47);
  const aspect = w / h;
  if (aspect > 1.18) w = h * 1.18;
  else if (aspect < 0.62) w = h * 0.62;
  return { w, h };
}

/**
 * Merge of weight tables: later arguments win, key by key.
 *
 * The order matters and is easy to get backwards. A population says *who turns
 * up*; the kin and the look then say what this particular individual is like.
 * So the population goes first and the individual refines it — putting the
 * population last made choosing "punk" inside the "crowd" population do
 * nothing at all, because the crowd's tables overwrote the punk's.
 */
function mergeWeights(...layers) {
  const out = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    out[key] = { ...DEFAULT_WEIGHTS[key] };
    for (const layer of layers) {
      if (layer && layer[key]) Object.assign(out[key], layer[key]);
    }
    // a table of all zeros would break the weighted pick
    let total = 0;
    for (const k of Object.keys(out[key])) total += out[key][k];
    if (total <= 0) out[key] = { ...DEFAULT_WEIGHTS[key] };
  }
  return out;
}

/**
 * Build a face genome from a seed.
 *
 * @param {string|number} seed
 * @param {object} [opts]
 * @param {object} [opts.kin]     partial overrides of KIN_WEIGHTS
 * @param {object} [opts.look]    partial overrides of LOOK_WEIGHTS
 * @param {object} [opts.weights] partial overrides of DEFAULT_WEIGHTS
 * @param {object} [opts.force]   pin traits, e.g. { kin: 'orc', hat: 'beanie' }
 * @param {number} [opts.color=1] how often colour accents appear. 0 = pure ink.
 * @param {number} [opts.turn=1]  how often heads are turned. 0 = all frontal.
 * @param {number} [opts.mood=0]  -1..1 bias for the population's expression.
 * @returns {object} genome
 */
export function makeGenome(seed, opts = {}) {
  const rng = makeRng(seed);
  const force = opts.force || {};
  const pick = (key, table) => (force[key] !== undefined ? force[key] : rng.weighted(table));

  // --- layer 1: kin ------------------------------------------------------
  // `opts.kin` replaces the table wholesale when given, so a preset can offer
  // a fantasy tavern without having to zero out every human variant.
  const kinTable = opts.kin ? opts.kin : KIN_WEIGHTS;
  const kin = resolveKin(pick('kin', kinTable));

  // --- layer 2: look -----------------------------------------------------
  const blocked = LOOK_BLOCKLIST[kin.name] || [];
  const lookTable = {};
  for (const [name, w] of Object.entries(opts.look || LOOK_WEIGHTS)) {
    if (!blocked.includes(name)) lookTable[name] = w;
  }
  const look = resolveLook(pick('look', Object.keys(lookTable).length ? lookTable : LOOK_WEIGHTS));

  const W = mergeWeights(opts.weights, kin.weights, look.weights);
  const pickTrait = (key) => (force[key] !== undefined ? force[key] : rng.weighted(W[key]));

  // --- layer 3: traits ---------------------------------------------------
  const headShape = pickTrait('head');
  const hm = HEAD_METRICS[headShape] || HEAD_METRICS.round;

  const hair = pickTrait('hair');
  const hat = pickTrait('hat');
  // Headwear that sits on the crown hides most of what is under it — but long
  // hair still falls out below the brim, and a headband or a bandana hides
  // almost nothing. Blanking the hair for *every* hat was throwing away the
  // most legible signal an archetype has.
  let hairUnderHat = hair;
  if (COVERS_CROWN.has(hat) && !FALLS_BELOW_HAT.has(hair)) {
    hairUnderHat = rng.chance(0.45) ? 'fringe' : 'none';
  }

  const glasses = pickTrait('glasses');
  let beard = kin.traits.noFacialHair ? 'none' : pickTrait('beard');
  if (kin.traits.alwaysBeard && (beard === 'none' || beard === 'stubble')) {
    beard = rng.weighted({ full: 34, longBeard: 30, braided: 20, muttonChops: 16 });
  }

  const hidesEars = hat === 'bandana' || hat === 'beanie' || hat === 'hood';
  const ears = kin.traits.ears
    ? kin.traits.ears
    : hidesEars
      ? (rng.chance(0.7) ? 'arc' : 'hidden')
      : pickTrait('ears');

  // --- pose: how far the head is turned ----------------------------------
  const turnAmount = opts.turn === undefined ? 1 : opts.turn;
  const turnRoll = rng.next();
  const turnDir = rng.chance(0.5) ? -1 : 1;
  let yaw = 0;
  if (turnAmount > 0) {
    // most heads are near-frontal; a good third are properly turned
    const magnitude =
      turnRoll < 0.3 ? rng.range(0, 0.08)
      : turnRoll < 0.7 ? rng.range(0.1, 0.28)
      : rng.range(0.28, 0.5);
    yaw = magnitude * turnDir * turnAmount;
  }

  const penStyle = pick('pen', PEN_WEIGHTS);
  const pen = PEN_STYLES[penStyle] || PEN_STYLES.ballpoint;

  const genome = {
    version: 2,
    seed: String(seed),
    kin: kin.name,
    look: look.name,

    // --- silhouette -------------------------------------------------------
    head: {
      shape: headShape,
      // Head-shape and kin multipliers compound, so a wide skull on a broad
      // kin can run away into a slab. Clamp the result rather than the inputs,
      // which keeps every combination usable.
      ...headSize(hm, kin, rng),
      jaw: clamp(hm.jaw * kin.metrics.jaw * rng.range(0.9, 1.12), 0.5, 1.5),
      brow: clamp(hm.brow * kin.metrics.brow * rng.range(0.92, 1.08), 0.6, 1.4),
      exp: clamp((hm.exp || 2.05) * kin.metrics.exp, 1.55, 3.5),
      tilt: rng.gauss(0, 0.055),
      yaw,
      neck: rng.chance(0.12),
      // the lopsided skulls in the reference: one side genuinely wider
      lopsided: rng.gauss(0, 0.05),
    },

    // Horns come from the kin, but anyone can grow a pair once in a while.
    horns: kin.traits.horns
      ? { style: kin.traits.horns, size: rng.range(0.75, 1.4), spread: rng.range(0.8, 1.25) }
      : rng.chance(0.015)
        ? { style: rng.pick(['curved', 'straight', 'ram']), size: rng.range(0.7, 1.2), spread: rng.range(0.8, 1.2) }
        : null,

    ears: {
      style: ears,
      size: rng.range(0.8, 1.35) * kin.scale.ear,
      y: rng.range(-0.02, 0.08),
      long: !!kin.traits.earLong,
    },

    // --- features ---------------------------------------------------------
    eyes: {
      style: pickTrait('eyes'),
      // a second style, used by 'mismatched'
      styleB: rng.weighted(W.eyes),
      spacing: rng.range(0.36, 0.52) * kin.scale.eyeGap,
      y: rng.range(-0.06, 0.06) + kin.lines.eye,
      size: rng.range(0.8, 1.3) * kin.scale.eye,
      pupil: rng.range(0.65, 1.3),
      // hand-drawn faces are charming because the two eyes never match
      asym: rng.gauss(0, 0.18),
      tiltAsym: rng.gauss(0, 0.14),
      heightAsym: rng.gauss(0, 0.9),
      lashes: rng.chance(0.16),
      bags: rng.chance(kin.traits.wrinkly ? 0.6 : 0.14),
    },

    brows: {
      style: pickTrait('brows'),
      y: rng.range(-0.05, 0.05),
      thickness: rng.range(0.75, 1.4) * kin.scale.brow,
      lift: rng.gauss(0, 0.14),
      angle: rng.gauss(0, 0.16),
      ridge: !!kin.traits.browRidge,
    },

    nose: {
      style: pickTrait('nose'),
      size: rng.range(0.8, 1.3) * kin.scale.nose,
      y: rng.range(-0.04, 0.06) + kin.lines.nose,
      x: rng.gauss(0, 0.02),
      nostrils: rng.chance(0.3),
    },

    mouth: {
      style: pickTrait('mouth'),
      w: rng.range(0.8, 1.3) * kin.scale.mouth,
      y: rng.range(-0.04, 0.05) + kin.lines.mouth,
      x: rng.gauss(0, 0.02),
      curve: rng.gauss(0, 0.5),
      tusks: kin.traits.tusks || 'none',
      tuskSize: rng.range(0.75, 1.4),
    },

    // --- hair & accessories ----------------------------------------------
    hair: {
      style: hairUnderHat,
      density: rng.range(0.7, 1.45),
      tone: rng.weighted({ light: 32, mid: 43, dark: 25 }),
      messiness: rng.range(0.4, 1.6),
      height: rng.range(0.8, 1.3),
      part: rng.chance(0.5) ? -1 : 1,

      // Everything below is what keeps two heads of the *same* style from
      // looking like the same haircut twice.
      puff: rng.range(0.6, 1.6),
      hairTShift: rng.gauss(0, 0.035),
      sideShift: rng.range(-0.04, 0.12),
      asym: rng.gauss(0, 0.16),
      asymSide: rng.chance(0.5) ? -1 : 1,
      hairline: rng.chance(0.34) ? rng.pick(HAIRLINES) : null,
      strokeLen: rng.range(0.65, 1.5),
      spread: rng.range(0.5, 2.1),
      curl: rng.range(0.4, 2),
      swirl: rng.gauss(0, 0.5),
      turns: rng.range(0.55, 1.5),
      // how far dreads and ponytails hang
      length: rng.range(0.7, 1.6),
    },

    beard: {
      style: beard,
      density: rng.range(0.65, 1.45),
      tone: rng.weighted({ light: 30, mid: 45, dark: 25 }),
      extent: rng.gauss(0, 0.035),
      gap: rng.range(0.6, 1.5),
      strokeLen: rng.range(0.7, 1.4),
      length: rng.range(0.8, 1.5),
    },

    glasses: {
      style: glasses,
      size: rng.range(0.88, 1.18),
      thickness: rng.range(0.8, 1.3),
      side: rng.chance(0.5) ? -1 : 1,
    },

    hat: {
      style: hat,
      // A hood is a big shape; drawn in the lightest tone it reads as an empty
      // outline round the head rather than as cloth.
      tone: hat === 'hood'
        ? rng.weighted({ mid: 52, dark: 48 })
        : rng.weighted({ light: 22, mid: 40, dark: 38 }),
      height: rng.range(0.85, 1.2),
      tilt: rng.gauss(0, 0.06),
    },

    /**
     * Mood, -1 (sour) .. +1 (delighted).
     *
     * Not a trait: a lens the renderer applies over whatever brows, eyes and
     * mouth were drawn, so the same character can be happy or furious without
     * becoming a different person. `opts.mood` shifts the whole population.
     */
    expression: clamp(rng.gauss(opts.mood === undefined ? 0 : opts.mood, 0.34), -1, 1),

    // --- props ------------------------------------------------------------
    props: makeProps(rng, look, kin),

    // --- little marks -----------------------------------------------------
    marks: {
      freckles: rng.chance(0.2) ? rng.int(6, 22) : 0,
      blush: rng.chance(0.14),
      dimples: rng.chance(0.12),
      mole: rng.chance(0.1),
      wrinkles: kin.traits.wrinkly ? rng.int(2, 4) : rng.chance(0.18) ? rng.int(1, 3) : 0,
      chinLine: rng.chance(0.22),
      warts: (kin.name === 'goblin' || kin.name === 'troll') && rng.chance(0.45) ? rng.int(1, 3) : 0,
    },

    // --- pen / paper ------------------------------------------------------
    pen: {
      style: penStyle,
      ink: rng.weighted({
        'rgb(22,20,25)': 38,
        'rgb(16,19,26)': 22,
        'rgb(31,23,19)': 18,
        'rgb(19,25,32)': 12,
        'rgb(38,32,26)': 10,
      }),
      weight: pen.weight * rng.range(0.85, 1.2),
      shake: pen.shake * rng.range(0.75, 1.35),
      alpha: pen.alpha,
      skip: pen.skip,
      fill: pen.fill,
      passes: pen.passes,
    },
  };

  genome.accents = makeAccents(rng, genome, look, opts);
  return genome;
}

function makeProps(rng, look, kin) {
  const p = { ...DEFAULT_PROPS, ...look.props };
  const out = {};
  for (const key of Object.keys(DEFAULT_PROPS)) out[key] = rng.chance(p[key] || 0);
  // no piercings, make-up or cigarettes on children
  if (kin.traits.noFacialHair) {
    out.earring = false;
    out.nosePiercing = false;
    out.eyeliner = false;
    out.lipstick = false;
    out.cigarette = false;
    out.tattoo = false;
    out.scar = false;
  }
  out.earringStyle = rng.chance(0.45) ? 'hoop' : 'stud';
  out.earringSide = rng.chance(0.5) ? -1 : 1;
  out.tattooSide = rng.chance(0.5) ? -1 : 1;
  out.scarSide = rng.chance(0.5) ? -1 : 1;
  out.eyepatchSide = rng.chance(0.5) ? -1 : 1;
  out.cigaretteSide = rng.chance(0.5) ? -1 : 1;
  return out;
}

/**
 * Colour accents: flat, muted patches, offset from the ink they belong to —
 * the look of a print whose colour plate never quite lined up.
 */
function makeAccents(rng, genome, look, opts = {}) {
  const amount = (opts.color === undefined ? 1 : opts.color) * look.colorBias;
  if (amount <= 0) return [];

  // Only offer targets this face has — and skip anything drawn as solid ink,
  // since a wash underneath black is a wash you can't see.
  const pool = { cheeks: 16, dot: 12, block: 5, skin: 8 };
  if (genome.hair.style !== 'none' && genome.hair.tone !== 'dark') pool.hair = 34;
  if (genome.hat.style !== 'none' && genome.hat.tone !== 'dark') pool.hat = 22;
  if (genome.beard.style !== 'none' && genome.beard.style !== 'stubble' && genome.beard.tone !== 'dark') {
    pool.beard = 14;
  }
  if (genome.glasses.style !== 'none' && genome.glasses.style !== 'sunglasses') pool.lens = 10;

  const names = look.hues && look.hues.length ? look.hues : Object.keys(ACCENT_COLORS);
  const roll = rng.next();
  let count = 0;
  if (roll < 0.2 * amount) count = 1;
  if (roll < 0.055 * amount) count = 2;
  if (roll < 0.012 * amount) count = 3;
  if (count === 0) return [];

  const used = new Set();
  const out = [];
  for (let i = 0; i < count; i++) {
    const target = rng.weighted(Object.entries(pool).filter(([k]) => !used.has(k)));
    if (!target) break;
    used.add(target);
    const hue = rng.pick(names);
    out.push({
      target,
      hue,
      color: ACCENT_COLORS[hue] || ACCENT_COLORS.terracotta,
      // a patch that lands dead-on reads as fill; one that misses reads as print
      offset: [rng.gauss(0, 3.2), rng.gauss(0, 3.2)],
      scale: rng.range(0.88, 1.2),
      rotate: rng.gauss(0, 0.07),
      alpha: rng.range(0.52, 0.86),
      wobble: rng.range(0.8, 2),
      x: rng.gauss(0, 1),
      y: rng.gauss(0, 1),
      size: rng.range(0.7, 1.4),
    });
  }
  return out;
}

/**
 * Base proportions per head shape, in the 100-unit box.
 * `exp` is the superellipse exponent: 2 is an ellipse, higher is boxy, lower
 * is pointy.
 */
export const HEAD_METRICS = {
  round: { w: 34, h: 35, jaw: 1.0, brow: 1.0, exp: 2.05 },
  oval: { w: 31, h: 39, jaw: 0.92, brow: 0.98, exp: 2.0 },
  egg: { w: 32, h: 38, jaw: 0.78, brow: 1.08, exp: 2.15 },
  square: { w: 34, h: 36, jaw: 1.16, brow: 1.1, exp: 3.1 },
  pear: { w: 32, h: 37, jaw: 1.22, brow: 0.82, exp: 2.35 },
  long: { w: 28, h: 43, jaw: 0.95, brow: 0.95, exp: 2.05 },
  wide: { w: 39, h: 31, jaw: 1.08, brow: 1.06, exp: 2.2 },
  diamond: { w: 33, h: 39, jaw: 0.72, brow: 0.76, exp: 1.65 },
  heart: { w: 34, h: 37, jaw: 0.68, brow: 1.16, exp: 2.1 },
  jug: { w: 33, h: 34, jaw: 1.34, brow: 0.86, exp: 2.5 },
  bell: { w: 32, h: 36, jaw: 1.28, brow: 0.7, exp: 2.2 },
  wedge: { w: 36, h: 38, jaw: 0.6, brow: 1.2, exp: 1.9 },
  blob: { w: 35, h: 34, jaw: 1.05, brow: 0.95, exp: 1.85 },
  brick: { w: 33, h: 40, jaw: 1.1, brow: 1.12, exp: 3.6 },
};

/**
 * Generate a batch of genomes from one root seed.
 * Handy for "give me a village of 40 NPCs" — deterministic and reproducible.
 */
export function makeGenomes(rootSeed, count, opts = {}) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(makeGenome(`${rootSeed}#${i}`, opts));
  return out;
}

/**
 * Turn a photo measurement into a genome.
 *
 * `photo.js` measures; this file decides. Keeping them apart means the decision
 * table can be read, argued with and tested without a single pixel.
 *
 * Two rules run through the whole thing.
 *
 * **Deviation, not absolutes.** A drawn head here is nearly as wide as it is
 * tall; a real skull is about two thirds as wide. Handing the raw ratio to the
 * generator would flatten everybody. So every measurement is divided by what a
 * typical portrait gives (`PHOTO`) and the resulting factor is applied to the
 * generator's own typical value (`DOODLE`). A face 12% wider than average comes
 * out 12% wider than an average doodle.
 *
 * **Numbers are assigned, enums are searched.** The continuous traits — width,
 * jaw, eye spacing, mouth width — are set outright, because there is a real
 * measurement for each. The named traits have no such thing: nothing in a photo
 * says "pear". Those get a weight table, and then a few hundred candidate
 * genomes are scored against the measurement and the closest one wins. That
 * split is why the result looks like the person *and* still looks drawn: the
 * search leaves all the hand-made asymmetry alone.
 */

import {
  ACCENT_COLORS, BEARD_STYLES, BROW_STYLES, EYE_STYLES, GLASSES_STYLES,
  HAIR_STYLES, HAT_STYLES, HEAD_METRICS, HEAD_SHAPES, MOUTH_STYLES, NOSE_STYLES,
  makeGenome,
} from './genome.js?v=e1ff722724';
import { resolveKin } from './kin.js?v=e1ff722724';
import { makeRng } from './rng.js?v=e1ff722724';

/**
 * What a typical front-on portrait measures.
 *
 * These come *with* the measurement now, because there are two measurers and
 * they do not agree on definitions. "Face width" from a skin-colour blob and
 * face width from a landmark oval are different quantities, and a baseline
 * calibrated for one silently biases every face measured by the other. So each
 * source declares its own norms and this table is only the fallback.
 */
const PHOTO = {
  aspect: 0.66,      // cheek width / (crown → chin)
  jaw: 0.72,         // jaw width / cheek width
  brow: 0.88,        // forehead width / cheek width
  fill: 0.78,        // silhouette area / its bounding box
  eyeSpacing: 0.44,  // pupil-to-pupil / cheek width
  eyeWidth: 0.2,     // one eye / cheek width
  aperture: 0.34,    // eye height / eye width
  noseWidth: 0.25,
  mouthWidth: 0.36,
  chinT: 1.0,        // measured chin against the eye/mouth ruler's prediction
};

/** What the generator's own average human comes out at. */
const DOODLE = {
  aspect: 34 / 35,   // head.w / head.h, both half-extents, so the ratio holds
  area: 34 * 35,
  jaw: 1.0,
  brow: 1.0,
  exp: 2.05,
  eyeSpacing: 0.44,  // eyes sit at ±w·spacing, so this *is* a width fraction
  eyeSize: 1.05,
  noseSize: 1.05,
  mouthW: 1.05,
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Nudge a factor towards 1 — how much of a measurement to believe. */
function temper(factor, trust) {
  return 1 + (factor - 1) * trust;
}

/**
 * Expected eye height/width for each drawn style.
 *
 * Used both to bias the weight table and to score candidates. The numbers are
 * read off the renderer, not off a photograph: they say what the *drawing*
 * looks like, which is what has to match.
 */
const EYE_APERTURE = {
  line: 0.05, closed: 0.06, slit: 0.12, sleepy: 0.2, squint: 0.16, angry: 0.22,
  glare: 0.3, dot: 0.5, beady: 0.42, oval: 0.38, wonky: 0.38, mismatched: 0.36,
  sideways: 0.34, hollow: 0.55, teary: 0.45, round: 0.7, wide: 0.85, googly: 0.95,
  cross: 0.5, star: 0.6, spiral: 0.6, wink: 0.3,
};

/** Roughly how much crown a hairstyle piles up, and how far it hangs. */
const HAIR_VOLUME = {
  none: 0, buzz: 0.12, shortHatch: 0.3, receding: 0.22, combover: 0.35, flatTop: 0.5,
  bowl: 0.6, fringe: 0.55, waves: 0.6, messy: 0.75, mop: 0.85, bob: 0.6, curly: 1.0,
  spiky: 0.9, pompadour: 1.0, afro: 1.6, long: 0.7, dreads: 0.8, ponytail: 0.6,
  bun: 0.7, topknot: 0.8, pigtails: 0.6, mohawk: 1.2, shavedSides: 0.7, braids: 0.6,
  cornrows: 0.35, sidePuffs: 0.8,
};
const HAIR_SIDE = {
  none: 0, buzz: 0, shortHatch: 0.02, receding: 0, combover: 0.02, flatTop: 0.02,
  bowl: 0.12, fringe: 0.1, waves: 0.2, messy: 0.12, mop: 0.2, bob: 0.45, curly: 0.25,
  spiky: 0.05, pompadour: 0.05, afro: 0.3, long: 0.8, dreads: 0.7, ponytail: 0.2,
  bun: 0.05, topknot: 0.05, pigtails: 0.5, mohawk: 0, shavedSides: 0.05,
  braids: 0.7, cornrows: 0.05, sidePuffs: 0.4,
};

/** Which way each mouth style bends, for scoring against the measured curve. */
const MOUTH_CURVE = {
  smile: 1, grin: 1, teeth: 0.6, smirk: 0.4, open: 0.2, o: 0, dot: 0, line: 0,
  wavy: 0, pursed: -0.1, stitched: 0, zigzag: 0, gap: 0.3, buck: 0.3, tongue: 0.5,
  fangs: 0.3, drool: 0, frown: -1,
};

/**
 * Styles the fit will not choose on its own.
 *
 * These are jokes, not shapes: a tear, a spiral, a lolling tongue. They are
 * lovely on a stranger from the contact sheet and unwelcome on a portrait of
 * somebody who handed over their own photograph — and because scoring rewards
 * whichever style sits nearest the measurement, `teary` happened to match a
 * common eye aperture almost exactly and so turned up on nearly every fit.
 *
 * They stay reachable: pinning one in the sidebar still wins, as pins always do.
 */
const NOT_FOR_A_LIKENESS = {
  eyes: ['cross', 'star', 'spiral', 'googly', 'teary', 'wink', 'closed', 'hollow', 'sideways', 'mismatched'],
  mouth: ['tongue', 'drool', 'fangs', 'stitched', 'zigzag', 'buck', 'gap'],
  beard: ['handlebar', 'fuManchu', 'braided', 'neckbeard'],
  nose: ['snout', 'broken'],
  brows: ['zigzag'],
};

/** Drop the gag styles, unless that would leave nothing to choose from. */
function sober(key, list) {
  const blocked = NOT_FOR_A_LIKENESS[key];
  if (!blocked) return list;
  const kept = list.filter((v) => !blocked.includes(v));
  return kept.length ? kept : list;
}

/**
 * Build a weight table biased towards `keys`.
 *
 * The whole domain has to be written out, not just the winners: the generator
 * merges weight tables key by key over its defaults, so naming only the
 * favoured styles would leave every other style at its ordinary weight and a
 * "definitely bushy" table would still hand back a bald brow a third of the
 * time. The losers keep a weight of one so nothing becomes unreachable.
 */
function favour(domain, keys, strength = 26) {
  const out = {};
  for (const k of domain) out[k] = 1;
  for (const k of keys) if (k in out) out[k] = strength;
  return out;
}

/**
 * Nearest head shape.
 *
 * The generator already carries a table of what each named skull means in
 * numbers, so this is a plain nearest-neighbour over that table. Aspect gets
 * the heaviest vote: it is both the best-measured quantity and the one a viewer
 * notices first.
 */
function nearestHead(target) {
  let best = 'round';
  let bestD = Infinity;
  for (const [name, m] of Object.entries(HEAD_METRICS)) {
    const d =
      3.2 * (m.w / m.h - target.aspect) ** 2 +
      1.6 * (m.jaw - target.jaw) ** 2 +
      1.1 * (m.brow - target.brow) ** 2 +
      0.35 * ((m.exp || 2.05) / 2.05 - target.exp / 2.05) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

/**
 * Read a measurement and decide what to ask the generator for.
 *
 * Returned separately from the fitting so the UI can show *why* it chose what
 * it chose, and so the caller's own pins can be layered on top.
 *
 * @param {object} m measurement from `measureFace`
 * @returns {{weights: object, targets: object, notes: string[], hat: string|null}}
 */
export function readMeasurement(m) {
  const notes = [];
  const trust = clamp(0.45 + m.confidence * 0.55, 0.4, 1);
  const norm = { ...PHOTO, ...(m.norms || {}) };

  // ---------------------------------------------------------------- skull ---
  // The chin is measured independently of the eye/mouth ruler, so their
  // disagreement is real information: it says how much of the head is forehead
  // and jaw rather than the middle third.
  const chinT = clamp((m.head.chinY - m.head.crownY) / m.head.headH, 0.72, 1.3);
  const headH = m.head.headH * chinT;

  const aspectF = temper((m.head.faceW / headH) / norm.aspect, trust);
  const jawF = temper(m.ratios.jaw / norm.jaw, trust);
  const browF = temper(m.ratios.brow / norm.brow, trust);
  const fillF = temper(m.ratios.fill / norm.fill, trust * 0.7);

  const targets = {
    // Hold the drawn head's area and move only its proportion, so a wide face
    // does not also arrive as a giant one.
    aspect: clamp(DOODLE.aspect * aspectF, 0.62, 1.18),
    jaw: clamp(DOODLE.jaw * jawF, 0.55, 1.45),
    brow: clamp(DOODLE.brow * browF, 0.68, 1.34),
    exp: clamp(DOODLE.exp * fillF ** 2.2, 1.62, 3.4),

    // Feature lines, as fractions of the head from the crown. The generator
    // wants offsets from its own 0.46 / 0.60 / 0.76, applied in half-heights.
    eyeT: clamp(0.46 / chinT, 0.38, 0.54),
    noseT: clamp(m.nose.t / chinT, 0.5, 0.7),
    mouthT: clamp(0.76 / chinT, 0.66, 0.86),

    eyeSpacing: clamp(DOODLE.eyeSpacing * temper(m.eyes.spacing / norm.eyeSpacing, trust), 0.3, 0.6),
    eyeSize: clamp(DOODLE.eyeSize * temper(m.eyes.width / norm.eyeWidth, trust * 0.85), 0.62, 1.55),
    noseSize: clamp(DOODLE.noseSize * temper(m.nose.width / norm.noseWidth, trust * 0.8), 0.62, 1.5),
    mouthW: clamp(DOODLE.mouthW * temper(m.mouth.width / norm.mouthWidth, trust * 0.85), 0.68, 1.45),

    yaw: m.yaw,
    tilt: m.tilt,
    // The measured curvature is the whole expression signal, and it is a
    // stronger one than any single drawn feature, so it is not tempered.
    expression: clamp(m.mouth.curve * 0.7, -1, 1),
    aperture: m.eyes.aperture,
    hairVolume: m.hair.volume,
    hairSide: m.hair.side,
    mouthCurve: m.mouth.curve,
  };
  targets.head = nearestHead(targets);

  // ----------------------------------------------------------------- eyes ---
  const ap = m.eyes.aperture;
  const eyeSet =
    ap < 0.14 ? ['line', 'closed', 'slit', 'sleepy']
      : ap < 0.24 ? ['sleepy', 'squint', 'slit', 'line', 'angry']
        : ap < 0.4 ? ['oval', 'beady', 'wonky', 'mismatched', 'glare', 'sideways']
          : ap < 0.62 ? ['oval', 'round', 'dot', 'teary', 'wonky']
            : ['round', 'wide', 'googly', 'hollow'];

  // ---------------------------------------------------------------- brows ---
  const bs = m.brows.strength;
  const browSet =
    bs < 0.26 ? ['none', 'sparse', 'thin']
      : bs < 0.6 ? ['thin', 'stubby', 'sparse', 'arched']
        : bs < 1.02 ? ['thick', 'angled', 'arched', 'worried']
          : ['bushy', 'thick', 'angled'];

  // ---------------------------------------------------------------- mouth ---
  const c = m.mouth.curve;
  const mouthSet =
    m.mouth.teeth > 0.2 ? ['teeth', 'grin', 'open', 'smile']
      : c > 0.55 ? ['smile', 'grin', 'smirk']
        : c > 0.18 ? ['smile', 'smirk', 'line', 'wavy']
          : c < -0.45 ? ['frown', 'pursed', 'line']
            : ['line', 'wavy', 'pursed', 'smirk', 'dot'];

  // ----------------------------------------------------------------- nose ---
  const nw = m.nose.width / norm.noseWidth;
  const noseSet =
    nw > 1.25 ? ['wide', 'bulb', 'flat', 'snub']
      : nw < 0.8 ? ['tiny', 'button', 'twoLines', 'long']
        : ['twoLines', 'hook', 'roman', 'triangle', 'button', 'long'];

  // ----------------------------------------------------------------- hair ---
  // A hat has to be ruled out first, or a beanie comes back as an afro. Wool at
  // photo scale is much smoother than strands, so a tall *and* flat crown is
  // headwear, and the hair underneath is whatever little shows.
  let hat = null;
  let volume = m.hair.volume;
  if (m.hair.trusted && volume > 0.92 && m.hair.rough < 9) {
    hat = m.hair.luma > 150 ? 'cap' : 'beanie';
    volume = clamp(volume - 0.8, 0, 1);
    notes.push('smooth, tall crown — read as headwear rather than hair');
  }

  const side = m.hair.side;
  let hairSet;
  if (!m.hair.trusted) {
    hairSet = ['shortHatch', 'messy', 'mop', 'waves', 'buzz', 'fringe'];
    notes.push('hair could not be measured — picked something ordinary');
  } else if (side > 0.5) {
    hairSet = ['long', 'dreads', 'braids', 'bob', 'waves', 'ponytail'];
  } else if (volume < 0.22) {
    hairSet = ['none', 'buzz', 'receding', 'shortHatch'];
  } else if (volume < 0.55) {
    hairSet = ['shortHatch', 'buzz', 'combover', 'flatTop', 'receding', 'cornrows'];
  } else if (volume < 1.05) {
    hairSet = side > 0.28
      ? ['bob', 'mop', 'waves', 'fringe', 'curly']
      : ['messy', 'shortHatch', 'waves', 'bowl', 'fringe', 'spiky'];
  } else if (volume < 1.5) {
    hairSet = ['messy', 'mop', 'curly', 'pompadour', 'spiky'];
  } else {
    // Only genuinely enormous hair. Thick hair swept up measures over 1.0 all
    // the time, and offering an afro at that point put one on people who have
    // nothing of the kind.
    hairSet = ['afro', 'curly', 'mop'];
  }

  const tone = m.hair.luma < 72 ? 'dark' : m.hair.luma < 142 ? 'mid' : 'light';

  // ---------------------------------------------------------------- beard ---
  const b = m.beard;
  let beardSet = null;
  if (b.amount > 1.05) {
    beardSet = b.jawline > 0.55 ? ['full', 'longBeard', 'muttonChops'] : ['goatee', 'vandyke', 'chinStrap'];
  } else if (b.amount > 0.58) {
    beardSet = b.jawline > 0.5 ? ['full', 'chinStrap', 'stubble'] : ['goatee', 'vandyke', 'soulPatch', 'stubble'];
  } else if (b.moustache > 1.05 && b.amount > 0.22) {
    // A high bar, and no flourishes. Stubble reads as *some* darkness on the
    // upper lip on almost everybody, and at the old threshold a three-day beard
    // came back as a waxed handlebar on a third of a corpus.
    beardSet = ['mustache', 'stubble'];
  } else if (b.amount > 0.3) {
    beardSet = ['stubble', 'soulPatch', 'none'];
  } else {
    beardSet = ['none'];
  }

  // -------------------------------------------------------------- glasses ---
  let glassesSet = null;
  if (m.glasses.amount > 0.78) {
    glassesSet = m.glasses.dark ? ['sunglasses', 'aviator'] : ['round', 'square', 'halfRim', 'cateye'];
  } else if (m.glasses.amount > 0.52) {
    glassesSet = ['none', 'round', 'square', 'halfRim'];
  }

  /**
   * The styles the measurement is willing to accept, per trait.
   *
   * Kept on the result rather than folded straight into weights, because the
   * candidate search needs them too. Weights alone let an off-list style
   * through: at a few percent a piece, a few of two hundred candidates are
   * outliers, and if one of those happened to score best on the traits that
   * *were* scored it won — which is how "another take" on a long-bearded face
   * came back with a moustache. Same person, please.
   */
  const sets = {
    head: [targets.head],
    eyes: sober('eyes', eyeSet),
    brows: sober('brows', browSet),
    nose: sober('nose', noseSet),
    mouth: sober('mouth', mouthSet),
    hair: hairSet,
    beard: sober('beard', beardSet),
    glasses: glassesSet || ['none'],
  };

  const weights = {
    head: favour(HEAD_SHAPES, sets.head, 200),
    eyes: favour(EYE_STYLES, sets.eyes, 60),
    brows: favour(BROW_STYLES, sets.brows, 60),
    nose: favour(NOSE_STYLES, sets.nose, 40),
    mouth: favour(MOUTH_STYLES, sets.mouth, 60),
    hair: favour(HAIR_STYLES, sets.hair, 90),
    beard: favour(BEARD_STYLES, sets.beard, 200),
    hat: favour(HAT_STYLES, [hat || 'none'], hat ? 60 : 400),
    glasses: favour(GLASSES_STYLES, sets.glasses, glassesSet ? 120 : 400),
  };

  /**
   * Pins, for the things that are either there or not.
   *
   * A weight table is the wrong instrument for absence: leaving headwear at
   * "unlikely" still puts a fez on one portrait in thirty, and a party hat
   * nobody asked for on their own face is not a charming surprise. Worse, any
   * crown-covering hat blanks the hair underneath, so a stray hat also throws
   * away a trait that *was* measured. Absence gets pinned; presence stays a
   * weighted choice, so the search can still pick between a goatee and a
   * vandyke.
   */
  const force = { hat: hat || 'none' };
  if (!glassesSet) force.glasses = 'none';
  if (beardSet.length === 1 && beardSet[0] === 'none') force.beard = 'none';

  return { weights, force, sets, targets, notes: notes.concat(m.notes || []), tone, hat };
}

/**
 * Apply the measured numbers to a genome, in place.
 *
 * Assignment rather than multiplication: there is a real measurement behind
 * each of these, so there is nothing to be gained by leaving the seed's own
 * guess in the mix. Kin scale still applies, so fitting a photo onto a gnome
 * keeps the gnome's enormous nose *and* the sitter's proportions.
 */
function applyTargets(g, t, m) {
  const kin = resolveKin(g.kin);

  // Hold the area, move the proportion.
  const area = DOODLE.area;
  g.head.w = clamp(Math.sqrt(area * t.aspect) * kin.metrics.w, 23, 42);
  g.head.h = clamp(Math.sqrt(area / t.aspect) * kin.metrics.h, 26, 47);
  g.head.jaw = clamp(t.jaw * kin.metrics.jaw, 0.5, 1.5);
  g.head.brow = clamp(t.brow * kin.metrics.brow, 0.6, 1.4);
  g.head.exp = clamp(t.exp * kin.metrics.exp, 1.55, 3.5);
  g.head.yaw = t.yaw;
  g.head.tilt = t.tilt;
  // The lopsided-skull flourish is charming on a stranger and unkind on
  // somebody's own face, so it goes.
  g.head.lopsided = 0;

  // Feature lines: the genome stores offsets from the renderer's own 0.46 /
  // 0.60 / 0.76, measured in half-heights, hence the factor of two.
  g.eyes.y = clamp(2 * (t.eyeT - 0.46), -0.1, 0.1) + kin.lines.eye;
  g.nose.y = clamp(2 * (t.noseT - 0.6), -0.1, 0.1) + kin.lines.nose;
  g.mouth.y = clamp(2 * (t.mouthT - 0.76), -0.1, 0.1) + kin.lines.mouth;

  g.eyes.spacing = clamp(t.eyeSpacing * kin.scale.eyeGap, 0.28, 0.62);
  g.eyes.size = clamp(t.eyeSize * kin.scale.eye, 0.55, 1.7);
  g.nose.size = clamp(t.noseSize * kin.scale.nose, 0.55, 1.7);
  g.mouth.w = clamp(t.mouthW * kin.scale.mouth, 0.6, 1.6);
  g.mouth.x = 0;
  g.nose.x = 0;

  // Half the asymmetry, not none: a perfectly even face stops looking drawn.
  g.eyes.asym *= 0.45;
  g.eyes.tiltAsym *= 0.45;
  g.eyes.heightAsym *= 0.45;
  g.hair.asym *= 0.6;

  g.expression = t.expression;
  if (m) {
    g.hair.tone = m.hair.luma < 72 ? 'dark' : m.hair.luma < 142 ? 'mid' : 'light';
    g.beard.tone = g.hair.tone;
    g.marks.freckles = 0;
    g.marks.warts = 0;
  }
  return g;
}

/**
 * How far a candidate's *named* traits sit from the measurement.
 *
 * Only the enums are scored — everything continuous was assigned outright and
 * therefore matches exactly. Lower is better.
 */
function score(g, t, sets) {
  let s = 0;

  /**
   * A flat, heavy penalty for a style the measurement did not offer.
   *
   * Three is far larger than any of the graded terms below can reach, so an
   * off-list style loses to an on-list one however well it fits otherwise.
   * Without it the graded terms actively *preferred* outliers: a bun and a
   * shaved-sides crop both happen to sit at the middling hair volume this face
   * measured, so they beat every style the reading had actually chosen.
   */
  for (const [key, style] of [
    ['eyes', g.eyes.style], ['brows', g.brows.style], ['nose', g.nose.style],
    ['mouth', g.mouth.style], ['hair', g.hair.style], ['beard', g.beard.style],
    ['glasses', g.glasses.style], ['head', g.head.shape],
  ]) {
    // Hair is the exception: a hat legitimately replaces it with a fringe or
    // nothing at all, and that is the generator's decision, not a stray pick.
    if (key === 'hair' && g.hat.style !== 'none') continue;
    if (sets && sets[key] && !sets[key].includes(style)) s += 3;
  }

  const ap = EYE_APERTURE[g.eyes.style];
  if (ap !== undefined) s += 2.4 * (ap - t.aperture) ** 2;

  // Hair carries the heaviest weights, and not because it is measured best —
  // it is measured worst. It is simply the trait a viewer checks first, so a
  // candidate that nails the eyes and gives a bald man a fringe has to lose.
  const vol = HAIR_VOLUME[g.hair.style];
  if (vol !== undefined) s += 4 * (vol - clamp(t.hairVolume, 0, 1.8)) ** 2;
  const side = HAIR_SIDE[g.hair.style];
  if (side !== undefined) s += 4 * (side - t.hairSide) ** 2;

  const mc = MOUTH_CURVE[g.mouth.style];
  if (mc !== undefined) s += 0.9 * (mc - clamp(t.mouthCurve, -1, 1)) ** 2;

  const hm = HEAD_METRICS[g.head.shape];
  if (hm) s += 1.2 * (hm.w / hm.h - t.aspect) ** 2;
  return s;
}

/** Nearest accent colour to an RGB triple, by plain squared distance. */
function nearestHue(rgb) {
  let best = 'terracotta';
  let bestD = Infinity;
  for (const [name, css] of Object.entries(ACCENT_COLORS)) {
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(css);
    if (!m) continue;
    const d = (+m[1] - rgb[0]) ** 2 + (+m[2] - rgb[1]) ** 2 + (+m[3] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

/**
 * Fit a genome to a photo measurement.
 *
 * @param {object} m        measurement from `measureFace`
 * @param {object} [opts]
 * @param {string} [opts.seed='photo'] root seed; the same photo and seed always
 *   give the same face, so a fitted portrait is as shareable as any other
 * @param {number} [opts.tries=240] how many candidates to score
 * @param {object} [opts.force]   caller's pins, layered over the fit's own
 * @param {object} [opts.weights] caller's weights, under the fit's
 * @param {number} [opts.color]   colour amount, as elsewhere
 * @returns {{genome: object, read: object, tried: number}}
 */
export function fitGenome(m, opts = {}) {
  const read = readMeasurement(m);
  const seed = opts.seed || 'photo';
  const tries = Math.max(1, opts.tries ?? 240);

  const genomeOpts = {
    ...opts,
    // The fit's tables sit *under* the caller's, so a pinned kin or a hand-set
    // hairstyle still wins — the photo informs the choice, it does not seize it.
    weights: { ...read.weights, ...(opts.weights || {}) },
    force: { kin: 'human', ...read.force, ...(opts.force || {}) },
    mood: read.targets.expression,
  };

  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < tries; i++) {
    const g = makeGenome(`${seed}#${i}`, genomeOpts);
    const s = score(g, read.targets, read.sets);
    if (s < bestScore) {
      bestScore = s;
      best = g;
    }
  }
  applyTargets(best, read.targets, m);

  // One colour accent, taken from the sitter: hair if there is any to tint,
  // otherwise the skin. More than one and it stops reading as a likeness.
  if ((opts.color ?? 1) > 0) {
    const rng = makeRng(`${seed}:accent`);
    const onHair = best.hair.style !== 'none' && best.hair.tone !== 'dark' && m.hair.rgb;
    const rgb = onHair ? m.hair.rgb : m.skin.rgb;
    const hue = nearestHue(rgb);
    best.accents = [{
      target: onHair ? 'hair' : 'skin',
      hue,
      color: ACCENT_COLORS[hue],
      offset: [rng.gauss(0, 2.6), rng.gauss(0, 2.6)],
      scale: rng.range(0.92, 1.12),
      rotate: rng.gauss(0, 0.05),
      alpha: rng.range(0.5, 0.72),
      wobble: rng.range(0.9, 1.7),
      x: 0,
      y: 0,
      size: 1,
    }];
  } else {
    best.accents = [];
  }

  best.seed = `${seed}#fit`;
  return { genome: best, read, tried: tries, score: bestScore };
}

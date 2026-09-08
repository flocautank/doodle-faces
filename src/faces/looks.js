/**
 * Looks — the archetype a face is playing.
 *
 * Where `kin` decides the skull, a look decides the styling: what the hair is
 * doing, whether there are piercings, which colours turn up. It is a bias, not
 * a costume — a punk still gets a randomly generated nose.
 *
 * `props` values are probabilities in 0..1.
 */

export const LOOK_NAMES = [
  'plain', 'finance', 'punk', 'hippie', 'bobo', 'goth', 'metal',
  'sailor', 'scholar', 'raver', 'farmer', 'artist',
  'wizard', 'noble', 'soldier', 'clown', 'detective',
];

export const LOOK_WEIGHTS = {
  plain: 58, finance: 4, punk: 5, hippie: 4, bobo: 5, goth: 3, metal: 3,
  sailor: 3, scholar: 3, raver: 2, farmer: 3, artist: 2,
  wizard: 2, noble: 2, soldier: 3, clown: 1, detective: 2,
};

const PLAIN = {
  label: 'Plain',
  weights: {},
  props: {},
  hues: null, // null = the whole palette
  colorBias: 1,
};

export const LOOKS = {
  plain: PLAIN,

  finance: {
    label: 'Finance bro',
    weights: {
      hair: { none: 0, buzz: 8, shortHatch: 22, flatTop: 6, messy: 2, mop: 2, curly: 2, spiky: 2, long: 0, bob: 0, fringe: 2, receding: 10, mohawk: 0, bun: 0, pigtails: 0, combover: 30, afro: 0, dreads: 0, ponytail: 0, topknot: 0, shavedSides: 12 },
      beard: { none: 62, stubble: 20, mustache: 2, goatee: 4, full: 4, chinStrap: 2, sideburns: 4, soulPatch: 2, muttonChops: 0, longBeard: 0, braided: 0 },
      glasses: { none: 58, round: 4, square: 18, sunglasses: 12, halfRim: 8, monocle: 0 },
      hat: { none: 88, beanie: 1, cap: 2, bandana: 0, headband: 0, tophat: 1, beret: 0, flatCap: 0, hood: 0 },
      mouth: { line: 22, smile: 12, frown: 8, open: 4, wavy: 4, smirk: 34, teeth: 6, o: 2, pursed: 6, grin: 2, tongue: 0, fangs: 0, gap: 0 },
    },
    props: { earring: 0.05 },
    hues: ['slate', 'sky', 'ash'],
    colorBias: 0.5,
  },

  punk: {
    label: 'Street punk',
    weights: {
      hair: { none: 2, buzz: 8, shortHatch: 2, flatTop: 2, messy: 12, mop: 2, curly: 2, spiky: 22, long: 4, bob: 0, fringe: 2, receding: 0, mohawk: 30, bun: 0, pigtails: 2, combover: 0, afro: 0, dreads: 12, ponytail: 2, topknot: 2, shavedSides: 20 },
      beard: { none: 46, stubble: 22, mustache: 4, goatee: 12, full: 6, chinStrap: 4, sideburns: 6, soulPatch: 8, muttonChops: 4, longBeard: 0, braided: 4 },
      glasses: { none: 78, round: 4, square: 2, sunglasses: 16, halfRim: 0, monocle: 0 },
      hat: { none: 88, beanie: 8, cap: 2, bandana: 8, headband: 2, tophat: 0, beret: 0, flatCap: 0, hood: 4 },
      mouth: { line: 10, smile: 6, frown: 16, open: 8, wavy: 8, smirk: 22, teeth: 6, o: 2, pursed: 2, grin: 12, tongue: 8, fangs: 2, gap: 8 },
    },
    props: { earring: 0.6, nosePiercing: 0.45, tattoo: 0.3, scar: 0.12, cigarette: 0.22, eyeliner: 0.2 },
    hues: ['brick', 'teal', 'plum', 'mustard'],
    colorBias: 2.2,
  },

  hippie: {
    label: 'Hippie',
    weights: {
      hair: { none: 0, buzz: 0, shortHatch: 2, flatTop: 0, messy: 12, mop: 10, curly: 12, spiky: 2, long: 30, bob: 2, fringe: 4, receding: 2, mohawk: 0, bun: 8, pigtails: 4, combover: 0, afro: 8, dreads: 14, ponytail: 10, topknot: 4, shavedSides: 0 },
      beard: { none: 22, stubble: 6, mustache: 12, goatee: 10, full: 22, chinStrap: 2, sideburns: 6, soulPatch: 4, muttonChops: 4, longBeard: 16, braided: 6 },
      glasses: { none: 68, round: 22, square: 1, sunglasses: 6, halfRim: 3, monocle: 0 },
      hat: { none: 78, beanie: 8, cap: 2, bandana: 18, headband: 14, tophat: 0, beret: 2, flatCap: 0, hood: 0 },
      mouth: { line: 10, smile: 34, frown: 2, open: 8, wavy: 10, smirk: 10, teeth: 8, o: 4, pursed: 4, grin: 8, tongue: 2, fangs: 0, gap: 2 },
    },
    props: { earring: 0.35, tattoo: 0.12 },
    hues: ['sage', 'mustard', 'terracotta', 'olive', 'brick'],
    colorBias: 2.4,
  },

  bobo: {
    label: 'Hipster',
    weights: {
      hair: { none: 0, buzz: 4, shortHatch: 8, flatTop: 2, messy: 10, mop: 6, curly: 6, spiky: 2, long: 6, bob: 8, fringe: 6, receding: 2, mohawk: 0, bun: 14, pigtails: 2, combover: 4, afro: 2, dreads: 0, ponytail: 4, topknot: 18, shavedSides: 8 },
      beard: { none: 26, stubble: 16, mustache: 8, goatee: 8, full: 26, chinStrap: 4, sideburns: 4, soulPatch: 4, muttonChops: 2, longBeard: 2, braided: 0 },
      glasses: { none: 62, round: 20, square: 11, sunglasses: 3, halfRim: 5, monocle: 0 },
      hat: { none: 81, beanie: 22, cap: 2, bandana: 0, headband: 0, tophat: 0, beret: 8, flatCap: 2, hood: 0 },
    },
    props: { earring: 0.2, tattoo: 0.1 },
    hues: ['sage', 'terracotta', 'ash', 'olive'],
    colorBias: 1.6,
  },

  goth: {
    label: 'Goth',
    weights: {
      hair: { none: 0, buzz: 2, shortHatch: 2, flatTop: 0, messy: 8, mop: 4, curly: 4, spiky: 6, long: 24, bob: 16, fringe: 18, receding: 0, mohawk: 4, bun: 4, pigtails: 4, combover: 0, afro: 0, dreads: 2, ponytail: 4, topknot: 2, shavedSides: 6 },
      beard: { none: 78, stubble: 6, mustache: 2, goatee: 6, full: 2, chinStrap: 0, sideburns: 2, soulPatch: 4, muttonChops: 0, longBeard: 0, braided: 0 },
      glasses: { none: 76, round: 8, square: 4, sunglasses: 12, halfRim: 0, monocle: 0 },
      mouth: { line: 16, smile: 2, frown: 26, open: 4, wavy: 8, smirk: 22, teeth: 2, o: 4, pursed: 12, grin: 2, tongue: 0, fangs: 2, gap: 0 },
    },
    props: { eyeliner: 0.85, lipstick: 0.6, earring: 0.45, nosePiercing: 0.3, tattoo: 0.12 },
    hues: ['plum', 'slate', 'teal'],
    colorBias: 1.2,
  },

  metal: {
    label: 'Metalhead',
    weights: {
      hair: { none: 0, buzz: 2, shortHatch: 2, flatTop: 0, messy: 14, mop: 6, curly: 6, spiky: 8, long: 36, bob: 0, fringe: 4, receding: 4, mohawk: 4, bun: 2, pigtails: 0, combover: 0, afro: 2, dreads: 6, ponytail: 8, topknot: 2, shavedSides: 4 },
      beard: { none: 24, stubble: 12, mustache: 6, goatee: 14, full: 22, chinStrap: 2, sideburns: 6, soulPatch: 4, muttonChops: 4, longBeard: 12, braided: 6 },
      hat: { none: 85, beanie: 6, cap: 2, bandana: 18, headband: 0, tophat: 0, beret: 0, flatCap: 0, hood: 0 },
      glasses: { none: 80, round: 2, square: 2, sunglasses: 16, halfRim: 0, monocle: 0 },
    },
    props: { earring: 0.4, tattoo: 0.25, scar: 0.1 },
    hues: ['brick', 'slate', 'plum'],
    colorBias: 1.1,
  },

  sailor: {
    label: 'Sailor',
    weights: {
      hair: { none: 6, buzz: 12, shortHatch: 18, flatTop: 4, messy: 12, mop: 4, curly: 6, spiky: 4, long: 6, bob: 0, fringe: 2, receding: 12, mohawk: 0, bun: 2, pigtails: 0, combover: 6, afro: 2, dreads: 2, ponytail: 4, topknot: 0, shavedSides: 2 },
      beard: { none: 14, stubble: 14, mustache: 10, goatee: 6, full: 26, chinStrap: 8, sideburns: 4, soulPatch: 2, muttonChops: 8, longBeard: 14, braided: 4 },
      hat: { none: 63, beanie: 34, cap: 12, bandana: 10, headband: 0, tophat: 0, beret: 0, flatCap: 10, hood: 0 },
    },
    props: { earring: 0.35, tattoo: 0.3, scar: 0.2, cigarette: 0.2 },
    hues: ['sky', 'slate', 'teal', 'brick'],
    colorBias: 1.5,
  },

  scholar: {
    label: 'Academic',
    weights: {
      hair: { none: 4, buzz: 4, shortHatch: 14, flatTop: 2, messy: 14, mop: 6, curly: 6, spiky: 2, long: 4, bob: 4, fringe: 4, receding: 20, mohawk: 0, bun: 4, pigtails: 0, combover: 14, afro: 2, dreads: 0, ponytail: 4, topknot: 2, shavedSides: 0 },
      beard: { none: 34, stubble: 10, mustache: 16, goatee: 12, full: 14, chinStrap: 2, sideburns: 4, soulPatch: 2, muttonChops: 4, longBeard: 6, braided: 0 },
      glasses: { none: 44, round: 20, square: 14, sunglasses: 2, halfRim: 18, monocle: 4 },
      hat: { none: 88, beanie: 4, cap: 0, bandana: 0, headband: 0, tophat: 2, beret: 6, flatCap: 4, hood: 0 },
    },
    props: {},
    hues: ['ash', 'olive', 'terracotta'],
    colorBias: 0.7,
  },

  raver: {
    label: 'Raver',
    weights: {
      hair: { none: 2, buzz: 8, shortHatch: 4, flatTop: 2, messy: 10, mop: 4, curly: 6, spiky: 14, long: 6, bob: 6, fringe: 6, receding: 0, mohawk: 8, bun: 6, pigtails: 8, combover: 0, afro: 4, dreads: 8, ponytail: 4, topknot: 6, shavedSides: 14 },
      glasses: { none: 70, round: 7, square: 3, sunglasses: 20, halfRim: 0, monocle: 0 },
      hat: { none: 83, beanie: 10, cap: 8, bandana: 6, headband: 6, tophat: 0, beret: 0, flatCap: 0, hood: 0 },
      mouth: { line: 6, smile: 20, frown: 2, open: 16, wavy: 8, smirk: 12, teeth: 10, o: 10, pursed: 2, grin: 10, tongue: 12, fangs: 0, gap: 2 },
    },
    props: { earring: 0.5, nosePiercing: 0.35, eyeliner: 0.35, tattoo: 0.2 },
    hues: ['teal', 'plum', 'sky', 'mustard', 'rose'],
    colorBias: 2.8,
  },

  farmer: {
    label: 'Farmer',
    weights: {
      hair: { none: 6, buzz: 8, shortHatch: 20, flatTop: 6, messy: 18, mop: 6, curly: 4, spiky: 2, long: 4, bob: 0, fringe: 2, receding: 16, mohawk: 0, bun: 0, pigtails: 0, combover: 10, afro: 0, dreads: 0, ponytail: 2, topknot: 0, shavedSides: 0 },
      beard: { none: 30, stubble: 24, mustache: 14, goatee: 4, full: 14, chinStrap: 4, sideburns: 6, soulPatch: 0, muttonChops: 6, longBeard: 6, braided: 0 },
      hat: { none: 67, beanie: 8, cap: 30, bandana: 6, headband: 0, tophat: 0, beret: 0, flatCap: 16, hood: 0 },
    },
    props: { scar: 0.12, cigarette: 0.14 },
    hues: ['mustard', 'olive', 'terracotta', 'brick'],
    colorBias: 1.3,
  },

  artist: {
    label: 'Artist',
    weights: {
      hair: { none: 2, buzz: 4, shortHatch: 4, flatTop: 2, messy: 20, mop: 8, curly: 10, spiky: 6, long: 10, bob: 6, fringe: 6, receding: 4, mohawk: 2, bun: 10, pigtails: 2, combover: 2, afro: 4, dreads: 2, ponytail: 4, topknot: 10, shavedSides: 4 },
      glasses: { none: 64, round: 20, square: 8, sunglasses: 4, halfRim: 3, monocle: 2 },
      hat: { none: 79, beanie: 12, cap: 2, bandana: 4, headband: 2, tophat: 2, beret: 16, flatCap: 0, hood: 0 },
    },
    props: { earring: 0.3, tattoo: 0.18, eyeliner: 0.15, lipstick: 0.15 },
    hues: null,
    colorBias: 3,
  },

  wizard: {
    label: 'Wizard',
    weights: {
      hair: { none: 2, buzz: 0, shortHatch: 2, flatTop: 0, messy: 12, mop: 4, curly: 6, spiky: 2, long: 34, bob: 0, fringe: 2, receding: 16, mohawk: 0, bun: 4, pigtails: 0, combover: 2, afro: 2, dreads: 2, ponytail: 6, topknot: 2, shavedSides: 0, bowl: 0, pompadour: 0, braids: 4, waves: 4, cornrows: 0, sidePuffs: 0 },
      beard: { none: 6, stubble: 2, mustache: 6, goatee: 6, full: 20, chinStrap: 0, sideburns: 2, soulPatch: 0, muttonChops: 2, longBeard: 40, braided: 10, handlebar: 4, fuManchu: 4, neckbeard: 0, vandyke: 4 },
      hat: { none: 40, beanie: 2, cap: 0, bandana: 2, headband: 2, tophat: 4, beret: 2, flatCap: 0, hood: 14, fez: 4, crown: 2, helmet: 0, cowboy: 0, wizard: 26, nightcap: 4 },
      glasses: { none: 62, round: 12, square: 2, sunglasses: 0, halfRim: 10, monocle: 10, aviator: 0, cateye: 0, goggles: 0, pince: 8 },
      eyes: { oval: 10, dot: 6, line: 6, wide: 8, sleepy: 10, squint: 14, round: 6, wonky: 6, wink: 4, cross: 0, star: 6, spiral: 8, mismatched: 6, closed: 6, glare: 8, beady: 4, googly: 0, slit: 2, hollow: 4, sideways: 2, angry: 2, teary: 0 },
    },
    props: { earring: 0.15 },
    hues: ['plum', 'slate', 'sky', 'teal'],
    colorBias: 1.8,
  },

  noble: {
    label: 'Noble',
    weights: {
      hair: { none: 2, buzz: 2, shortHatch: 14, flatTop: 2, messy: 2, mop: 4, curly: 12, spiky: 0, long: 12, bob: 8, fringe: 4, receding: 6, mohawk: 0, bun: 10, pigtails: 2, combover: 12, afro: 2, dreads: 0, ponytail: 8, topknot: 2, shavedSides: 0, bowl: 2, pompadour: 12, braids: 6, waves: 8, cornrows: 0, sidePuffs: 2 },
      beard: { none: 52, stubble: 4, mustache: 10, goatee: 10, full: 4, chinStrap: 2, sideburns: 4, soulPatch: 2, muttonChops: 4, longBeard: 2, braided: 2, handlebar: 12, fuManchu: 2, neckbeard: 0, vandyke: 10 },
      hat: { none: 56, beanie: 0, cap: 0, bandana: 0, headband: 4, tophat: 16, beret: 6, flatCap: 2, hood: 2, fez: 4, crown: 14, helmet: 0, cowboy: 0, wizard: 0, nightcap: 0 },
      glasses: { none: 70, round: 6, square: 2, sunglasses: 0, halfRim: 6, monocle: 14, aviator: 0, cateye: 0, goggles: 0, pince: 8 },
      mouth: { line: 16, smile: 10, frown: 10, open: 2, wavy: 4, smirk: 30, teeth: 2, o: 2, pursed: 16, grin: 2, tongue: 0, fangs: 0, gap: 0, zigzag: 0, buck: 2, drool: 0, stitched: 0, dot: 4 },
    },
    props: { earring: 0.25 },
    hues: ['plum', 'brick', 'mustard', 'slate'],
    colorBias: 1.7,
  },

  soldier: {
    label: 'Soldier',
    weights: {
      hair: { none: 6, buzz: 30, shortHatch: 22, flatTop: 14, messy: 4, mop: 2, curly: 2, spiky: 4, long: 2, bob: 0, fringe: 0, receding: 4, mohawk: 4, bun: 1, pigtails: 0, combover: 2, afro: 1, dreads: 1, ponytail: 3, topknot: 1, shavedSides: 10, bowl: 0, pompadour: 1, braids: 2, waves: 1, cornrows: 4, sidePuffs: 0 },
      beard: { none: 46, stubble: 24, mustache: 10, goatee: 4, full: 6, chinStrap: 4, sideburns: 4, soulPatch: 2, muttonChops: 2, longBeard: 2, braided: 2, handlebar: 4, fuManchu: 0, neckbeard: 0, vandyke: 2 },
      hat: { none: 46, beanie: 6, cap: 8, bandana: 10, headband: 4, tophat: 0, beret: 8, flatCap: 0, hood: 4, fez: 0, crown: 0, helmet: 26, cowboy: 2, wizard: 0, nightcap: 0 },
      eyes: { oval: 10, dot: 6, line: 10, wide: 2, sleepy: 4, squint: 20, round: 4, wonky: 4, wink: 2, cross: 0, star: 0, spiral: 0, mismatched: 4, closed: 2, glare: 24, beady: 8, googly: 0, slit: 0, hollow: 2, sideways: 2, angry: 16, teary: 0 },
      brows: { none: 4, thin: 4, thick: 24, angled: 30, arched: 2, bushy: 20, worried: 4, zigzag: 0, stubby: 10, sparse: 2 },
    },
    props: { scar: 0.4, tattoo: 0.15, eyepatch: 0.1 },
    hues: ['olive', 'sage', 'brick', 'ash'],
    colorBias: 1.1,
  },

  clown: {
    label: 'Clown',
    weights: {
      hair: { none: 2, buzz: 2, shortHatch: 2, flatTop: 2, messy: 10, mop: 6, curly: 20, spiky: 12, long: 2, bob: 4, fringe: 4, receding: 8, mohawk: 8, bun: 2, pigtails: 8, combover: 2, afro: 20, dreads: 2, ponytail: 2, topknot: 2, shavedSides: 2, bowl: 6, pompadour: 4, braids: 2, waves: 2, cornrows: 0, sidePuffs: 8 },
      eyes: { oval: 6, dot: 6, line: 2, wide: 14, sleepy: 2, squint: 4, round: 14, wonky: 12, wink: 8, cross: 8, star: 10, spiral: 8, mismatched: 14, closed: 4, glare: 0, beady: 2, googly: 14, slit: 0, hollow: 2, sideways: 4, angry: 0, teary: 6 },
      mouth: { line: 2, smile: 24, frown: 8, open: 10, wavy: 8, smirk: 6, teeth: 8, o: 10, pursed: 2, grin: 20, tongue: 10, fangs: 0, gap: 8, zigzag: 6, buck: 6, drool: 2, stitched: 2, dot: 2 },
      nose: { hook: 2, twoLines: 2, triangle: 4, button: 16, long: 4, wide: 6, bulb: 40, snub: 8, broken: 2, snout: 2, roman: 0, beak: 4, tiny: 4, flat: 2 },
      hat: { none: 58, beanie: 4, cap: 4, bandana: 2, headband: 4, tophat: 12, beret: 4, flatCap: 2, hood: 0, fez: 8, crown: 2, helmet: 0, cowboy: 0, wizard: 0, nightcap: 4 },
    },
    props: { lipstick: 0.5, tattoo: 0.1 },
    hues: null,
    colorBias: 3.2,
  },

  detective: {
    label: 'Detective',
    weights: {
      hair: { none: 4, buzz: 4, shortHatch: 22, flatTop: 4, messy: 10, mop: 4, curly: 4, spiky: 2, long: 2, bob: 2, fringe: 2, receding: 16, mohawk: 0, bun: 2, pigtails: 0, combover: 16, afro: 2, dreads: 0, ponytail: 2, topknot: 0, shavedSides: 2, bowl: 2, pompadour: 6, braids: 0, waves: 2, cornrows: 0, sidePuffs: 0 },
      beard: { none: 40, stubble: 28, mustache: 14, goatee: 4, full: 4, chinStrap: 2, sideburns: 4, soulPatch: 0, muttonChops: 2, longBeard: 0, braided: 0, handlebar: 4, fuManchu: 0, neckbeard: 0, vandyke: 4 },
      hat: { none: 34, beanie: 2, cap: 2, bandana: 0, headband: 0, tophat: 8, beret: 2, flatCap: 46, hood: 4, fez: 0, crown: 0, helmet: 0, cowboy: 2, wizard: 0, nightcap: 0 },
      glasses: { none: 68, round: 8, square: 6, sunglasses: 4, halfRim: 6, monocle: 4, aviator: 0, cateye: 0, goggles: 0, pince: 4 },
      eyes: { oval: 12, dot: 6, line: 10, wide: 4, sleepy: 16, squint: 20, round: 4, wonky: 4, wink: 4, cross: 0, star: 0, spiral: 0, mismatched: 4, closed: 2, glare: 10, beady: 6, googly: 0, slit: 0, hollow: 0, sideways: 8, angry: 4, teary: 0 },
    },
    props: { cigarette: 0.45, scar: 0.12 },
    hues: ['ash', 'slate', 'olive', 'terracotta'],
    colorBias: 0.9,
  },
};

export function resolveLook(name) {
  const l = LOOKS[name] || PLAIN;
  return {
    name: LOOKS[name] ? name : 'plain',
    label: l.label,
    weights: l.weights || {},
    props: l.props || {},
    hues: l.hues || null,
    colorBias: l.colorBias === undefined ? 1 : l.colorBias,
  };
}

/** Looks that only make sense on some kin — a goblin finance bro is funnier than a goblin scholar, but a child punk is not a thing. */
export const LOOK_BLOCKLIST = {
  child: ['finance', 'goth', 'metal', 'sailor', 'scholar', 'raver', 'farmer', 'punk', 'detective', 'soldier', 'noble', 'wizard'],
  orc: ['finance', 'scholar', 'bobo', 'noble', 'detective'],
  troll: ['finance', 'scholar', 'bobo', 'goth', 'noble', 'detective', 'clown'],
  undead: ['finance', 'bobo', 'raver', 'clown', 'farmer'],
  beast: ['finance', 'bobo', 'scholar', 'noble', 'detective'],
};

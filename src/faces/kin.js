/**
 * Kin — what sort of creature this is.
 *
 * A kin bundles three things:
 *   metrics : skull proportions, layered on top of the head shape
 *   scale   : how big each feature reads on that skull
 *   weights : which traits are likely (an orc rarely has a neat bob)
 *   traits  : hard switches — tusks, ear shape, brow ridge
 *
 * It is pure data. Nothing here draws; the renderer reads the resolved numbers
 * off the genome, so adding a kin never means touching the drawing code.
 */

export const KIN_NAMES = [
  'human', 'child', 'elder', 'elf', 'dwarf', 'gnome', 'orc', 'troll', 'goblin',
  'undead', 'demon', 'beast',
];

/** How often each kin turns up in a default crowd. */
export const KIN_WEIGHTS = {
  human: 40, child: 9, elder: 8, elf: 6, dwarf: 6, gnome: 5, orc: 6, troll: 4, goblin: 6,
  undead: 4, demon: 3, beast: 3,
};

const HUMAN = {
  label: 'Human',
  metrics: { w: 1, h: 1, jaw: 1, brow: 1, exp: 1 },
  scale: { eye: 1, nose: 1, mouth: 1, brow: 1, ear: 1, eyeGap: 1 },
  // where the feature lines sit down the face, as offsets in normalised height
  lines: { eye: 0, nose: 0, mouth: 0 },
  traits: {},
  weights: {},
};

export const KIN = {
  human: HUMAN,

  child: {
    label: 'Child',
    // big round cranium, features clustered low — the classic baby schema
    metrics: { w: 1.0, h: 0.9, jaw: 0.86, brow: 1.06, exp: 0.95 },
    scale: { eye: 1.45, nose: 0.66, mouth: 0.86, brow: 0.8, ear: 1.1, eyeGap: 1.06 },
    lines: { eye: 0.06, nose: 0.05, mouth: 0.03 },
    traits: { noFacialHair: true },
    weights: {
      eyes: { oval: 14, dot: 16, line: 2, wide: 26, sleepy: 4, squint: 3, round: 26, wonky: 4, wink: 6, cross: 4, star: 6, spiral: 2, mismatched: 6, closed: 3, glare: 0, beady: 2 },
      brows: { none: 40, thin: 20, thick: 6, angled: 6, arched: 14, bushy: 2, worried: 12 },
      nose: { hook: 6, twoLines: 16, triangle: 10, button: 34, long: 2, wide: 6, bulb: 14, snub: 12, broken: 0, snout: 0 },
      mouth: { line: 8, smile: 32, frown: 6, open: 14, wavy: 10, smirk: 6, teeth: 8, o: 10, pursed: 4, grin: 2, tongue: 6, fangs: 0, gap: 4 },
      hair: { none: 2, buzz: 5, shortHatch: 10, flatTop: 3, messy: 16, mop: 14, curly: 14, spiky: 8, long: 7, bob: 9, fringe: 12, receding: 0, mohawk: 1, bun: 5, pigtails: 10, combover: 0, afro: 6, dreads: 2, ponytail: 6, topknot: 2, shavedSides: 0 },
      hat: { none: 80, beanie: 8, cap: 8, bandana: 2, headband: 2, tophat: 0, beret: 0, flatCap: 0, hood: 0 },
    },
  },

  elder: {
    label: 'Elder',
    metrics: { w: 0.98, h: 1.02, jaw: 0.9, brow: 0.96, exp: 1.05 },
    scale: { eye: 0.92, nose: 1.18, mouth: 0.95, brow: 1.25, ear: 1.3, eyeGap: 1 },
    lines: { eye: -0.01, nose: 0.01, mouth: 0.02 },
    traits: { wrinkly: true },
    weights: {
      eyes: { oval: 10, dot: 8, line: 16, wide: 4, sleepy: 24, squint: 22, round: 6, wonky: 8, wink: 2, cross: 1, star: 0, spiral: 0, mismatched: 6, closed: 8, glare: 8, beady: 10 },
      brows: { none: 4, thin: 8, thick: 16, angled: 12, arched: 6, bushy: 40, worried: 14 },
      hair: { none: 18, buzz: 8, shortHatch: 10, flatTop: 2, messy: 10, mop: 4, curly: 4, spiky: 2, long: 5, bob: 2, fringe: 2, receding: 30, mohawk: 0, bun: 3, pigtails: 0, combover: 20, afro: 1, dreads: 0, ponytail: 3, topknot: 1, shavedSides: 0 },
      beard: { none: 30, stubble: 10, mustache: 16, goatee: 10, full: 20, chinStrap: 4, sideburns: 8, soulPatch: 2, muttonChops: 6, longBeard: 14, braided: 2 },
      glasses: { none: 40, round: 16, square: 14, sunglasses: 4, halfRim: 22, monocle: 4 },
    },
  },

  elf: {
    label: 'Elf',
    metrics: { w: 0.86, h: 1.12, jaw: 0.76, brow: 1.02, exp: 0.95 },
    scale: { eye: 1.12, nose: 0.82, mouth: 0.86, brow: 0.85, ear: 1.6, eyeGap: 1.04 },
    lines: { eye: -0.02, nose: -0.01, mouth: 0 },
    traits: { ears: 'pointy', earLong: true },
    weights: {
      eyes: { oval: 16, dot: 4, line: 8, wide: 16, sleepy: 10, squint: 10, round: 10, wonky: 4, wink: 4, cross: 1, star: 4, spiral: 2, mismatched: 4, closed: 4, glare: 6, beady: 2 },
      beard: { none: 84, stubble: 4, mustache: 2, goatee: 4, full: 0, chinStrap: 0, sideburns: 4, soulPatch: 2, muttonChops: 0, longBeard: 0, braided: 0, handlebar: 0, fuManchu: 0, neckbeard: 0, vandyke: 0 },
      hair: { none: 1, buzz: 2, shortHatch: 5, flatTop: 1, messy: 6, mop: 5, curly: 6, spiky: 5, long: 22, bob: 8, fringe: 8, receding: 0, mohawk: 2, bun: 8, pigtails: 3, combover: 1, afro: 2, dreads: 3, ponytail: 14, topknot: 6, shavedSides: 2 },
      hat: { none: 88, beanie: 2, cap: 1, bandana: 3, headband: 6, tophat: 0, beret: 0, flatCap: 0, hood: 0 },
    },
  },

  dwarf: {
    label: 'Dwarf',
    metrics: { w: 1.06, h: 0.95, jaw: 1.2, brow: 1.12, exp: 1.16 },
    scale: { eye: 0.88, nose: 1.42, mouth: 0.92, brow: 1.5, ear: 0.9, eyeGap: 0.96 },
    lines: { eye: -0.03, nose: 0.01, mouth: 0.04 },
    traits: { alwaysBeard: true },
    weights: {
      eyes: { oval: 10, dot: 10, line: 10, wide: 6, sleepy: 8, squint: 18, round: 6, wonky: 8, wink: 4, cross: 1, star: 0, spiral: 0, mismatched: 6, closed: 3, glare: 14, beady: 12 },
      brows: { none: 0, thin: 2, thick: 22, angled: 18, arched: 2, bushy: 46, worried: 10 },
      nose: { hook: 16, twoLines: 4, triangle: 6, button: 4, long: 8, wide: 20, bulb: 34, snub: 2, broken: 12, snout: 0 },
      beard: { none: 0, stubble: 2, mustache: 6, goatee: 4, full: 30, chinStrap: 2, sideburns: 2, soulPatch: 0, muttonChops: 12, longBeard: 30, braided: 22 },
      hair: { none: 4, buzz: 4, shortHatch: 8, flatTop: 2, messy: 12, mop: 8, curly: 6, spiky: 4, long: 16, bob: 2, fringe: 2, receding: 10, mohawk: 6, bun: 4, pigtails: 0, combover: 4, afro: 1, dreads: 6, ponytail: 8, topknot: 6, shavedSides: 2 },
      hat: { none: 76, beanie: 6, cap: 2, bandana: 4, headband: 3, tophat: 1, beret: 0, flatCap: 2, hood: 6 },
    },
  },

  gnome: {
    label: 'Gnome',
    metrics: { w: 0.9, h: 0.94, jaw: 0.82, brow: 0.94, exp: 0.95 },
    scale: { eye: 1.1, nose: 1.7, mouth: 0.82, brow: 1.15, ear: 1.45, eyeGap: 1.02 },
    lines: { eye: -0.02, nose: 0.02, mouth: 0.05 },
    traits: { ears: 'pointy' },
    weights: {
      eyes: { oval: 10, dot: 12, line: 6, wide: 12, sleepy: 6, squint: 12, round: 12, wonky: 12, wink: 6, cross: 4, star: 2, spiral: 4, mismatched: 8, closed: 2, glare: 4, beady: 8 },
      nose: { hook: 24, twoLines: 2, triangle: 8, button: 4, long: 26, wide: 6, bulb: 26, snub: 2, broken: 6, snout: 0 },
      hair: { none: 4, buzz: 2, shortHatch: 4, flatTop: 2, messy: 22, mop: 10, curly: 12, spiky: 12, long: 8, bob: 2, fringe: 4, receding: 8, mohawk: 3, bun: 3, pigtails: 3, combover: 3, afro: 4, dreads: 3, ponytail: 4, topknot: 3, shavedSides: 1 },
      hat: { none: 68, beanie: 12, cap: 4, bandana: 6, headband: 4, tophat: 6, beret: 6, flatCap: 4, hood: 12 },
    },
  },

  orc: {
    label: 'Orc',
    metrics: { w: 1.1, h: 1.02, jaw: 1.3, brow: 1.22, exp: 1.22 },
    scale: { eye: 0.76, nose: 1.25, mouth: 1.25, brow: 1.6, ear: 1.25, eyeGap: 1.1 },
    lines: { eye: -0.04, nose: 0.02, mouth: 0.03 },
    traits: { tusks: 'lower', browRidge: true, ears: 'pointy' },
    weights: {
      eyes: { oval: 6, dot: 12, line: 8, wide: 4, sleepy: 6, squint: 20, round: 4, wonky: 8, wink: 2, cross: 1, star: 0, spiral: 1, mismatched: 6, closed: 2, glare: 24, beady: 16 },
      brows: { none: 2, thin: 2, thick: 26, angled: 30, arched: 2, bushy: 28, worried: 4 },
      nose: { hook: 10, twoLines: 6, triangle: 8, button: 2, long: 4, wide: 34, bulb: 14, snub: 6, broken: 14, snout: 12 },
      mouth: { line: 10, smile: 6, frown: 16, open: 10, wavy: 8, smirk: 18, teeth: 10, o: 2, pursed: 2, grin: 16, tongue: 4, fangs: 20, gap: 4 },
      hair: { none: 16, buzz: 10, shortHatch: 6, flatTop: 4, messy: 10, mop: 3, curly: 2, spiky: 8, long: 10, bob: 0, fringe: 1, receding: 4, mohawk: 16, bun: 2, pigtails: 0, combover: 1, afro: 1, dreads: 10, ponytail: 8, topknot: 6, shavedSides: 10 },
      beard: { none: 44, stubble: 10, mustache: 6, goatee: 8, full: 10, chinStrap: 4, sideburns: 6, soulPatch: 4, muttonChops: 8, longBeard: 4, braided: 10 },
      glasses: { none: 96, round: 1, square: 1, sunglasses: 2, halfRim: 0, monocle: 0 },
      hat: { none: 74, beanie: 2, cap: 2, bandana: 10, headband: 6, tophat: 0, beret: 0, flatCap: 0, hood: 6 },
    },
  },

  troll: {
    label: 'Troll',
    metrics: { w: 0.98, h: 1.16, jaw: 1.3, brow: 0.84, exp: 1.05 },
    scale: { eye: 0.8, nose: 1.5, mouth: 1.35, brow: 1.3, ear: 1.5, eyeGap: 1.12 },
    lines: { eye: -0.08, nose: 0.02, mouth: 0.08 },
    traits: { tusks: 'lower', ears: 'pointy', earLong: true, longJaw: true },
    weights: {
      eyes: { oval: 6, dot: 14, line: 8, wide: 4, sleepy: 14, squint: 14, round: 6, wonky: 12, wink: 2, cross: 2, star: 0, spiral: 2, mismatched: 8, closed: 2, glare: 16, beady: 18 },
      nose: { hook: 26, twoLines: 2, triangle: 6, button: 2, long: 30, wide: 12, bulb: 16, snub: 0, broken: 6, snout: 4 },
      mouth: { line: 8, smile: 6, frown: 14, open: 12, wavy: 12, smirk: 16, teeth: 8, o: 2, pursed: 2, grin: 14, tongue: 8, fangs: 18, gap: 6 },
      hair: { none: 10, buzz: 4, shortHatch: 4, flatTop: 2, messy: 12, mop: 6, curly: 4, spiky: 8, long: 14, bob: 0, fringe: 2, receding: 4, mohawk: 14, bun: 2, pigtails: 2, combover: 1, afro: 2, dreads: 14, ponytail: 8, topknot: 6, shavedSides: 4 },
      hat: { none: 82, beanie: 2, cap: 0, bandana: 8, headband: 6, tophat: 0, beret: 0, flatCap: 0, hood: 2 },
    },
  },

  goblin: {
    label: 'Goblin',
    metrics: { w: 0.88, h: 0.9, jaw: 0.9, brow: 0.88, exp: 0.95 },
    scale: { eye: 1.0, nose: 1.75, mouth: 1.2, brow: 1.05, ear: 2.1, eyeGap: 1.06 },
    lines: { eye: -0.03, nose: 0.03, mouth: 0.06 },
    traits: { ears: 'pointy', earLong: true, tusks: 'single' },
    weights: {
      eyes: { oval: 8, dot: 10, line: 6, wide: 12, sleepy: 4, squint: 16, round: 8, wonky: 14, wink: 6, cross: 4, star: 1, spiral: 4, mismatched: 12, closed: 2, glare: 14, beady: 18 },
      nose: { hook: 30, twoLines: 2, triangle: 8, button: 2, long: 30, wide: 8, bulb: 12, snub: 2, broken: 8, snout: 2 },
      mouth: { line: 6, smile: 8, frown: 8, open: 10, wavy: 10, smirk: 22, teeth: 12, o: 4, pursed: 2, grin: 22, tongue: 8, fangs: 16, gap: 10 },
      hair: { none: 22, buzz: 8, shortHatch: 4, flatTop: 2, messy: 14, mop: 4, curly: 4, spiky: 12, long: 4, bob: 0, fringe: 2, receding: 8, mohawk: 12, bun: 2, pigtails: 2, combover: 2, afro: 2, dreads: 6, ponytail: 4, topknot: 4, shavedSides: 6 },
      hat: { none: 76, beanie: 4, cap: 3, bandana: 6, headband: 3, tophat: 1, beret: 0, flatCap: 1, hood: 6 },
    },
  },

  undead: {
    label: 'Undead',
    // gaunt: a narrow skull with everything pulled tight over it
    metrics: { w: 0.88, h: 1.08, jaw: 0.8, brow: 0.92, exp: 1.1 },
    scale: { eye: 1.05, nose: 0.7, mouth: 1.15, brow: 0.5, ear: 0.85, eyeGap: 1.04 },
    lines: { eye: -0.02, nose: 0.02, mouth: 0.04 },
    traits: { wrinkly: true },
    weights: {
      eyes: { oval: 2, dot: 6, line: 6, wide: 2, sleepy: 4, squint: 6, round: 2, wonky: 8, wink: 0, cross: 8, star: 0, spiral: 4, mismatched: 8, closed: 4, glare: 10, beady: 6, googly: 2, slit: 4, hollow: 30, sideways: 2, angry: 4, teary: 0 },
      brows: { none: 60, thin: 10, thick: 4, angled: 10, arched: 2, bushy: 2, worried: 6, zigzag: 2, stubby: 2, sparse: 22 },
      nose: { hook: 10, twoLines: 22, triangle: 20, button: 0, long: 6, wide: 2, bulb: 2, snub: 2, broken: 10, snout: 0, roman: 2, beak: 6, tiny: 8, flat: 14 },
      mouth: { line: 8, smile: 2, frown: 8, open: 6, wavy: 6, smirk: 8, teeth: 20, o: 2, pursed: 2, grin: 14, tongue: 0, fangs: 8, gap: 12, zigzag: 6, buck: 2, drool: 0, stitched: 14, dot: 2 },
      hair: { none: 44, buzz: 6, shortHatch: 4, flatTop: 0, messy: 12, mop: 2, curly: 1, spiky: 6, long: 10, bob: 1, fringe: 2, receding: 14, mohawk: 2, bun: 1, pigtails: 0, combover: 2, afro: 0, dreads: 4, ponytail: 3, topknot: 1, shavedSides: 2, bowl: 1, pompadour: 0, braids: 1, waves: 1, cornrows: 0, sidePuffs: 0 },
      beard: { none: 74, stubble: 8, mustache: 2, goatee: 2, full: 2, chinStrap: 2, sideburns: 2, soulPatch: 2, muttonChops: 0, longBeard: 4, braided: 0, handlebar: 0, fuManchu: 2, neckbeard: 0, vandyke: 0 },
      glasses: { none: 94, round: 2, square: 1, sunglasses: 1, halfRim: 0, monocle: 2, aviator: 0, cateye: 0, goggles: 0, pince: 0 },
    },
  },

  demon: {
    label: 'Demon',
    metrics: { w: 1.04, h: 1.0, jaw: 1.18, brow: 1.16, exp: 1.14 },
    scale: { eye: 0.9, nose: 1.05, mouth: 1.2, brow: 1.4, ear: 1.15, eyeGap: 1.06 },
    lines: { eye: -0.03, nose: 0.02, mouth: 0.03 },
    traits: { horns: 'curved', ears: 'pointy', browRidge: true, tusks: 'lower' },
    weights: {
      eyes: { oval: 4, dot: 6, line: 4, wide: 4, sleepy: 2, squint: 12, round: 4, wonky: 6, wink: 2, cross: 2, star: 0, spiral: 4, mismatched: 6, closed: 2, glare: 24, beady: 8, googly: 0, slit: 20, hollow: 6, sideways: 2, angry: 16, teary: 0 },
      brows: { none: 2, thin: 2, thick: 18, angled: 34, arched: 2, bushy: 16, worried: 2, zigzag: 6, stubby: 6, sparse: 2 },
      mouth: { line: 6, smile: 4, frown: 10, open: 8, wavy: 6, smirk: 20, teeth: 10, o: 2, pursed: 2, grin: 20, tongue: 4, fangs: 22, gap: 4, zigzag: 6, buck: 0, drool: 2, stitched: 2, dot: 0 },
      hat: { none: 88, beanie: 1, cap: 1, bandana: 4, headband: 3, tophat: 2, beret: 0, flatCap: 0, hood: 6, fez: 0, crown: 4, helmet: 0, cowboy: 0, wizard: 0, nightcap: 0 },
      glasses: { none: 94, round: 1, square: 1, sunglasses: 4, halfRim: 0, monocle: 2, aviator: 2, cateye: 0, goggles: 0, pince: 0 },
    },
  },

  beast: {
    label: 'Beastfolk',
    metrics: { w: 1.06, h: 1.02, jaw: 1.24, brow: 1.0, exp: 1.05 },
    scale: { eye: 0.95, nose: 1.3, mouth: 1.25, brow: 1.15, ear: 1.5, eyeGap: 1.08 },
    lines: { eye: -0.03, nose: 0.03, mouth: 0.05 },
    traits: { ears: 'pointy', tusks: 'lower' },
    weights: {
      eyes: { oval: 6, dot: 8, line: 4, wide: 6, sleepy: 4, squint: 10, round: 8, wonky: 8, wink: 2, cross: 1, star: 0, spiral: 1, mismatched: 6, closed: 2, glare: 14, beady: 10, googly: 2, slit: 18, hollow: 2, sideways: 4, angry: 8, teary: 0 },
      nose: { hook: 4, twoLines: 2, triangle: 10, button: 4, long: 4, wide: 12, bulb: 10, snub: 8, broken: 4, snout: 34, roman: 2, beak: 2, tiny: 0, flat: 4 },
      mouth: { line: 6, smile: 8, frown: 8, open: 10, wavy: 6, smirk: 12, teeth: 10, o: 2, pursed: 2, grin: 18, tongue: 10, fangs: 22, gap: 4, zigzag: 2, buck: 6, drool: 6, stitched: 0, dot: 0 },
      hair: { none: 10, buzz: 8, shortHatch: 10, flatTop: 2, messy: 18, mop: 8, curly: 8, spiky: 12, long: 8, bob: 0, fringe: 2, receding: 2, mohawk: 8, bun: 1, pigtails: 1, combover: 0, afro: 6, dreads: 8, ponytail: 4, topknot: 3, shavedSides: 4, bowl: 1, pompadour: 0, braids: 4, waves: 4, cornrows: 2, sidePuffs: 2 },
      beard: { none: 30, stubble: 26, mustache: 6, goatee: 6, full: 14, chinStrap: 4, sideburns: 10, soulPatch: 2, muttonChops: 10, longBeard: 4, braided: 4, handlebar: 2, fuManchu: 2, neckbeard: 6, vandyke: 2 },
      glasses: { none: 96, round: 1, square: 1, sunglasses: 2, halfRim: 0, monocle: 0, aviator: 0, cateye: 0, goggles: 2, pince: 0 },
    },
  },
};

/** Fill in any missing block from the human baseline. */
export function resolveKin(name) {
  const k = KIN[name] || HUMAN;
  return {
    name: KIN[name] ? name : 'human',
    label: k.label,
    metrics: { ...HUMAN.metrics, ...(k.metrics || {}) },
    scale: { ...HUMAN.scale, ...(k.scale || {}) },
    lines: { ...HUMAN.lines, ...(k.lines || {}) },
    traits: { ...(k.traits || {}) },
    weights: k.weights || {},
  };
}

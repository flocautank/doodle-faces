/**
 * Population presets.
 *
 * A preset never changes how anything is *drawn* — it only changes how common
 * things are. Three dials:
 *   kin      which creatures turn up
 *   look     which archetypes they are playing
 *   weights  partial overrides of DEFAULT_WEIGHTS, for individual traits
 *
 * Pass one as `makeGenome(seed, PRESETS.tavern)` — the shape matches the
 * options object exactly, so a preset *is* a set of options.
 *
 * Add your own here rather than editing genome.js, so the defaults stay put.
 */

export const PRESETS = {
  /** The reference look: a notebook margin, mostly humans, the odd oddity. */
  notebook: {
    label: 'Notebook',
  },

  /** Only people. Nothing fantastical, nothing showy. */
  humans: {
    label: 'Humans only',
    kin: { human: 74, child: 14, elder: 12 },
  },

  /** Faces in a crowd scene — nothing showy, reads well at thumbnail size. */
  crowd: {
    label: 'Crowd',
    kin: { human: 78, child: 10, elder: 12 },
    look: { plain: 78, finance: 4, bobo: 4, scholar: 4, farmer: 4, sailor: 3, metal: 3 },
    weights: {
      hair: { none: 4, buzz: 12, shortHatch: 20, flatTop: 8, messy: 14, mop: 10, curly: 8, spiky: 6, long: 5, bob: 5, fringe: 6, receding: 8, mohawk: 0, bun: 2, pigtails: 2, combover: 6, afro: 3, dreads: 1, ponytail: 3, topknot: 1, shavedSides: 3 },
      hat: { none: 90, beanie: 4, cap: 3, bandana: 1, headband: 0, tophat: 0, beret: 1, flatCap: 1, hood: 0 },
      glasses: { none: 84, round: 6, square: 5, sunglasses: 2, halfRim: 3, monocle: 0 },
      eyes: { oval: 22, dot: 12, line: 8, wide: 10, sleepy: 9, squint: 8, round: 12, wonky: 7, wink: 3, cross: 0, star: 0, spiral: 0, mismatched: 6, closed: 2, glare: 2, beady: 3 },
      mouth: { line: 30, smile: 14, frown: 10, open: 4, wavy: 11, smirk: 11, teeth: 2, o: 2, pursed: 11, grin: 2, tongue: 0, fangs: 0, gap: 1 },
    },
  },

  /** Rounder heads, bigger eyes, no facial hair. */
  kids: {
    label: 'Children',
    kin: { child: 92, human: 8 },
    look: { plain: 100 },
    weights: {
      mouth: { line: 8, smile: 34, frown: 5, open: 12, wavy: 9, smirk: 7, teeth: 8, o: 9, pursed: 3, grin: 3, tongue: 8, fangs: 0, gap: 6 },
    },
  },

  /** Weathered and shifty — the sort of crowd a back-room card table attracts. */
  gamblers: {
    label: 'Gamblers',
    kin: { human: 58, elder: 15, dwarf: 8, goblin: 8, gnome: 6, undead: 5 },
    look: { plain: 26, finance: 14, sailor: 12, farmer: 10, scholar: 8, metal: 6, punk: 5, detective: 12, noble: 7 },
    weights: {
      head: { round: 10, oval: 12, egg: 8, square: 14, pear: 10, long: 12, wide: 6, diamond: 4, heart: 3, jug: 8, bell: 5, wedge: 3, blob: 3, brick: 8 },
      eyes: { oval: 12, dot: 8, line: 14, wide: 4, sleepy: 16, squint: 16, round: 5, wonky: 7, wink: 3, cross: 1, star: 0, spiral: 1, mismatched: 6, closed: 2, glare: 12, beady: 10 },
      brows: { none: 8, thin: 10, thick: 20, angled: 20, arched: 6, bushy: 24, worried: 12 },
      beard: { none: 34, stubble: 18, mustache: 14, goatee: 10, full: 10, chinStrap: 4, sideburns: 6, soulPatch: 4, muttonChops: 6, longBeard: 6, braided: 2 },
      hat: { none: 52, beanie: 8, cap: 6, bandana: 6, headband: 2, tophat: 14, beret: 3, flatCap: 12, hood: 6 },
      mouth: { line: 18, smile: 5, frown: 14, open: 4, wavy: 9, smirk: 26, teeth: 4, o: 2, pursed: 10, grin: 5, tongue: 0, fangs: 1, gap: 4 },
    },
  },

  /** A fantasy tavern: everybody who is not a human. */
  tavern: {
    label: 'Tavern',
    kin: { human: 18, dwarf: 15, orc: 12, goblin: 12, elf: 10, gnome: 9, troll: 7, beast: 8, demon: 5, undead: 4 },
    look: { plain: 52, farmer: 10, sailor: 10, metal: 8, punk: 8, hippie: 6, artist: 6 },
    weights: {
      hat: { none: 66, beanie: 6, cap: 2, bandana: 8, headband: 5, tophat: 2, beret: 1, flatCap: 2, hood: 8 },
      glasses: { none: 90, round: 3, square: 2, sunglasses: 1, halfRim: 2, monocle: 2 },
    },
  },

  /** Everything turned up — useful for eyeballing every style at once. */
  carnival: {
    label: 'Carnival',
    kin: { human: 10, child: 8, elder: 8, elf: 9, dwarf: 9, gnome: 9, orc: 8, troll: 8, goblin: 8, undead: 8, demon: 8, beast: 7 },
    look: { plain: 8, finance: 6, punk: 7, hippie: 6, bobo: 6, goth: 6, metal: 6, sailor: 6, scholar: 6, raver: 6, farmer: 5, artist: 5, wizard: 6, noble: 6, soldier: 6, clown: 6, detective: 5 },
    weights: {
      hair: { none: 2, buzz: 5, shortHatch: 5, flatTop: 6, messy: 6, mop: 6, curly: 6, spiky: 7, long: 6, bob: 6, fringe: 5, receding: 4, mohawk: 7, bun: 5, pigtails: 5, combover: 4, afro: 7, dreads: 6, ponytail: 5, topknot: 5, shavedSides: 5 },
      hat: { none: 24, beanie: 10, cap: 10, bandana: 10, headband: 8, tophat: 10, beret: 10, flatCap: 9, hood: 9 },
      glasses: { none: 26, round: 16, square: 14, sunglasses: 16, halfRim: 14, monocle: 14 },
      eyes: { oval: 6, dot: 6, line: 5, wide: 7, sleepy: 6, squint: 6, round: 7, wonky: 7, wink: 7, cross: 6, star: 6, spiral: 6, mismatched: 9, closed: 5, glare: 6, beady: 5 },
    },
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

/**
 * Recipes — a specific face you want back, not a population you want to sample.
 *
 * A preset biases *what turns up*. A recipe pins *one character*: the traits
 * are forced, the proportions are set by hand, and only the seed is left free —
 * so the same recipe gives you a hundred siblings of the same person rather
 * than a hundred strangers.
 *
 * Two parts, because `force` can only reach enum traits:
 *   opts  what to pin before generating (traits, pose, colour)
 *   tune  what to overwrite afterwards (numbers, tones, marks)
 *
 * The workflow that produces one of these is in the README: pin the obvious
 * traits in the site's dropdowns, reroll until close, open a face, edit the
 * genome panel live, then paste the numbers you settled on into a `tune`.
 */

import { makeGenome } from './genome.js?v=e1ff722724';

export const RECIPES = {
  /**
   * The knitted-beanie-and-black-shades portrait: hatched wool with a nub on
   * top, filled oval lenses with wire arms hooked over round ears, a wide
   * scribbled moustache, freckled cheeks, and a rough charcoal line.
   */
  beanieShades: {
    label: 'bonnet & lunettes noires',
    opts: {
      color: 0,
      turn: 0,
      force: {
        kin: 'human',
        look: 'plain',
        head: 'round',
        hat: 'beanie',
        glasses: 'sunglasses',
        beard: 'mustache',
        nose: 'long',
        mouth: 'line',
        ears: 'round',
        brows: 'none',
        pen: 'charcoal',
      },
    },
    tune(g) {
      // a wide skull with a heavy jaw and a narrow crown
      Object.assign(g.head, { w: 36, h: 35, jaw: 1.2, brow: 0.86, exp: 2.3, tilt: 0, lopsided: 0, neck: false });
      // wool, not a solid cap: `mid` hatches, `dark` would fill it in
      Object.assign(g.hat, { tone: 'mid', height: 0.95 });
      Object.assign(g.glasses, { size: 1.3, thickness: 0.85 });
      // `dark` is what turns the moustache from a wisp into a solid scribble
      Object.assign(g.beard, { tone: 'dark', density: 1.45, gap: 1.5 });
      // deliberately past the generator's own range — a genome is just data
      Object.assign(g.mouth, { w: 1.75, y: 0.06 });
      Object.assign(g.eyes, { spacing: 0.46, y: 0.05 });
      Object.assign(g.nose, { y: 0.04, size: 1.05 });
      Object.assign(g.marks, { freckles: 26, blush: false, mole: false, wrinkles: 0, chinLine: false });
    },
  },
};

export const RECIPE_NAMES = Object.keys(RECIPES);

/**
 * Build a genome from a recipe. The seed still varies everything the recipe
 * left alone — the wobble of the pen, the exact freckles, the hat's folds —
 * so `makeRecipe('beanieShades', i)` gives you siblings, not clones.
 *
 * @param {string} name  a key of RECIPES
 * @param {string|number} seed
 * @param {object} [extra]  merged over the recipe's own options
 */
export function makeRecipe(name, seed, extra = {}) {
  const r = RECIPES[name];
  if (!r) throw new Error(`Unknown recipe: ${name}`);
  const opts = {
    ...r.opts,
    ...extra,
    force: { ...(r.opts && r.opts.force), ...extra.force },
  };
  const g = makeGenome(seed, opts);
  if (r.tune) r.tune(g);
  return g;
}

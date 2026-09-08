/**
 * Does the photo fit actually recover what was in the photo?
 *
 * There is no way to unit-test "looks like me", but there is a way to test the
 * chain that claims to: build a synthetic portrait with *known* proportions,
 * measure it, and check the measurement comes back with those proportions and
 * that the genome moves the right way. Synthetic faces are much easier than
 * real ones, so passing here is a floor, not a ceiling — but a regression that
 * breaks the chain shows up immediately.
 *
 * These exercise `photo.js`, which since the landmark detector arrived is the
 * *fallback* measurer — the one used when the model cannot be fetched. It is
 * still worth guarding, and the suite is still the fastest way to catch a
 * regression, but note what a corpus of real photographs showed: passing every
 * check here says the plumbing works, not that a face was found. A flat drawing
 * on a plain ground looks nothing like a photograph taken in a café.
 *
 *   node tools/test-photo.mjs
 */

import { measureFace } from '../src/faces/photo.js';
import { fitGenome, readMeasurement } from '../src/faces/fit.js';

import { synth } from './synth-face.mjs';

// ---------------------------------------------------------------------------

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

function measure(o) {
  const img = synth(o);
  const m = measureFace(img);
  if (!m.ok) throw new Error(`measurement failed: ${m.reason}`);
  return { m, truth: img.truth };
}

console.log('\ngeometry recovered from a synthetic portrait');
{
  const { m, truth } = measure();
  check('finds the chin, not the collarbone',
    Math.abs(m.head.chinY - truth.chin) < 14, `got ${m.head.chinY.toFixed(0)} want ~${truth.chin}`);
  check('finds the eye line',
    Math.abs(m.eyes.y - truth.eyeY) < 8, `got ${m.eyes.y} want ~${truth.eyeY.toFixed(0)}`);
  check('finds the mouth line',
    Math.abs(m.mouth.y - truth.mouthY) < 10, `got ${m.mouth.y} want ~${truth.mouthY.toFixed(0)}`);
  check('face width within 12%',
    Math.abs(m.head.faceW / truth.faceW - 1) < 0.12, `got ${m.head.faceW.toFixed(0)} want ${truth.faceW}`);
  check('eye spacing within 15%',
    Math.abs(m.eyes.spacing / 0.44 - 1) < 0.15, `got ${m.eyes.spacing.toFixed(3)}`);
  check('confidence is respectable', m.confidence > 0.5, `got ${m.confidence.toFixed(2)}`);
}

console.log('\nproportions move the right way');
{
  // Real adult faces run about 1.05 to 1.45 in hairline-to-chin over width.
  // The first version of this test used 0.93 and 1.95, which are not faces —
  // it was failing the measurement for not handling a caricature.
  const wide = measure({ faceW: 132, faceH: 138 }).m;
  const narrow = measure({ faceW: 98, faceH: 142 }).m;
  check('a wide face measures wider',
    wide.ratios.aspect > narrow.ratios.aspect * 1.2,
    `${wide.ratios.aspect.toFixed(2)} vs ${narrow.ratios.aspect.toFixed(2)}`);

  const fw = readMeasurement(wide).targets;
  const fn = readMeasurement(narrow).targets;
  check('and the fit asks for a wider skull',
    fw.aspect > fn.aspect * 1.15, `${fw.aspect.toFixed(2)} vs ${fn.aspect.toFixed(2)}`);

  const close = measure({ eyeSpacing: 0.34 }).m;
  const far = measure({ eyeSpacing: 0.54 }).m;
  check('close-set eyes measure closer',
    close.eyes.spacing < far.eyes.spacing * 0.82,
    `${close.eyes.spacing.toFixed(3)} vs ${far.eyes.spacing.toFixed(3)}`);
  check('and the fit narrows the drawn spacing',
    readMeasurement(close).targets.eyeSpacing < readMeasurement(far).targets.eyeSpacing * 0.9);

  const slit = measure({ eyeH: 4 }).m;
  const wideEye = measure({ eyeH: 20 }).m;
  check('aperture separates a slit from a saucer',
    slit.eyes.aperture < wideEye.eyes.aperture * 0.6,
    `${slit.eyes.aperture.toFixed(2)} vs ${wideEye.eyes.aperture.toFixed(2)}`);
}

console.log('\nexpression');
{
  const smile = measure({ mouthCurve: 1 }).m;
  const flat = measure({ mouthCurve: 0 }).m;
  const scowl = measure({ mouthCurve: -1 }).m;
  check('a smile measures positive', smile.mouth.curve > 0.3, `got ${smile.mouth.curve.toFixed(2)}`);
  check('a flat mouth measures flat', Math.abs(flat.mouth.curve) < 0.25, `got ${flat.mouth.curve.toFixed(2)}`);
  check('a scowl measures negative', scowl.mouth.curve < -0.3, `got ${scowl.mouth.curve.toFixed(2)}`);
  check('and reaches the genome',
    fitGenome(smile, { tries: 40 }).genome.expression > 0.2);

  // Regressions from a bearded, bespectacled, smiling face. A beard is a wider
  // and darker band than a pair of lips, so a darkness-only search put the
  // mouth line in the beard — which both hid the smile and, because the head's
  // scale comes from the eye-to-mouth distance, inflated the whole head.
  const hidden = measure({ beard: 0.9, glasses: true, mouthCurve: 0.9 }).m;
  check('a beard does not hide the smile', hidden.mouth.curve > 0.3, `got ${hidden.mouth.curve.toFixed(2)}`);
  check('a beard does not change the head scale',
    Math.abs(hidden.head.headH / smile.head.headH - 1) < 0.06,
    `${hidden.head.headH.toFixed(0)} vs ${smile.head.headH.toFixed(0)}`);
  check('a beard does not move the mouth line',
    Math.abs(hidden.mouth.y - smile.mouth.y) <= 3, `${hidden.mouth.y} vs ${smile.mouth.y}`);
}

console.log('\nthings that are either there or not');
{
  const bare = measure().m;
  const bearded = measure({ beard: 1 }).m;
  check('a bare chin reads bare', bare.beard.amount < 0.35, `got ${bare.beard.amount.toFixed(2)}`);
  check('a beard reads as a beard', bearded.beard.amount > 0.6, `got ${bearded.beard.amount.toFixed(2)}`);
  check('and the genome grows one',
    fitGenome(bearded, { tries: 60 }).genome.beard.style !== 'none');
  // Regression: a dark beard spans the whole chin, drops below the mask's
  // brightness threshold and severs the neck from the face — after which the
  // beard sat outside the face and could not be measured at all.
  check('a beard does not truncate the face',
    Math.abs(bearded.head.chinY - bare.head.chinY) < 20,
    `${bearded.head.chinY} vs ${bare.head.chinY}`);
  check('a bare chin stays bare',
    fitGenome(bare, { tries: 60 }).genome.beard.style === 'none');

  // Regression: the "bare skin" reference sampled a band that still caught the
  // lower rim of a pair of glasses, which made it 60% darker than the cheek it
  // described. That one number is the baseline for the beard, brow, glasses and
  // teeth tests alike, so a bespectacled sitter had lit skin counted as bright
  // enough to be teeth and came back grinning with their mouth open.
  for (const [name, o] of [['bare', {}], ['bespectacled', { glasses: true }], ['bearded', { beard: 0.9 }]]) {
    check(`a closed mouth shows no teeth (${name})`,
      measure({ ...o, mouthCurve: -0.9 }).m.mouth.teeth < 0.15);
  }

  // Regression: flooring the lip run against the least-red column put the
  // threshold below bare skin, so the run walked out to the cheeks and every
  // fitted face was given the widest mouth on the menu.
  const narrowMouth = measure({ mouthW: 26 }).m;
  const wideMouth = measure({ mouthW: 56 }).m;
  check('mouth width is measured, not saturated',
    narrowMouth.mouth.width < wideMouth.mouth.width * 0.75,
    `${narrowMouth.mouth.width.toFixed(2)} vs ${wideMouth.mouth.width.toFixed(2)}`);
  check('and a beard does not widen it',
    Math.abs(measure({ mouthW: 40, beard: 0.9, glasses: true }).m.mouth.width
      / measure({ mouthW: 40 }).m.mouth.width - 1) < 0.12);

  const specs = measure({ glasses: true }).m;
  check('rims are detected', specs.glasses.amount > bare.glasses.amount + 0.2,
    `${specs.glasses.amount.toFixed(2)} vs ${bare.glasses.amount.toFixed(2)}`);
  // Regression: a rim out-darkens an eye, so picking the darkest row put the
  // eye line on the lower rim and shrank the head by a fifth.
  check('glasses do not distort the proportions',
    Math.abs(specs.head.headH / bare.head.headH - 1) < 0.06,
    `${specs.head.headH.toFixed(0)} vs ${bare.head.headH.toFixed(0)}`);
  check('glasses do not move the eye line',
    Math.abs(specs.eyes.y - bare.eyes.y) <= 3, `${specs.eyes.y} vs ${bare.eyes.y}`);

  const bald = measure({ hairTop: 2 }).m;
  const big = measure({ hairTop: 76 }).m;
  check('hair volume tracks the hair',
    big.hair.volume > bald.hair.volume + 0.5,
    `${big.hair.volume.toFixed(2)} vs ${bald.hair.volume.toFixed(2)}`);
  check('bald fits short hair',
    ['none', 'buzz', 'receding', 'shortHatch'].includes(fitGenome(bald, { tries: 60 }).genome.hair.style),
    `got ${fitGenome(bald, { tries: 60 }).genome.hair.style}`);

  const hatted = measure({ hairTop: 80, hat: true }).m;
  const read = readMeasurement(hatted);
  check('a smooth tall crown is read as headwear', read.hat !== null, `got ${read.hat}`);
}

console.log('\nthe measurement holds still when it should');
{
  // Every vertical proportion used to hang off the top of the skin mask, which
  // put them at the mercy of how much hair got into it. Pale hair passes the
  // skin test and sits in the same chroma box as a forehead, so it joins the
  // mask and slides the whole search window up over the hairstyle. Both sweeps
  // below moved the eye line by tens of pixels before the eyes became the
  // anchor that everything else hangs off.
  const spread = (list, f) => Math.max(...list.map(f)) - Math.min(...list.map(f));

  const rows = [2, 24, 46, 78, 96].map(
    (hairTop) => measure({ hairTop, beard: 0.9, glasses: true, mouthCurve: 0.9 }).m);
  check('hair volume does not move the eye line', spread(rows, (m) => m.eyes.y) <= 3,
    rows.map((m) => m.eyes.y).join(','));
  check('hair volume does not move the head scale',
    spread(rows, (m) => m.head.headH) / rows[0].head.headH < 0.05);
  check('but it is still measured',
    rows[0].hair.volume < 0.2 && rows[rows.length - 1].hair.volume > 1,
    `${rows[0].hair.volume.toFixed(2)} .. ${rows[rows.length - 1].hair.volume.toFixed(2)}`);

  const tones = [[58, 44, 34], [120, 96, 72], [186, 158, 116], [224, 206, 168]]
    .map((hairRgb) => measure({ hairRgb, hairTop: 46 }).m);
  check('hair colour does not move the eye line', spread(tones, (m) => m.eyes.y) <= 3,
    tones.map((m) => m.eyes.y).join(','));
  check('hair colour does not move the head scale',
    spread(tones, (m) => m.head.headH) / tones[0].head.headH < 0.05);
  check('blond hair is still found', tones[3].hair.volume > 0.5, `got ${tones[3].hair.volume.toFixed(2)}`);
  check('and its tone is read', tones[3].hair.luma > tones[0].hair.luma + 80,
    `${tones[3].hair.luma.toFixed(0)} vs ${tones[0].hair.luma.toFixed(0)}`);
}

console.log('\nthe fit produces a usable genome');
{
  const { m } = measure({ beard: 0.8, glasses: true, mouthCurve: 0.8 });
  const { genome: g, read } = fitGenome(m, { seed: 'test', tries: 120 });
  check('head stays in range', g.head.w >= 23 && g.head.w <= 42 && g.head.h >= 26 && g.head.h <= 47,
    `${g.head.w.toFixed(1)}×${g.head.h.toFixed(1)}`);
  check('aspect stays drawable', g.head.w / g.head.h > 0.6 && g.head.w / g.head.h < 1.2);
  check('feature offsets stay small',
    Math.abs(g.eyes.y) < 0.15 && Math.abs(g.mouth.y) < 0.15 && Math.abs(g.nose.y) < 0.15);
  check('spacing is sane', g.eyes.spacing > 0.28 && g.eyes.spacing < 0.62);
  check('one accent at most', g.accents.length <= 1);
  check('no invented blemishes', g.marks.freckles === 0 && g.marks.warts === 0);
  check('it is JSON', JSON.parse(JSON.stringify(g)).seed === g.seed);
  check('the read explains itself', typeof read.targets.head === 'string' && Array.isArray(read.notes));

  // determinism: the same photo and seed must give the same face, or a shared
  // link to a fitted portrait would be a lie
  const again = fitGenome(m, { seed: 'test', tries: 120 }).genome;
  check('same photo + same seed = same face',
    JSON.stringify(again) === JSON.stringify(g));
  const other = fitGenome(m, { seed: 'other', tries: 120 }).genome;
  check('a different seed gives a variation',
    JSON.stringify(other) !== JSON.stringify(g));

  // the caller's pins have to survive, or the sidebar stops working
  const gnome = fitGenome(m, { seed: 'test', tries: 60, force: { kin: 'gnome' } }).genome;
  check('a pinned kin still wins', gnome.kin === 'gnome');
  const pinned = fitGenome(m, { seed: 'test', tries: 60, force: { hair: 'mohawk' } }).genome;
  check('a pinned trait still wins', pinned.hair.style === 'mohawk');
}

console.log('\nrefusals are polite');
{
  const blank = { width: 60, height: 60, data: new Uint8ClampedArray(60 * 60 * 4) };
  const r = measureFace(blank);
  check('an empty image is refused, not crashed', r.ok === false && typeof r.reason === 'string', r.reason);
  check('a zero-size image is refused', measureFace({ width: 0, height: 0, data: new Uint8ClampedArray(0) }).ok === false);
}

console.log(failures === 0 ? '\nall good\n' : `\n${failures} failing\n`);
process.exit(failures === 0 ? 0 : 1);

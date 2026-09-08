/**
 * Measure a face from landmarks.
 *
 * The same measurement `photo.js` produces, and deliberately the same object,
 * so `fit.js` never learns which one it got. `photo.js` stays as the fallback
 * for when the detector cannot be fetched; this is the path that actually works
 * on photographs.
 *
 * What changes is not accuracy but *reach*. Finding the eyes by hunting dark
 * bands works on a drawing and falls apart in a café; with the eyes handed over
 * for free, the measurements that were guesses become geometry:
 *
 *   silhouette   the face oval, instead of a skin-colour blob that swallowed
 *                the neck, the arms and the wooden bar behind
 *   aperture     the actual eyelid opening, instead of a dark run that merged
 *                the brow, the socket and the lashes and saturated at "saucer"
 *   mouth        the lip contour, instead of a redness run that collapsed to
 *                nothing on half the corpus
 *   expression   the blendshape a smile produces, instead of chasing the
 *                darkest row along a lip
 *
 * Hair, beard, glasses and skin tone are still read off pixels — no landmark
 * knows what colour someone's hair is — but they are now sampled where they
 * belong rather than where a projection guessed.
 */

/** Rec.601 luma. */
function luma(d, i) {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * The face oval, as MediaPipe numbers it. Used as a polygon, so the order
 * around the ring matters.
 */
const OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

// Landmarks worth naming. "Right" and "left" are the sitter's, so the right eye
// is on the left of the picture.
const P = {
  chin: 152,
  foreheadTop: 10,
  cheekR: 234,
  cheekL: 454,
  jawR: 172,
  jawL: 397,
  eyeROuter: 33, eyeRInner: 133, eyeRTop: 159, eyeRBottom: 145,
  eyeLOuter: 263, eyeLInner: 362, eyeLTop: 386, eyeLBottom: 374,
  irisR: 468, irisL: 473,
  browR: [70, 63, 105, 66, 107],
  browL: [336, 296, 334, 293, 300],
  noseTip: 1, noseBridge: 168, noseBase: 2, alaR: 129, alaL: 358,
  lipR: 61, lipL: 291, lipInnerTop: 13, lipInnerBottom: 14,
  lipOuterTop: 0, lipOuterBottom: 17,
  midCheekR: 50, midCheekL: 280,
  templeR: 127, templeL: 356,
};

const mean = (list, get) => list.reduce((s, v) => s + get(v), 0) / list.length;

/**
 * Width of a polygon at a given height.
 *
 * Every edge that straddles `y` contributes a crossing; the span between the
 * outermost two is the width. Nothing here assumes the head is upright — the
 * polygon has already been rotated level.
 */
function widthAt(poly, y) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
      if (a.y === b.y) continue;
      const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  return hi > lo ? hi - lo : 0;
}

/** Shoelace area, sign-free. */
function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/** Is a point inside a polygon? Even-odd ray casting. */
function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Measure a face from an image and its landmarks.
 *
 * @param {{width:number,height:number,data:Uint8ClampedArray}} img
 * @param {{points:{x:number,y:number}[], shapes:object, faces:number}} face
 * @returns {object} the same measurement shape `measureFace` produces
 */
export function measureFromLandmarks(img, face) {
  const { width: w, height: h, data } = img;
  const pts = face.points;
  const shapes = face.shapes || {};
  const notes = [];

  const at = (i) => pts[i];
  const hasIris = pts.length >= 478;

  // --------------------------------------------------------------- frame ---
  // Everything below is measured on a head rotated level, so a photo taken at
  // an angle gives the same proportions as one taken square.
  const eyeR = hasIris ? at(P.irisR) : {
    x: (at(P.eyeROuter).x + at(P.eyeRInner).x) / 2,
    y: (at(P.eyeROuter).y + at(P.eyeRInner).y) / 2,
  };
  const eyeL = hasIris ? at(P.irisL) : {
    x: (at(P.eyeLOuter).x + at(P.eyeLInner).x) / 2,
    y: (at(P.eyeLOuter).y + at(P.eyeLInner).y) / 2,
  };
  const roll = Math.atan2(eyeL.y - eyeR.y, eyeL.x - eyeR.x);
  const ox = (eyeR.x + eyeL.x) / 2;
  const oy = (eyeR.y + eyeL.y) / 2;
  const cos = Math.cos(-roll);
  const sin = Math.sin(-roll);
  const A = (p) => ({ x: ox + (p.x - ox) * cos - (p.y - oy) * sin, y: oy + (p.x - ox) * sin + (p.y - oy) * cos });

  const a = {};
  for (const key of Object.keys(P)) {
    const v = P[key];
    a[key] = Array.isArray(v) ? v.map((i) => A(at(i))) : A(at(v));
  }
  const aEyeR = A(eyeR);
  const aEyeL = A(eyeL);
  const oval = OVAL.map((i) => A(at(i)));

  // --------------------------------------------------------- proportions ---
  const faceW = Math.max(8, Math.abs(a.cheekL.x - a.cheekR.x));
  const eyeY = (aEyeR.y + aEyeL.y) / 2;
  const eyeGap = Math.abs(aEyeL.x - aEyeR.x);
  const mouthY = (a.lipInnerTop.y + a.lipInnerBottom.y) / 2;

  // The renderer puts the eye line at 0.46 of the head and the mouth at 0.76,
  // so their gap is 0.30 of it. Deriving the head this way rather than from the
  // oval keeps the two sides speaking the same language.
  const eyeToMouth = Math.max(4, mouthY - eyeY);
  const headH = eyeToMouth / 0.3;
  const crownY = eyeY - headH * 0.46;

  const chinY = a.chin.y;
  const hairlineY = a.foreheadTop.y;
  const faceH = Math.max(8, chinY - hairlineY);

  const cx = (a.cheekR.x + a.cheekL.x) / 2;

  // --------------------------------------------------------------- eyes ----
  const eyeWidth = (Math.abs(a.eyeRInner.x - a.eyeROuter.x) + Math.abs(a.eyeLOuter.x - a.eyeLInner.x)) / 2;
  const lidR = Math.abs(a.eyeRBottom.y - a.eyeRTop.y);
  const lidL = Math.abs(a.eyeLBottom.y - a.eyeLTop.y);
  const aperture = clamp(((lidR + lidL) / 2) / Math.max(1, eyeWidth), 0.05, 1.4);

  // ---------------------------------------------------------- pixel work ---
  /** Mean darkness and roughness of a small disc, in image coordinates. */
  const disc = (p, r) => {
    let dark = 0;
    let rough = 0;
    let n = 0;
    const rr = Math.max(1, Math.round(r));
    for (let y = Math.round(p.y - rr); y <= Math.round(p.y + rr); y++) {
      if (y < 1 || y >= h - 1) continue;
      for (let x = Math.round(p.x - rr); x <= Math.round(p.x + rr); x++) {
        if (x < 1 || x >= w - 1) continue;
        if ((x - p.x) ** 2 + (y - p.y) ** 2 > rr * rr) continue;
        dark += 255 - luma(data, (y * w + x) * 4);
        rough += Math.abs(luma(data, (y * w + x + 1) * 4) - luma(data, (y * w + x - 1) * 4));
        n++;
      }
    }
    return n > 3 ? { dark: dark / n, rough: rough / n, n } : null;
  };

  const rgbAt = (p, r) => {
    let R = 0;
    let G = 0;
    let B = 0;
    let n = 0;
    const rr = Math.max(1, Math.round(r));
    for (let y = Math.round(p.y - rr); y <= Math.round(p.y + rr); y++) {
      if (y < 0 || y >= h) continue;
      for (let x = Math.round(p.x - rr); x <= Math.round(p.x + rr); x++) {
        if (x < 0 || x >= w) continue;
        const i = (y * w + x) * 4;
        R += data[i]; G += data[i + 1]; B += data[i + 2];
        n++;
      }
    }
    return n ? [R / n, G / n, B / n] : null;
  };

  const unit = faceW * 0.06;
  const cheekPatch = [disc(at(P.midCheekR), unit), disc(at(P.midCheekL), unit)].filter(Boolean);
  const cheek = cheekPatch.length
    ? { dark: mean(cheekPatch, (p) => p.dark), rough: mean(cheekPatch, (p) => p.rough) }
    : { dark: 90, rough: 8 };
  const cheekRef = cheek.dark;

  // --------------------------------------------------------------- brows ---
  const browDiscs = [...P.browR, ...P.browL].map((i) => disc(at(i), unit * 0.55)).filter(Boolean);
  const browDark = browDiscs.length ? mean(browDiscs, (p) => p.dark) : cheekRef;
  const browStrength = clamp((browDark - cheekRef) / 40, 0, 2);

  // --------------------------------------------------------------- mouth ---
  const mouthWidth = Math.abs(a.lipL.x - a.lipR.x);
  const corners = (a.lipR.y + a.lipL.y) / 2;
  const geoCurve = (mouthY - corners) / (headH * 0.035);
  const smile = ((shapes.mouthSmileLeft || 0) + (shapes.mouthSmileRight || 0)) / 2;
  const frown = ((shapes.mouthFrownLeft || 0) + (shapes.mouthFrownRight || 0)) / 2;
  // Geometry and blendshape agree most of the time; where they disagree the
  // blendshape is right, because it was trained on faces rather than on the
  // assumption that a mouth is a dark line.
  // Weighted so the corpus spreads across the range instead of piling on the
  // clamp: a broad grin scores about 0.8 on the blendshape and a polite one
  // about 0.1, and both should read as themselves.
  const mouthCurve = clamp(geoCurve * 0.35 + (smile - frown) * 1.9, -1.6, 1.6);

  // --------------------------------------------------------------- beard ---
  // Under the lip and along the jaw, against the cheek: darker *and* rougher is
  // hair. Darker alone is the shadow every jaw casts.
  const beard = (() => {
    const chinP = disc({
      x: (at(P.lipOuterBottom).x + at(P.chin).x) / 2,
      y: (at(P.lipOuterBottom).y + at(P.chin).y) / 2,
    }, unit);
    const lipP = disc({
      x: (at(P.noseBase).x + at(P.lipOuterTop).x) / 2,
      y: (at(P.noseBase).y + at(P.lipOuterTop).y) / 2,
    }, unit * 0.8);
    // A quarter of the way in from the jaw contour. Sampling on the line itself
    // puts half the disc on the background, which is darker and rougher than
    // any beard and had the jawline pinned at its limit on a clean-shaven chin.
    const inward = (i) => ({
      x: at(i).x + (at(P.noseTip).x - at(i).x) * 0.25,
      y: at(i).y + (at(P.noseTip).y - at(i).y) * 0.25,
    });
    const jawP = [disc(inward(P.jawR), unit * 0.9), disc(inward(P.jawL), unit * 0.9)].filter(Boolean);
    const score = (p) => (p ? clamp(((p.dark - cheek.dark) / 42) * 0.7 + ((p.rough - cheek.rough) / 16) * 0.6, 0, 2) : 0);
    return {
      amount: score(chinP),
      moustache: score(lipP),
      jawline: jawP.length ? mean(jawP, score) : 0,
    };
  })();

  // ------------------------------------------------------------- glasses ---
  /**
   * Two tests, and both must pass.
   *
   * The old detector asked how far darkness spread across the eye band, which a
   * pair of eyebrows satisfies effortlessly — it claimed spectacles on two
   * thirds of a corpus where nobody wore any. A frame is distinguished by where
   * it goes that a face has nothing: across the bridge of the nose between the
   * eyes, and back over the temple towards the ear. Brows reach neither.
   */
  const glasses = (() => {
    const bridge = disc(at(P.noseBridge), unit * 0.6);
    const temples = [
      disc({ x: (at(P.templeR).x * 0.6 + at(P.eyeROuter).x * 0.4), y: at(P.eyeROuter).y }, unit * 0.6),
      disc({ x: (at(P.templeL).x * 0.6 + at(P.eyeLOuter).x * 0.4), y: at(P.eyeLOuter).y }, unit * 0.6),
    ].filter(Boolean);
    if (!bridge || temples.length === 0) return { amount: 0, dark: false };
    const b = clamp((bridge.dark - cheekRef) / 42, 0, 1.4);
    const t = clamp((mean(temples, (p) => p.dark) - cheekRef) / 42, 0, 1.4);
    // The weaker of the two decides, so one dark eyebrow or one shadowed temple
    // cannot carry the verdict on its own.
    const amount = Math.min(b, t) * 1.6;
    const lens = disc(eyeR, unit * 0.5);
    const dark = amount > 0.9 && !!lens && lens.dark > cheekRef + 70;
    return { amount, dark };
  })();

  // ---------------------------------------------------------------- hair ---
  // Still pixels: no landmark knows what colour someone's hair is. But the
  // background estimate now comes from just outside the head at eye level,
  // which is local and far steadier than the corners of a photograph taken in
  // a room full of plants.
  const hair = (() => {
    const outR = { x: at(P.cheekR).x - faceW * 0.22, y: eyeR.y };
    const outL = { x: at(P.cheekL).x + faceW * 0.22, y: eyeL.y };
    const bgs = [rgbAt(outR, unit), rgbAt(outL, unit)].filter(Boolean);
    if (bgs.length === 0) return { volume: 0, side: 0, rough: 12, rgb: null, luma: 90, crownY: hairlineY, trusted: false };
    const bg = [0, 1, 2].map((k) => mean(bgs, (c) => c[k]));
    const spread = bgs.length === 2
      ? Math.abs(bgs[0][0] - bgs[1][0]) + Math.abs(bgs[0][1] - bgs[1][1]) + Math.abs(bgs[0][2] - bgs[1][2])
      : 0;
    const busy = spread > 120;
    if (busy) notes.push('busy background — hair volume is a guess');

    const isBg = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return true;
      const i = (y * w + x) * 4;
      return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 76;
    };

    // Walk up from the forehead through whatever is not background.
    const topPoint = at(P.foreheadTop);
    let crown = topPoint.y;
    let R = 0;
    let G = 0;
    let B = 0;
    let rough = 0;
    let n = 0;
    const limit = Math.max(0, Math.round(topPoint.y - headH * 0.62));
    for (let y = Math.round(topPoint.y) - 1; y >= limit; y--) {
      let solid = 0;
      let tried = 0;
      for (let k = -3; k <= 3; k++) {
        const x = Math.round(topPoint.x + k * faceW * 0.11);
        if (x < 1 || x >= w - 1) continue;
        tried++;
        if (!isBg(x, y)) {
          solid++;
          const i = (y * w + x) * 4;
          R += data[i]; G += data[i + 1]; B += data[i + 2];
          rough += Math.abs(luma(data, (y * w + x + 1) * 4) - luma(data, (y * w + x - 1) * 4));
          n++;
        }
      }
      if (tried === 0 || solid / tried < 0.55) break;
      crown = y;
    }
    const volume = clamp((topPoint.y - crown) / (headH * 0.3), 0, 2.5);

    // How far the non-background silhouette reaches below the eyes beside the
    // face — a bob from a crop.
    let side = 0;
    for (const [edge, dir] of [[at(P.cheekR), -1], [at(P.cheekL), 1]]) {
      let reach = 0;
      for (let y = Math.round(eyeY); y <= Math.min(h - 1, chinY + headH * 0.5); y++) {
        const x = Math.round(edge.x + dir * faceW * 0.1);
        if (x < 0 || x >= w) break;
        if (isBg(x, y)) break;
        reach = y - eyeY;
      }
      side = Math.max(side, reach / headH);
    }

    const rgb = n > 20 ? [R / n, G / n, B / n] : null;
    return {
      volume,
      side: clamp(side, 0, 1.2),
      rough: n > 20 ? rough / n : 12,
      rgb,
      luma: rgb ? 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] : 90,
      crownY: crown,
      trusted: !busy && n > 20,
    };
  })();

  // ----------------------------------------------------------------- pose ---
  /**
   * Yaw, from the detector's own pose matrix.
   *
   * Measuring it as how far the nose has swung towards one cheek gets the
   * direction right — it agreed with the matrix on all fourteen turned photos in
   * the corpus — but not the amount: it pinned to its limit on twelve of
   * nineteen, so a head turned five degrees was drawn like one turned thirty.
   * The matrix reports the real angle, and the corpus reads -36° to +38°, which
   * is what those photographs actually look like. Kept as the fallback for a
   * detector build that does not return one.
   */
  const yaw = (() => {
    const m = face.matrix;
    if (m && m.length >= 11) {
      // Column-major 4x4; this is the rotation about the vertical axis. Scaled
      // down because the renderer's cylinder gets ugly past twenty degrees.
      return clamp(Math.atan2(m[8], m[10]) * 0.62, -0.34, 0.34);
    }
    const dR = Math.abs(a.noseTip.x - a.cheekR.x);
    const dL = Math.abs(a.cheekL.x - a.noseTip.x);
    return clamp(((dR - dL) / Math.max(1, dR + dL)) * 1.5, -0.34, 0.34);
  })();

  // ---------------------------------------------------------- confidence ---
  // Landmarks either found a face or they did not, so this is about how much of
  // the frame it fills and how far round it is turned, not about whether it is
  // there at all.
  const fill = clamp(faceW / (Math.min(w, h) * 0.5), 0, 1);
  const confidence = clamp(0.62 + fill * 0.3 - Math.abs(yaw) * 0.5, 0.3, 0.98);
  if (faceW < Math.min(w, h) * 0.16) notes.push('the face is small in the frame — a closer crop reads better');
  if (Math.abs(yaw) > 0.28) notes.push('turned well away from the camera — the proportions are a projection');
  if (face.faces > 1) notes.push(`${face.faces} faces found; measured the largest`);

  return {
    ok: true,
    source: 'landmarks',
    confidence,
    notes,
    image: { w, h },

    /**
     * What an ordinary face measures *under these definitions*.
     *
     * Not the same numbers as the pixel measurer's, and they should not be: an
     * oval traced through landmarks is not the same shape as a skin-colour
     * blob, so "face width" means something slightly different and a shared
     * baseline would bias every face by the difference.
     *
     * Read off a nineteen-photo corpus, which is one person plus one incidental
     * second face — enough to separate a definition offset from a personal
     * trait where the two subjects agree, and not enough to be a population.
     * Where the two disagreed the published anthropometric figure was kept: the
     * corpus subject measures 0.50 for eye spacing against the second face's
     * 0.45, so 0.45 stays and he is drawn, correctly, a little wide-set.
     */
    norms: {
      aspect: 0.56,       // both subjects, against 0.66 for the blob definition
      jaw: 0.71,
      brow: 0.85,
      fill: 0.84,         // an oval fills its box more than a ragged blob does
      eyeSpacing: 0.45,
      eyeWidth: 0.21,
      aperture: 0.34,
      noseWidth: 0.29,    // both subjects; the alae are wider than the old run
      mouthWidth: 0.37,
    },

    head: { crownY, chinY, hairlineY, cx, faceW, headH },
    ratios: {
      aspect: faceW / headH,
      jaw: widthAt(oval, chinY - faceH * 0.16) / faceW,
      brow: widthAt(oval, hairlineY + faceH * 0.08) / faceW,
      fill: polyArea(oval) / (faceW * faceH),
    },

    eyes: {
      x: [aEyeR.x, aEyeL.x],
      y: eyeY,
      spacing: eyeGap / faceW,
      width: eyeWidth / faceW,
      aperture,
      tilt: roll,
    },
    brows: { y: mean(a.browR, (p) => p.y), strength: browStrength },
    nose: {
      y: a.noseTip.y,
      width: Math.abs(a.alaL.x - a.alaR.x) / faceW,
      t: (a.noseTip.y - crownY) / headH,
    },
    mouth: {
      y: mouthY,
      width: mouthWidth / faceW,
      curve: mouthCurve,
      teeth: clamp(shapes.jawOpen || 0, 0, 1),
      t: (mouthY - crownY) / headH,
    },
    hair,
    beard,
    glasses,
    skin: { rgb: rgbAt(at(P.midCheekR), unit) || rgbAt(at(P.midCheekL), unit) || [200, 165, 140] },
    yaw,
    tilt: clamp(roll, -0.26, 0.26),
    eyeT: (eyeY - crownY) / headH,

    /** Kept for the overlay: the outline the measurement actually used. */
    oval: oval.map((p) => ({ x: p.x, y: p.y })),
    ovalRaw: OVAL.map((i) => ({ x: at(i).x, y: at(i).y })),
    eyesRaw: [{ x: eyeR.x, y: eyeR.y }, { x: eyeL.x, y: eyeL.y }],
    mouthRaw: { x: (at(P.lipInnerTop).x + at(P.lipInnerBottom).x) / 2, y: (at(P.lipInnerTop).y + at(P.lipInnerBottom).y) / 2 },
  };
}

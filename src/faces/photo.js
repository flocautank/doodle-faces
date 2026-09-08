/**
 * Measure a face in a photograph.
 *
 * This is the *measuring* half of the photo feature; `fit.js` turns the
 * measurement into a genome. Splitting them keeps this file free of any
 * knowledge of the generator, and keeps the fit testable without pixels.
 *
 * Deliberately dependency-free and network-free. Not for lack of ambition: a
 * 478-point face mesh would give sub-pixel landmarks, and every one of those
 * decimals would be thrown away the moment the result is quantised into
 * "square skull or pear". What a fifteen-stroke doodle needs is a handful of
 * coarse ratios, and those survive plain image processing. The reward is that
 * the photo provably never leaves the tab: there is no request to make.
 *
 * The whole file works on a plain `{ width, height, data }` RGBA buffer — an
 * ImageData, or a hand-built object in a test. No canvas, no DOM.
 *
 * Everything is measured *relative to a typical portrait*, never in absolute
 * units. A drawn head in this generator is far wider than a real skull, so
 * feeding it a raw width/height ratio would flatten every face. What transfers
 * is the deviation from the norm, applied to the doodle's own norm — see
 * `BASELINE` in fit.js.
 */

/** Rec.601 luma. Cheap, and good enough to find dark bands. */
function luma(d, i) {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

/**
 * How much a pixel looks like a lip: redness, relative to its own brightness.
 *
 * Darkness alone cannot find a mouth on a bearded face. A full beard is a wider
 * and darker band than a pair of lips, so the darkest-band search returned the
 * beard — and since the head's scale comes from the eye-to-mouth distance, that
 * one mistake inflated the whole head by a seventh and drew every bearded
 * sitter too narrow. It also left the smile unreadable, because the corners of
 * the mouth were buried in hair that scored the same as they did.
 *
 * Lips are far more saturated in red than either skin or hair, and dividing by
 * luma is what makes that hold regardless of complexion or how brightly the
 * photo was lit: on the test face lips score 1.35 against 0.62 for both cheek
 * and beard. It is the same property that makes lips findable by chroma in
 * general, and the reason lipstick is red rather than brown.
 */
function lipness(d, i) {
  const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return (2 * d[i] - d[i + 1] - d[i + 2]) / Math.max(40, y);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Is this pixel skin?
 *
 * Two classic rules, unioned. The chroma rule does the real work: Cb/Cr for
 * skin sit in a narrow box that is remarkably independent of how dark the skin
 * is, which is exactly the property we need here. The RGB rule catches warm
 * highlights the chroma box clips. Requiring some luma throws away the black
 * pixels that satisfy both rules by being colourless.
 */
function isSkin(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  if (y < 38 || y > 250) return false;

  const cb = -0.169 * r - 0.331 * g + 0.5 * b + 128;
  const cr = 0.5 * r - 0.419 * g - 0.081 * b + 128;
  const chroma = cr >= 132 && cr <= 182 && cb >= 74 && cb <= 130;

  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const rgb = r > 92 && g > 38 && b > 18 && mx - mn > 14 && r - g > 12 && r > b;

  return chroma || rgb;
}

/** 1D box blur, run twice — near-Gaussian for a tenth of the thought. */
function smooth(arr, radius) {
  let cur = arr;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float64Array(cur.length);
    for (let i = 0; i < cur.length; i++) {
      let sum = 0;
      let n = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = i + k;
        if (j < 0 || j >= cur.length) continue;
        sum += cur[j];
        n++;
      }
      out[i] = sum / n;
    }
    cur = out;
  }
  return cur;
}

/** Index of the largest value in `arr[lo..hi)`. */
function argmax(arr, lo, hi) {
  const a = Math.max(0, Math.round(lo));
  const b = Math.min(arr.length, Math.round(hi));
  let best = a;
  let bestV = -Infinity;
  for (let i = a; i < b; i++) {
    if (arr[i] > bestV) {
      bestV = arr[i];
      best = i;
    }
  }
  return best;
}

/** Extent of the run around `at` that stays above `floor`. */
function runWidth(profile, at, floor) {
  let a = at;
  let b = at;
  while (a > 0 && profile[a - 1] > floor) a--;
  while (b < profile.length - 1 && profile[b + 1] > floor) b++;
  return b - a + 1;
}

/**
 * The face region: the largest run of skin pixels, plus anything a dark band
 * merely cut off from it.
 *
 * Connectivity alone is not enough. A full dark beard is below the mask's
 * brightness threshold across the *entire* width of the chin, which severs the
 * neck from the face — so the region stopped at the beard, the beard was
 * therefore outside the face, and a beard became undetectable by being large.
 * A hard shadow under the jaw does the same thing.
 *
 * So: take the biggest component, then absorb any other component that sits
 * almost directly above or below it with only a small vertical gap. Two skin
 * regions in that arrangement are the same person interrupted by something
 * dark. The overlap and gap limits are what keep a bystander's face, or a hand
 * held out to the side, from being absorbed too.
 */
function faceRegion(mask, w, h) {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const comps = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;

    const cells = [];
    let x0 = w;
    let x1 = -1;
    let y0 = h;
    let y1 = -1;
    while (top > 0) {
      const p = stack[--top];
      cells.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[top++] = p - w; }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[top++] = p + w; }
    }
    comps.push({ cells, x0, x1, y0, y1, used: false });
  }
  if (comps.length === 0) return null;

  comps.sort((p, q) => q.cells.length - p.cells.length);
  const face = comps[0];
  face.used = true;
  const box = { x0: face.x0, x1: face.x1, y0: face.y0, y1: face.y1 };
  let out = face.cells;

  let changed = true;
  while (changed) {
    changed = false;
    for (const c of comps) {
      if (c.used) continue;
      const overlap = Math.min(box.x1, c.x1) - Math.max(box.x0, c.x0) + 1;
      const narrower = Math.min(box.x1 - box.x0, c.x1 - c.x0) + 1;
      const gap = c.y0 > box.y1 ? c.y0 - box.y1 : box.y0 > c.y1 ? box.y0 - c.y1 : 0;
      if (overlap < narrower * 0.4 || gap > (box.y1 - box.y0 + 1) * 0.3) continue;
      c.used = true;
      out = out.concat(c.cells);
      box.x0 = Math.min(box.x0, c.x0);
      box.x1 = Math.max(box.x1, c.x1);
      box.y0 = Math.min(box.y0, c.y0);
      box.y1 = Math.max(box.y1, c.y1);
      changed = true;
    }
  }
  return out;
}

/**
 * Measure the face in an RGBA buffer.
 *
 * @param {{width:number,height:number,data:Uint8ClampedArray|Uint8Array}} img
 * @returns {object} measurement, or `{ ok: false, reason }`
 */
export function measureFace(img) {
  const { width: w, height: h, data } = img;
  if (!w || !h) return { ok: false, reason: 'empty image' };

  const notes = [];

  // ---------------------------------------------------------------- skin ---
  const mask = new Uint8Array(w * h);
  let skinCount = 0;
  for (let i = 0, p = 0; p < w * h; p++, i += 4) {
    if (isSkin(data[i], data[i + 1], data[i + 2])) {
      mask[p] = 1;
      skinCount++;
    }
  }
  /**
   * Second pass: drop the darkest of the "skin" pixels.
   *
   * Brown hair lands squarely inside the skin chroma box — (60,45,35) gives a
   * Cr and a Cb that both pass — so without this the mask swallows the
   * hairline and every vertical proportion is measured from the top of
   * somebody's head. Hair is much darker than a lit face, so a threshold
   * relative to the mask's own median separates them. Kept gentle: a shadowed
   * cheek is only somewhat darker than a lit one, and losing that would eat
   * into the silhouette we are trying to measure.
   */
  if (skinCount > 40) {
    const sample = [];
    for (let p = 0; p < w * h; p += 3) {
      if (mask[p]) sample.push(luma(data, p * 4));
    }
    sample.sort((a, b) => a - b);
    const median = sample[sample.length >> 1] || 128;
    const floor = Math.max(42, median * 0.55);
    for (let p = 0; p < w * h; p++) {
      if (mask[p] && luma(data, p * 4) < floor) {
        mask[p] = 0;
        skinCount--;
      }
    }
  }

  const skinFrac = skinCount / (w * h);
  if (skinFrac < 0.012) return { ok: false, reason: 'no face found — try a brighter, closer photo' };
  if (skinFrac > 0.86) return { ok: false, reason: 'the whole frame reads as skin — try a plainer background' };

  const blob = faceRegion(mask, w, h);
  if (!blob || blob.length < 0.008 * w * h) {
    return { ok: false, reason: 'no face found — try a brighter, closer photo' };
  }

  // Keep only the winning blob, so the row profile below is the face's alone.
  const face = new Uint8Array(w * h);
  for (const p of blob) face[p] = 1;

  // ------------------------------------------------- silhouette profile ---
  // Per-row extent of the blob. This is the measurement that matters most: the
  // generator's head is a superellipse with a width curve down its length,
  // which is the same object as these numbers.
  const rowMin = new Int32Array(h).fill(-1);
  const rowMax = new Int32Array(h).fill(-1);
  const rowW = new Float64Array(h);
  for (const p of blob) {
    const x = p % w;
    const y = (p - x) / w;
    if (rowMin[y] < 0 || x < rowMin[y]) rowMin[y] = x;
    if (x > rowMax[y]) rowMax[y] = x;
  }
  for (let y = 0; y < h; y++) rowW[y] = rowMin[y] < 0 ? 0 : rowMax[y] - rowMin[y] + 1;

  /**
   * Bridge rows the dark-pixel filter emptied.
   *
   * A full dark beard is darker than the threshold across the *entire* width of
   * the chin, so those rows leave the mask altogether and the silhouette gets a
   * hole in it — after which the chin is not "inside the face" and the beard
   * cannot be measured, which is a memorable way to fail to detect a beard.
   * Interpolating the extent across a gap costs nothing, and fixes the same
   * problem for a hard shadow.
   */
  {
    let prev = -1;
    for (let y = 0; y < h; y++) {
      if (rowW[y] <= 0) continue;
      if (prev >= 0 && y - prev > 1) {
        for (let k = prev + 1; k < y; k++) {
          const t = (k - prev) / (y - prev);
          rowMin[k] = Math.round(rowMin[prev] + (rowMin[y] - rowMin[prev]) * t);
          rowMax[k] = Math.round(rowMax[prev] + (rowMax[y] - rowMax[prev]) * t);
          rowW[k] = rowMax[k] - rowMin[k] + 1;
        }
      }
      prev = y;
    }
  }

  /**
   * Is (x, y) inside the face silhouette?
   *
   * Deliberately the row *extent*, not membership of the mask. The dark-pixel
   * filter above removes hair from the mask — and with it the eyes, the brows
   * and a beard, which are the very things the profiles below are looking for.
   * Testing the mask would search for dark features in a mask built by
   * throwing dark features away.
   */
  const inside = (x, y) => y >= 0 && y < h && rowMin[y] >= 0 && x >= rowMin[y] && x <= rowMax[y];

  let top = 0;
  while (top < h && rowW[top] === 0) top++;
  let bottom = h - 1;
  while (bottom > top && rowW[bottom] === 0) bottom--;
  if (bottom - top < 14) return { ok: false, reason: 'the face is too small in the frame — crop closer' };

  // Light smoothing only: the chin is found from the *curvature* of this
  // profile further down, and a heavy blur rounds the corner away.
  const smoothW = smooth(rowW, Math.max(1, Math.round((bottom - top) * 0.015)));

  /**
   * Face width, without the neck.
   *
   * Everything vertical used to be measured as a fraction of the blob's own
   * height, which quietly included the neck and, in a photo with bare
   * shoulders, the shoulders — so the mouth band was searched somewhere around
   * the collarbone. Width is the robust quantity: a face is about 1.11 of its
   * own width from hairline to chin, so measure the width, predict the height
   * from it, then re-measure the width within that height. Two passes settle.
   */
  const hairline = top;
  let faceH0 = bottom - top;
  let widest = top;
  let faceW = 6;
  for (let pass = 0; pass < 3; pass++) {
    const limit = Math.min(bottom, Math.round(top + (pass === 0 ? (bottom - top) * 0.5 : faceH0)));
    widest = argmax(smoothW, top, limit + 1);
    faceW = Math.max(6, smoothW[widest]);
    faceH0 = faceW * 1.11;
  }
  const cx = (rowMin[widest] + rowMax[widest]) / 2;

  // ------------------------------------------------------ feature bands ---
  // Darkness averaged across the blob, row by row. Eyes, brows, nostrils and
  // the mouth line are all places where a face gets darker across its width.
  const bandBottom = Math.min(bottom, Math.round(hairline + faceH0 * 1.05));
  const band = new Float64Array(h);
  for (let y = top; y <= bandBottom; y++) {
    if (rowW[y] < 3) continue;
    let sum = 0;
    let n = 0;
    // Skip the outer eighth: the silhouette edge is dark on every row and
    // would drown the signal we are after.
    const pad = Math.round(rowW[y] * 0.12);
    for (let x = rowMin[y] + pad; x <= rowMax[y] - pad; x++) {
      sum += luma(data, (y * w + x) * 4);
      n++;
    }
    if (n > 0) band[y] = 255 - sum / n;
  }
  // Barely smoothed, and for a specific reason: the band splitter below
  // separates brows from eyes by the lit skin between them, and a kernel wide
  // enough to bridge that gap merges the two into one band whose centre is
  // neither. The features themselves are eight pixels and up, so a radius of
  // one or two is all the noise suppression needed.
  const dark = smooth(band, Math.max(1, Math.round(faceH0 * 0.008)));

  // The same row scan again, on the lip channel. Cheap, and it is what the
  // mouth is found with.
  const lipBand = new Float64Array(h);
  for (let y = top; y <= bandBottom; y++) {
    if (rowW[y] < 3) continue;
    let sum = 0;
    let n = 0;
    const pad = Math.round(rowW[y] * 0.12);
    for (let x = rowMin[y] + pad; x <= rowMax[y] - pad; x++) {
      sum += lipness(data, (y * w + x) * 4);
      n++;
    }
    if (n > 0) lipBand[y] = sum / n;
  }
  const lippy = smooth(lipBand, Math.max(1, Math.round(faceH0 * 0.008)));

  /**
   * The eye line.
   *
   * Three things in the upper face are dark bands, and picking the darkest row
   * gets the wrong one about half the time. Brows are solid bars and often
   * average darker across a row than a pair of eyes with lit skin between them.
   * A spectacle rim is dark across the whole width of its lens, so its row
   * out-darkens the eye's however pale the frame is — pick by row darkness and
   * the eye line lands a dozen pixels low on the bottom rim, compressing every
   * proportion measured afterwards by a fifth.
   *
   * Classifying the bands by how far they spread sideways was the second
   * attempt and also failed: a frame's vertical edges and its bridge fall in
   * the same rows as the eyes, which pushed the eye band's spread up to a
   * rim's.
   *
   * So work the other way round. Find the two *columns* the eyes are in — down
   * a whole column an eye socket accumulates more darkness than a lens centre
   * does — and only then ask which row is darkest there. At an eye's own column
   * the eye beats both the brow above it and the thin rim below, because it is
   * the darkest thing on a face and several times taller than a frame.
   *
   * The window is wide on purpose. Predicting height from width assumes an
   * ordinary face, and the point of all this is to measure faces that are not.
   */
  const eyeY = (() => {
    const lo = Math.max(1, Math.round(hairline + faceH0 * 0.08));
    const hi = Math.min(h - 2, Math.round(hairline + faceH0 * 0.6));
    if (hi <= lo) return lo;

    const down = new Float64Array(w);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let y = lo; y <= hi; y++) {
        if (!inside(x, y)) continue;
        sum += 255 - luma(data, (y * w + x) * 4);
        n++;
      }
      down[x] = n > 3 ? sum / n : 0;
    }
    const colDown = smooth(down, Math.max(1, Math.round(faceW * 0.02)));
    const xL = argmax(colDown, cx - faceW * 0.44, cx - faceW * 0.06);
    const xR = argmax(colDown, cx + faceW * 0.06, cx + faceW * 0.44);

    /** Darkest row within the window, averaged over a column's width. */
    const rowAt = (x0) => {
      const half = Math.max(2, Math.round(faceW * 0.055));
      const prof = new Float64Array(h);
      for (let y = lo; y <= hi; y++) {
        let sum = 0;
        let n = 0;
        for (let x = Math.round(x0 - half); x <= Math.round(x0 + half); x++) {
          if (x < 0 || x >= w) continue;
          sum += 255 - luma(data, (y * w + x) * 4);
          n++;
        }
        prof[y] = n ? sum / n : 0;
      }
      return argmax(prof, lo, hi + 1);
    };

    return Math.round((rowAt(xL) + rowAt(xR)) / 2);
  })();

  /**
   * The mouth line: the reddest band, discounted by how far it is from where a
   * mouth belongs.
   *
   * Measured on the lip channel rather than on darkness, for the reasons given
   * at `lipness`, and then still weighted: a moustache is reddish too.
   *
   * Distance from the eyes to the mouth is a stable fraction of face *width*
   * across real faces, so weight the darkness by a soft bell around that
   * expectation instead of imposing a hard window. A genuinely low mouth still
   * wins if it is clearly the darkest thing; a beard two thirds of a face-width
   * down does not.
   */
  const mouthY = (() => {
    const lo = Math.max(eyeY + 2, Math.round(eyeY + faceW * 0.2));
    const hi = Math.min(bandBottom, Math.round(eyeY + faceW * 0.9));
    if (hi <= lo) return Math.min(bandBottom, Math.round(eyeY + faceW * 0.455));
    const expect = eyeY + faceW * 0.455;
    const sigma = faceW * 0.13;
    let floor = Infinity;
    for (let y = lo; y <= hi; y++) if (lippy[y] < floor) floor = lippy[y];
    let best = lo;
    let bestV = -Infinity;
    for (let y = lo; y <= hi; y++) {
      const v = (lippy[y] - floor) * Math.exp(-0.5 * ((y - expect) / sigma) ** 2);
      if (v > bestV) {
        bestV = v;
        best = y;
      }
    }
    return best;
  })();

  /**
   * Scale the head from the eye-to-mouth distance.
   *
   * Both of those lines are measured directly and confidently. The crown is
   * hidden under hair and the hairline sits at a different height on everyone,
   * so deriving the head from them would import that error into every ratio.
   * In the generator's own coordinates the eye line is at 0.46 of the head and
   * the mouth at 0.76, so their gap is 0.30 of the head — invert that.
   */
  const eyeToMouth = Math.max(5, mouthY - eyeY);
  const headH = eyeToMouth / 0.3;
  const crownY = eyeY - headH * 0.46;

  /**
   * The chin: the corner where the jaw stops narrowing.
   *
   * Two shapes have to work. With shoulders in frame the silhouette widens
   * again below the jaw; with a bare neck it simply stops narrowing. Both are
   * the same event in the second derivative of the width profile, so take the
   * most convex row — bracketed by where the eye/mouth ruler says a chin can
   * possibly be, which is what stops a shoulder from being nominated.
   */
  const chin = (() => {
    // Bracket it from both directions. The mouth line is the more precise
    // anchor but a dark beard can drag it downwards, and then a mouth-only
    // bracket reaches past the jaw and nominates the bottom of the neck. The
    // hairline and the width prediction are coarse but cannot drift that way,
    // so the intersection of the two is narrower than either.
    const lo = Math.max(top + 2, Math.round(mouthY + headH * 0.1), Math.round(hairline + faceH0 * 0.85));
    const hi = Math.min(h - 2, Math.round(mouthY + headH * 0.36), Math.round(hairline + faceH0 * 1.25));
    if (hi <= lo) return Math.min(h - 1, Math.round(mouthY + headH * 0.24));
    let best = Math.round(mouthY + headH * 0.24);
    let bestCurv = -Infinity;
    for (let y = lo; y <= hi; y++) {
      // The silhouette ending outright is a chin — but only if nothing better
      // turned up on the way down. Returning here unconditionally meant that a
      // photo cropped below the collar had its chin placed at the bottom of the
      // neck, throwing away the jaw corner the loop had already found.
      if (rowW[y] < faceW * 0.12) {
        if (bestCurv <= 0) best = Math.max(lo, y - 1);
        break;
      }
      const curv = smoothW[y - 1] - 2 * smoothW[y] + smoothW[y + 1];
      if (curv > bestCurv) {
        bestCurv = curv;
        best = y;
      }
    }
    return best;
  })();

  const faceH = Math.max(8, chin - hairline);

  const noseY = argmax(dark, eyeY + eyeToMouth * 0.3, mouthY - eyeToMouth * 0.18);

  // ------------------------------------------------------------- eyes ----
  // Column darkness inside a band around the eye line, then the strongest
  // trough each side of centre. Eyes are the only thing there that is dark.
  const eyeBand = Math.max(2, Math.round(headH * 0.045));
  const cols = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let n = 0;
    for (let y = eyeY - eyeBand; y <= eyeY + eyeBand; y++) {
      if (!inside(x, y)) continue;
      sum += 255 - luma(data, (y * w + x) * 4);
      n++;
    }
    cols[x] = n > 2 ? sum / n : 0;
  }
  const colD = smooth(cols, Math.max(1, Math.round(faceW * 0.02)));
  const inset = faceW * 0.06;
  const eyeL = argmax(colD, cx - faceW / 2 + inset, cx - faceW * 0.06);
  const eyeR = argmax(colD, cx + faceW * 0.06, cx + faceW / 2 - inset);
  const interEye = Math.max(faceW * 0.2, eyeR - eyeL);

  const eyeFloor = ((colD[eyeL] + colD[eyeR]) / 2) * 0.72;
  const eyeWidth = Math.max(2, (runWidth(colD, eyeL, eyeFloor) + runWidth(colD, eyeR, eyeFloor)) / 2);

  /**
   * Aperture: how tall the dark patch is against how wide.
   *
   * A closed or hooded eye is a line; a wide one is nearly a disc. This is the
   * one eye measurement that maps cleanly onto the drawn styles.
   */
  function eyeShapeAt(x0) {
    const colBand = new Float64Array(h);
    const wid = Math.max(1, Math.round(eyeWidth * 0.3));
    const y0 = Math.max(0, eyeY - eyeBand * 3);
    const y1 = Math.min(h - 1, eyeY + eyeBand * 3);
    for (let y = y0; y <= y1; y++) {
      let sum = 0;
      let n = 0;
      for (let x = Math.round(x0 - wid); x <= Math.round(x0 + wid); x++) {
        if (x < 0 || x >= w) continue;
        sum += 255 - luma(data, (y * w + x) * 4);
        n++;
      }
      colBand[y] = n ? sum / n : 0;
    }
    const peak = argmax(colBand, eyeY - eyeBand * 2, eyeY + eyeBand * 2 + 1);
    return { h: runWidth(colBand, peak, colBand[peak] * 0.72), y: peak };
  }
  const eL = eyeShapeAt(eyeL);
  const eR = eyeShapeAt(eyeR);
  const aperture = clamp(((eL.h + eR.h) / 2) / eyeWidth, 0.06, 1.4);
  const eyeTilt = Math.atan2(eR.y - eL.y, Math.max(1, eyeR - eyeL));

  // --------------------------------------------------------------- brows --
  // A band above the eyes. Thickness comes from how many rows stay dark, which
  // separates "none" from "bushy" without needing to find an edge.
  const browTop = Math.round(eyeY - headH * 0.115);
  const browBot = Math.round(eyeY - headH * 0.035);
  let browDark = 0;
  let browRows = 0;
  for (let y = browTop; y <= browBot; y++) {
    if (y < 0 || y >= h) continue;
    browDark += dark[y];
    browRows++;
  }
  browDark = browRows ? browDark / browRows : 0;

  /** Mid-cheek: bare skin on almost everyone, so it sets what "not dark" is. */
  const cheekRef = (() => {
    let sum = 0;
    let n = 0;
    const y0 = Math.round(eyeY + eyeToMouth * 0.25);
    const y1 = Math.round(eyeY + eyeToMouth * 0.6);
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= h || rowW[y] < 4) continue;
      for (const side of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const x = Math.round(cx + side * faceW * (0.24 + k * 0.045));
          if (!inside(x, y)) continue;
          sum += 255 - luma(data, (y * w + x) * 4);
          n++;
        }
      }
    }
    return n > 8 ? sum / n : 128;
  })();
  const browStrength = clamp((browDark - cheekRef) / 40, 0, 2);

  // --------------------------------------------------------------- mouth --
  const mouthBand = Math.max(2, Math.round(headH * 0.035));
  const mcols = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let n = 0;
    for (let y = mouthY - mouthBand; y <= mouthY + mouthBand; y++) {
      if (!inside(x, y)) continue;
      sum += lipness(data, (y * w + x) * 4);
      n++;
    }
    mcols[x] = n > 2 ? sum / n : 0;
  }
  const mD = smooth(mcols, Math.max(1, Math.round(faceW * 0.015)));
  /**
   * Centre of the mouth, as a darkness-weighted centroid.
   *
   * Not an argmax. Across a band the width of a lip the profile is nearly flat,
   * so the darkest column is decided by noise — on a smiling test face it came
   * out fourteen pixels off-centre, which pushed the curvature window half off
   * the mouth and read the smile as a scowl.
   */
  const mouthCentre = (() => {
    const a = Math.max(0, Math.round(cx - faceW * 0.3));
    const b = Math.min(w - 1, Math.round(cx + faceW * 0.3));
    let floor = Infinity;
    for (let x = a; x <= b; x++) if (mD[x] < floor) floor = mD[x];
    let num = 0;
    let den = 0;
    for (let x = a; x <= b; x++) {
      const wgt = Math.max(0, mD[x] - floor) ** 2;
      num += wgt * x;
      den += wgt;
    }
    return den > 0 ? Math.round(num / den) : Math.round(cx);
  })();
  // Floor the run against bare cheek rather than against the mouth's own peak:
  // a fraction of the peak still counts ambient shading as mouth, which ran the
  // measured width out past the corners and had the curvature reading lip
  // shadow on skin.
  const lipFloor = (() => {
    let m = Infinity;
    for (let x = Math.round(cx - faceW * 0.45); x <= Math.round(cx + faceW * 0.45); x++) {
      if (x >= 0 && x < w && mD[x] < m) m = mD[x];
    }
    return Number.isFinite(m) ? m : 0;
  })();
  const mouthWidth = Math.max(3, runWidth(mD, mouthCentre, lipFloor + (mD[mouthCentre] - lipFloor) * 0.45));

  /**
   * Mouth curvature — the whole of the expression measurement.
   *
   * Follow the darkest row per column across the mouth and compare the corners
   * with the middle. Corners above the centre is a smile; below is a scowl. It
   * is one number, and it is the only one a doodle can act on.
   */
  const mouthCurve = (() => {
    const x0 = Math.round(mouthCentre - mouthWidth * 0.4);
    const x1 = Math.round(mouthCentre + mouthWidth * 0.4);
    if (x1 - x0 < 6) return 0;
    // Keep the nostrils out: they sit a little above the mouth, they are dark,
    // and letting them into the window drags the centre columns upwards and
    // fakes a downturn on every face.
    const lo = Math.max(0, Math.round(Math.max(noseY + (mouthY - noseY) * 0.4, mouthY - mouthBand * 2)));
    const hi = Math.min(h - 1, mouthY + mouthBand * 2);

    /**
     * Where the mouth sits in this column, as a darkness-weighted centre.
     *
     * A centroid rather than the darkest row: on a column that happens to hold
     * no mouth at all, argmax returns whichever row it saw first, which
     * manufactured a curvature out of nothing and read a flat mouth as a broad
     * grin. A centroid has no such tie to break, and a column with nothing dark
     * in it says so and is dropped.
     */
    const centre = (x) => {
      // Floored against this column's own least-red row. A shared floor let a
      // beard outvote the lips by sheer area; a per-column one leaves only the
      // difference between them, which is the whole signal.
      let colFloor = Infinity;
      for (let y = lo; y <= hi; y++) {
        const v = lipness(data, (y * w + x) * 4);
        if (v < colFloor) colFloor = v;
      }
      let num = 0;
      let den = 0;
      let peak = 0;
      for (let y = lo; y <= hi; y++) {
        const d = Math.max(0, lipness(data, (y * w + x) * 4) - colFloor - 0.08);
        if (d > peak) peak = d;
        num += d * y;
        den += d;
      }
      return peak > 0.1 && den > 0 ? num / den : null;
    };

    // Collect only the columns that actually hold a mouth, then take the
    // corners and the middle of *those*. Slicing the raw list instead let a
    // run of empty columns on one side count as a corner.
    const found = [];
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      const y = centre(x);
      if (y !== null) found.push(y);
    }
    const n = found.length;
    if (n < 8) return 0;
    const edge = Math.max(1, Math.round(n * 0.2));
    const mean = (list) => list.reduce((p, q) => p + q, 0) / list.length;
    const corners = (mean(found.slice(0, edge)) + mean(found.slice(n - edge))) / 2;
    const mid = mean(found.slice(Math.round(n * 0.38), Math.round(n * 0.62) + 1));
    // y grows downwards, so corners above the middle is a positive mood.
    return clamp((mid - corners) / (headH * 0.035), -1.6, 1.6);
  })();

  /** Teeth: a bright run inside the dark mouth means it is open and showing. */
  const teeth = (() => {
    let bright = 0;
    let n = 0;
    for (let y = mouthY - mouthBand; y <= mouthY + mouthBand; y++) {
      if (y < 0 || y >= h) continue;
      for (let x = Math.round(mouthCentre - mouthWidth * 0.3); x <= Math.round(mouthCentre + mouthWidth * 0.3); x++) {
        if (x < 0 || x >= w) continue;
        if (luma(data, (y * w + x) * 4) > 168) bright++;
        n++;
      }
    }
    return n > 10 ? bright / n : 0;
  })();

  // --------------------------------------------------------------- nose ---
  const noseWidth = (() => {
    const ncols = new Float64Array(w);
    const nb = Math.max(1, Math.round(headH * 0.02));
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let y = noseY - nb; y <= noseY + nb; y++) {
        if (!inside(x, y)) continue;
        sum += 255 - luma(data, (y * w + x) * 4);
        n++;
      }
      ncols[x] = n > 1 ? sum / n : 0;
    }
    const nD = smooth(ncols, Math.max(1, Math.round(faceW * 0.012)));
    const at = argmax(nD, cx - faceW * 0.2, cx + faceW * 0.2);
    return runWidth(nD, at, nD[at] * 0.7);
  })();

  // ------------------------------------------------------------ glasses ---
  // Rims are long horizontal dark edges spanning both eyes, plus a bridge in
  // the gap where a bare face has nothing but skin.
  const glasses = (() => {
    const bridgeX = Math.round((eyeL + eyeR) / 2);
    let bridge = 0;
    let n = 0;
    for (let y = eyeY - eyeBand; y <= eyeY + eyeBand; y++) {
      for (let x = bridgeX - 2; x <= bridgeX + 2; x++) {
        if (y < 0 || y >= h || x < 0 || x >= w) continue;
        bridge += 255 - luma(data, (y * w + x) * 4);
        n++;
      }
    }
    bridge = n ? bridge / n : 0;

    /**
     * How far darkness reaches across the eye band.
     *
     * Gradient energy was the first attempt, and separated a bare face from a
     * bespectacled one by too small a margin to act on. Span is the real cue: a
     * bare face is dark at two eyes and nowhere else, about 40% of its width,
     * while rims and a bridge carry darkness nearly the whole way across.
     */
    let lit = 0;
    let cells = 0;
    for (let x = Math.round(cx - faceW * 0.45); x <= Math.round(cx + faceW * 0.45); x++) {
      if (x < 0 || x >= w) continue;
      let peak = 0;
      for (let y = eyeY - eyeBand * 2; y <= eyeY + eyeBand * 2; y++) {
        if (!inside(x, y)) continue;
        peak = Math.max(peak, 255 - luma(data, (y * w + x) * 4));
      }
      if (peak > cheekRef + 26) lit++;
      cells++;
    }
    const span = cells ? lit / cells : 0;
    const amount = clamp((span - 0.46) / 0.32 + ((bridge - cheekRef) / 60) * 0.5, 0, 2);

    // Dark lenses: the eye band goes uniformly black, so the sockets stop being
    // the darkest thing in it and the "eye" reads as tall as it is wide.
    const socketDark = (colD[eyeL] + colD[eyeR]) / 2;
    return { amount, dark: socketDark > cheekRef + 62 && aperture > 0.34 && amount > 0.5 };
  })();

  // --------------------------------------------------------------- beard ---
  // Skin under the mouth against skin on the cheek: darker *and* rougher is
  // hair. Darker alone is just the shadow under a jaw, which everyone has.
  const beard = (() => {
    function patch(y0, y1, xa, xb) {
      let sum = 0;
      let sq = 0;
      let n = 0;
      for (let y = Math.round(y0); y <= Math.round(y1); y++) {
        if (y < 1 || y >= h - 1) continue;
        for (let x = Math.round(xa); x <= Math.round(xb); x++) {
          if (x < 1 || x >= w - 1 || !inside(x, y)) continue;
          sum += 255 - luma(data, (y * w + x) * 4);
          sq += Math.abs(luma(data, (y * w + x + 1) * 4) - luma(data, (y * w + x - 1) * 4));
          n++;
        }
      }
      return n > 12 ? { dark: sum / n, rough: sq / n } : null;
    }
    const chinP = patch(mouthY + eyeToMouth * 0.16, chin - headH * 0.01, cx - faceW * 0.2, cx + faceW * 0.2);
    const cheekP = patch(eyeY + eyeToMouth * 0.2, eyeY + eyeToMouth * 0.55, cx - faceW * 0.34, cx - faceW * 0.16);
    const lipP = patch(noseY + headH * 0.012, mouthY - mouthBand, cx - faceW * 0.16, cx + faceW * 0.16);
    const jawP = patch(mouthY - eyeToMouth * 0.1, mouthY + eyeToMouth * 0.3, cx - faceW * 0.46, cx - faceW * 0.3);
    if (!chinP || !cheekP) return { amount: 0, moustache: 0, jawline: 0 };
    const score = (p) => clamp(((p.dark - cheekP.dark) / 42) * 0.7 + ((p.rough - cheekP.rough) / 16) * 0.6, 0, 2);
    return {
      amount: score(chinP),
      moustache: lipP ? score(lipP) : 0,
      jawline: jawP ? score(jawP) : 0,
    };
  })();

  // ---------------------------------------------------------------- hair ---
  // Hair is whatever is *not* skin and *not* background, above and beside the
  // face. Background is estimated from the corners; if the corners disagree
  // with each other the photo is busy and this whole block is a guess.
  const hair = (() => {
    const s = Math.max(2, Math.round(Math.min(w, h) * 0.05));
    const patchAt = (x0, y0) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = y0; y < y0 + s; y++) {
        for (let x = x0; x < x0 + s; x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2];
          n++;
        }
      }
      return n ? [r / n, g / n, b / n] : null;
    };
    const corners = [patchAt(0, 0), patchAt(w - s, 0), patchAt(0, h - s), patchAt(w - s, h - s)].filter(Boolean);
    const bg = [0, 1, 2].map((k) => corners.reduce((a, c) => a + c[k], 0) / Math.max(1, corners.length));
    const spread = corners.reduce(
      (m, c) => Math.max(m, Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2])),
      0,
    );
    const busy = spread > 110;
    if (busy) notes.push('busy background — hair volume is a guess');

    const isBg = (x, y) => {
      const i = (y * w + x) * 4;
      return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 78;
    };

    // Walk up the centre from the hairline; stop where the background starts.
    let crown = hairline;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    let rough = 0;
    const limit = Math.max(0, Math.round(hairline - headH * 0.62));
    for (let y = hairline - 1; y >= limit; y--) {
      let solid = 0;
      let tried = 0;
      for (let k = -3; k <= 3; k++) {
        const x = Math.round(cx + k * faceW * 0.11);
        if (x < 0 || x >= w) continue;
        tried++;
        if (!isBg(x, y)) {
          solid++;
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2];
          // Texture, for telling hair from a hat: strands are high-frequency,
          // knitted wool at this scale is nearly flat. Without this, a beanie
          // reads as an enormous volume of hair and comes back as an afro.
          if (x > 0 && x < w - 1) {
            rough += Math.abs(luma(data, (y * w + x + 1) * 4) - luma(data, (y * w + x - 1) * 4));
          }
          n++;
        }
      }
      if (tried === 0 || solid / tried < 0.55) break;
      crown = y;
    }
    const volume = clamp((hairline - crown) / (headH * 0.3), 0, 2.5);

    // How far the non-background silhouette reaches below the eye line beside
    // the face — that is what separates a bob from a crop.
    let side = 0;
    for (const dir of [-1, 1]) {
      let reach = 0;
      for (let y = eyeY; y <= Math.min(h - 1, chin + headH * 0.5); y++) {
        const x = Math.round(cx + dir * faceW * 0.62);
        if (x < 0 || x >= w) break;
        if (isBg(x, y) || inside(x, y)) break;
        reach = y - eyeY;
      }
      side = Math.max(side, reach / headH);
    }

    const rgb = n > 20 ? [r / n, g / n, b / n] : null;
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

  // ---------------------------------------------------------------- skin ---
  // The one place the mask itself is the right test: here we want the colour of
  // actual lit skin, so the dark pixels it dropped are exactly the ones to skip.
  const skinRgb = (() => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = Math.round(eyeY + eyeToMouth * 0.2); y <= Math.round(eyeY + eyeToMouth * 0.6); y++) {
      if (y < 0 || y >= h) continue;
      for (let x = Math.round(cx - faceW * 0.36); x <= Math.round(cx + faceW * 0.36); x++) {
        if (x < 0 || x >= w || !face[y * w + x]) continue;
        const i = (y * w + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2];
        n++;
      }
    }
    return n > 20 ? [r / n, g / n, b / n] : [200, 165, 140];
  })();

  // ----------------------------------------------------------------- pose --
  /**
   * Yaw from where the features sit inside the silhouette.
   *
   * The renderer turns a head by a cylindrical projection, under which the
   * centre line lands at `w · tan(yaw)`. So invert that: how far the midpoint
   * of the eyes has drifted off the silhouette's own centre says how far round
   * the head is. Capped well short of the projection's ugly range.
   */
  const eyeMid = (eyeL + eyeR) / 2;
  const silRow = Math.max(0, Math.min(h - 1, eyeY));
  const silCentre = rowMin[silRow] < 0 ? cx : (rowMin[silRow] + rowMax[silRow]) / 2;
  const drift = (eyeMid - silCentre) / (faceW / 2);
  const yaw = clamp(Math.atan(drift * 0.9), -0.34, 0.34);

  // -------------------------------------------------------- confidence ----
  // Honest self-assessment, shown to the user. A face that scores badly here
  // is one where the overlay will visibly not line up, which is much kinder
  // than silently handing back a stranger.
  const symmetry = 1 - Math.min(1, Math.abs(Math.abs(eyeL - cx) - Math.abs(eyeR - cx)) / (faceW * 0.25));
  const eyeSep = clamp((interEye / faceW - 0.24) / 0.24, 0, 1);
  const bandSep = clamp((dark[eyeY] - cheekRef) / 45, 0, 1);
  const proportion = 1 - Math.min(1, Math.abs(headH / (faceH / 0.73) - 1));
  const confidence = clamp(0.25 * symmetry + 0.25 * eyeSep + 0.3 * bandSep + 0.2 * proportion, 0, 1);
  if (confidence < 0.45) notes.push('low confidence — a plain, front-on, well-lit photo works best');

  return {
    ok: true,
    confidence,
    notes,
    image: { w, h },

    head: { crownY, chinY: chin, hairlineY: hairline, cx, faceW, headH },
    ratios: {
      // cheek width against the head's own height — the master ratio
      aspect: faceW / headH,
      // width at the jaw and at the brow, both against the cheek width
      jaw: smoothW[Math.min(h - 1, Math.round(chin - faceH * 0.16))] / faceW,
      brow: smoothW[Math.max(0, Math.round(hairline + faceH * 0.08))] / faceW,
      // how much of its bounding box the silhouette fills: 0.79 is an ellipse,
      // more is a boxy skull, less is a pointed one
      fill: blob.length / (faceW * faceH),
    },

    eyes: {
      x: [eyeL, eyeR],
      y: eyeY,
      spacing: interEye / faceW,
      width: eyeWidth / faceW,
      aperture,
      tilt: eyeTilt,
    },
    brows: { y: (browTop + browBot) / 2, strength: browStrength },
    nose: { y: noseY, width: noseWidth / faceW, t: (noseY - crownY) / headH },
    mouth: {
      y: mouthY,
      width: mouthWidth / faceW,
      curve: mouthCurve,
      teeth,
      t: (mouthY - crownY) / headH,
    },
    hair,
    beard,
    glasses,
    skin: { rgb: skinRgb },
    yaw,
    tilt: clamp(eyeTilt, -0.26, 0.26),
    // eye line as a fraction of the head, for the fit to compare with 0.46
    eyeT: (eyeY - crownY) / headH,
  };
}

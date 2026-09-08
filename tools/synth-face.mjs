/**
 * A synthetic portrait, built from explicit proportions.
 *
 * Used by test-photo.mjs: there is no way to unit-test "looks like me", but
 * there is a way to test the chain that claims to — draw a face whose
 * measurements are known by construction, then check they come back out.
 *
 * Flat colour and hard edges, deliberately. A synthetic face is much easier
 * than a real one, so passing against it is a floor, not a ceiling.
 */

const W = 240;
const H = 300;

/** Build a flat RGBA portrait from explicit proportions. */
export function synth(o = {}) {
  const p = {
    faceW: 110,
    // Hairline to chin, at the ordinary 1.11 of face width. The first value
    // here was 150, which is a much narrower face than anyone has, and made
    // every check run against a caricature.
    faceH: 122,
    hairTop: 34,     // rows of hair above the hairline
    eyeSpacing: 0.44, // × faceW, pupil to pupil
    eyeW: 22,
    eyeH: 8,
    brow: 6,         // brow bar thickness, 0 for none
    mouthW: 40,
    mouthCurve: 0,   // +ve = corners up
    beard: 0,        // 0..1 darkening of the chin
    glasses: false,
    hairRgb: [58, 44, 34],
    skinRgb: [226, 182, 152],
    hat: false,
    ...o,
  };

  const data = new Uint8ClampedArray(W * H * 4);
  const px = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (Math.round(y) * W + Math.round(x)) * 4;
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
  };
  const rect = (x0, y0, x1, y1, rgb) => {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) {
      for (let x = Math.round(x0); x <= Math.round(x1); x++) px(x, y, rgb);
    }
  };
  const ellipse = (cx, cy, rx, ry, rgb) => {
    for (let y = Math.round(cy - ry); y <= Math.round(cy + ry); y++) {
      for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) px(x, y, rgb);
      }
    }
  };

  const bg = [214, 216, 222];
  rect(0, 0, W - 1, H - 1, bg);

  const cx = W / 2;
  const hairline = 60;
  const chin = hairline + p.faceH;

  // hair (or a hat: same silhouette, but flat — no strand texture at all)
  const crownRgb = p.hat ? [40, 60, 96] : p.hairRgb;
  ellipse(cx, hairline + 6, p.faceW * 0.58, p.hairTop + 6, crownRgb);
  if (!p.hat) {
    // strand texture, which is how the measurement tells hair from wool
    for (let y = hairline - p.hairTop; y < hairline; y++) {
      for (let x = cx - p.faceW * 0.55; x < cx + p.faceW * 0.55; x += 3) {
        px(x, y, [p.hairRgb[0] + 60, p.hairRgb[1] + 55, p.hairRgb[2] + 50]);
      }
    }
  }

  // face, then a bare neck down to the collar — the common portrait, and the
  // harder one: the silhouette stops narrowing rather than widening again
  ellipse(cx, (hairline + chin) / 2, p.faceW / 2, p.faceH / 2, p.skinRgb);
  rect(cx - p.faceW * 0.22, chin - 6, cx + p.faceW * 0.22, chin + 46, p.skinRgb);

  const eyeY = hairline + p.faceH * 0.35;
  const dx = (p.eyeSpacing * p.faceW) / 2;
  for (const side of [-1, 1]) {
    ellipse(cx + side * dx, eyeY, p.eyeW / 2, p.eyeH / 2, [38, 34, 34]);
    if (p.brow > 0) {
      rect(cx + side * dx - p.eyeW * 0.6, eyeY - 16 - p.brow, cx + side * dx + p.eyeW * 0.6, eyeY - 16, [48, 38, 32]);
    }
  }

  if (p.glasses) {
    // Mid-grey, not black. A photographed frame is rarely darker than the
    // pupil and lash region it sits around, and modelling it as the darkest
    // thing on the face was making the eye line land on the lower rim.
    for (const side of [-1, 1]) {
      const gx = cx + side * dx;
      rect(gx - 20, eyeY - 14, gx + 20, eyeY - 12, [74, 74, 80]);
      rect(gx - 20, eyeY + 12, gx + 20, eyeY + 14, [74, 74, 80]);
      rect(gx - 20, eyeY - 14, gx - 18, eyeY + 14, [74, 74, 80]);
      rect(gx + 18, eyeY - 14, gx + 20, eyeY + 14, [74, 74, 80]);
    }
    rect(cx - dx + 20, eyeY - 2, cx + dx - 20, eyeY, [74, 74, 80]);
  }

  // nostrils
  const noseY = hairline + p.faceH * 0.66;
  for (const side of [-1, 1]) ellipse(cx + side * 7, noseY, 4, 3, [150, 110, 92]);

  // Beard: blend the chin towards a hair colour, with texture.
  //
  // The first version darkened by subtracting the same amount from all three
  // channels, which is not what hair does — it cuts the smaller channels
  // proportionally hardest and so shifts the hue towards red, making the beard
  // score as *lip* and inverting the measured smile. Blending towards an actual
  // brown-grey leaves the beard no redder than the skin it covers, which is the
  // truth about beards.
  if (p.beard > 0) {
    const hair = [72, 58, 48];
    const y0 = hairline + p.faceH * 0.78;
    for (let y = y0; y < chin; y++) {
      for (let x = cx - p.faceW * 0.34; x < cx + p.faceW * 0.34; x++) {
        const i = (Math.round(y) * W + Math.round(x)) * 4;
        if (data[i + 3] === 0) continue;
        const noise = (Math.round(x) * 7 + Math.round(y) * 3) % 5 / 4;
        const t = p.beard * (0.72 + 0.28 * noise);
        for (let k = 0; k < 3; k++) data[i + k] = data[i + k] * (1 - t) + hair[k] * t;
      }
    }
  }

  // mouth, bent by mouthCurve
  const mouthY = hairline + p.faceH * 0.76;
  for (let x = -p.mouthW / 2; x <= p.mouthW / 2; x++) {
    const u = (x / (p.mouthW / 2)) ** 2;
    const y = mouthY - p.mouthCurve * 9 * u;
    for (let k = -2; k <= 2; k++) px(cx + x, y + k, [96, 52, 52]);
  }

  return { width: W, height: H, data, truth: { cx, hairline, chin, eyeY, mouthY, faceW: p.faceW } };
}


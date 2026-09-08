/**
 * Find a face in a photograph, and the points that make it up.
 *
 * The rest of this project is dependency-free and this file is the exception.
 * It is worth explaining why, because the first version of the photo feature
 * deliberately went without.
 *
 * The argument then was that a fifteen-stroke doodle needs a handful of coarse
 * ratios, so sub-pixel landmarks would be thrown away at the moment of
 * quantising into "square skull or pear". That is still true — and it answered
 * the wrong question. Precision was never what failed. *Detection* failed.
 * Skin-chroma segmentation finds a face beautifully on a flat drawing against a
 * plain ground, and on nineteen real photographs — a café, a bar, a snowy
 * forest, a hand resting on a jaw, people in the background — it claimed
 * spectacles on two thirds of them, read 84% of the eyes as saucers, and on
 * several photos decided the "face" was most of the frame. The synthetic tests
 * were validating the plumbing, not the perception.
 *
 * So: MediaPipe's face landmarker, fetched lazily and only when someone
 * actually opens the photo panel. Nothing is downloaded for a visitor who never
 * uses it.
 *
 * **The photo still never leaves the tab.** The model travels to the image, not
 * the image to a server: these are ordinary GETs for a WASM runtime and a
 * weights file, carrying nothing. What is lost is the stronger claim that the
 * page makes no request at all, which is why `photo.js` is kept as a working
 * fallback for when the model cannot be fetched.
 */

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** Roughly what a first use costs, for an honest progress message. */
export const DOWNLOAD_MB = 6.1;

let ready = null;

/**
 * Load the detector. Safe to call repeatedly: the work happens once.
 *
 * @returns {Promise<object|null>} the landmarker, or null if it could not load
 */
export function loadLandmarker() {
  if (ready) return ready;
  ready = (async () => {
    // Assembled at runtime so a bundler cannot try to resolve a remote URL at
    // build time — `tools/build-single.mjs` would fail on a literal.
    const bundle = `${CDN}/vision_bundle.mjs`;
    const vision = await import(/* webpackIgnore: true */ /* @vite-ignore */ bundle);
    const files = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    return vision.FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      // Blendshapes are the reason to take the full landmarker rather than the
      // small detector: they read a smile straight off the face, which is a far
      // steadier signal than chasing the darkest row along a lip.
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'IMAGE',
      numFaces: 5,
    });
  })().catch(() => {
    // Offline, blocked, or an ancient browser. The caller falls back.
    ready = null;
    return null;
  });
  return ready;
}

/** Has the model already been fetched? Lets the UI warn before a big download. */
export function isLoaded() {
  return ready !== null;
}

/**
 * Detect the most prominent face in an image.
 *
 * "Most prominent" is the widest, not the first: a portrait taken in a café has
 * strangers in it, and the subject is the one filling the frame.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} image
 * @returns {Promise<{points: {x:number,y:number,z:number}[], shapes: object, matrix: number[]|null, faces: number}|null>}
 *   points are in pixels of the image passed in
 */
export async function detectFace(image) {
  const landmarker = await loadLandmarker();
  if (!landmarker) return null;

  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  let result;
  try {
    result = landmarker.detect(image);
  } catch {
    return null;
  }
  const all = result?.faceLandmarks || [];
  if (all.length === 0) return null;

  let best = 0;
  let bestW = -1;
  for (let i = 0; i < all.length; i++) {
    const lm = all[i];
    const width = Math.abs(lm[454].x - lm[234].x);
    if (width > bestW) {
      bestW = width;
      best = i;
    }
  }

  const points = all[best].map((p) => ({ x: p.x * w, y: p.y * h, z: p.z * w }));

  /** Blendshapes as a plain name → score object. */
  const shapes = {};
  for (const c of result.faceBlendshapes?.[best]?.categories || []) {
    shapes[c.categoryName] = c.score;
  }

  return {
    points,
    shapes,
    matrix: result.facialTransformationMatrixes?.[best]?.data || null,
    faces: all.length,
  };
}

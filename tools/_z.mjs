import { synth } from './synth-face.mjs';
import { measureFace } from '../src/faces/photo.js';
import { readMeasurement } from '../src/faces/fit.js';
for (const [n,o] of [
  ['frown only', {mouthCurve:-0.9, eyeH:5}],
  ['+ blond hair', {hairRgb:[214,198,160], hairTop:54, mouthCurve:-0.9, eyeH:5}],
  ['+ blond, dark eyes', {hairRgb:[214,198,160], hairTop:54, mouthCurve:-0.9}],
]) {
  const m = measureFace(synth(o));
  const r = readMeasurement(m);
  console.log(n.padEnd(20), 'curve', m.mouth.curve.toFixed(2), 'teeth', m.mouth.teeth.toFixed(2),
    'mouthY', m.mouth.y, 'mw', (m.mouth.width*m.head.faceW).toFixed(0), 'set', JSON.stringify(r.sets.mouth));
}

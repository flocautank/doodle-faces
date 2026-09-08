/**
 * Stamp a content hash onto the asset links in index.html.
 *
 * GitHub Pages serves CSS and JS with a ten-minute cache, so a returning
 * visitor keeps the old stylesheet for a while after a deploy — which is how a
 * fixed layout can still look broken to the one person who looked yesterday.
 * A hash in the query string makes each deploy a new URL, so there is nothing
 * stale to serve.
 *
 *   node tools/stamp-assets.mjs
 *
 * Idempotent: re-running with unchanged files leaves index.html alone.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shortHash = async (file) =>
  createHash('sha256').update(await readFile(join(root, file))).digest('hex').slice(0, 10);

const cssHash = await shortHash('style.css');
const jsHash = await shortHash('app.js');

const path = join(root, 'index.html');
const before = await readFile(path, 'utf8');

const after = before
  .replace(/href="style\.css(?:\?v=[0-9a-f]+)?"/, `href="style.css?v=${cssHash}"`)
  .replace(/src="app\.js(?:\?v=[0-9a-f]+)?"/, `src="app.js?v=${jsHash}"`);

if (!after.includes(`style.css?v=${cssHash}`) || !after.includes(`app.js?v=${jsHash}`)) {
  throw new Error('could not find the asset links in index.html');
}

if (after === before) {
  console.log(`unchanged (css ${cssHash}, js ${jsHash})`);
} else {
  await writeFile(path, after, 'utf8');
  console.log(`stamped css ${cssHash}, js ${jsHash}`);
}

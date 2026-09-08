/**
 * Stamp content hashes onto every asset URL the page loads.
 *
 * GitHub Pages serves CSS and JS with a ten-minute cache, so a returning
 * visitor keeps the old files for a while after a deploy — which is how a fixed
 * layout can still look broken to the one person who looked yesterday. A hash
 * in the query string makes each deploy a new URL, so there is nothing stale to
 * serve.
 *
 * The module graph needs the same treatment as the two files in `index.html`,
 * and for a worse reason than staleness: `app.js` is stamped and the modules it
 * imports were not, so a visitor from ten minutes before a deploy could run a
 * *new* app against *old* modules. That is not a cosmetic problem, it is a
 * mismatched program — and it is invisible, because everything loads. So every
 * relative import gets a token too, one hash over the whole tree, since a
 * per-file hash would need the graph rewritten bottom-up on every build for no
 * gain: the whole tree ships together anyway.
 *
 *   node tools/stamp-assets.mjs
 *
 * Idempotent: re-running with unchanged files leaves everything alone.
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(join(root, file));
const shortHash = async (file) => createHash('sha256').update(await read(file)).digest('hex').slice(0, 10);

const cssHash = await shortHash('style.css');

// --- one token for the whole module graph ----------------------------------
// Hashed over the *unstamped* text, so the token does not depend on itself.
const strip = (text) => text.replace(/(from '\.\/[^']+\.js)\?v=[0-9a-f]+'/g, "$1'");
const moduleFiles = ['app.js', ...(await readdir(join(root, 'src/faces')))
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => `src/faces/${f}`)];

const tree = createHash('sha256');
for (const file of moduleFiles) tree.update(strip(await readFile(join(root, file), 'utf8')));
const jsHash = tree.digest('hex').slice(0, 10);

// --- rewrite the imports ---------------------------------------------------
let touched = 0;
for (const file of moduleFiles) {
  const path = join(root, file);
  const before = await readFile(path, 'utf8');
  const after = strip(before).replace(/(from '\.\/[^']+\.js)'/g, `$1?v=${jsHash}'`);
  if (after !== before) {
    await writeFile(path, after, 'utf8');
    touched++;
  }
}

// --- rewrite index.html ----------------------------------------------------
const indexPath = join(root, 'index.html');
const before = await readFile(indexPath, 'utf8');
const after = before
  .replace(/href="style\.css(?:\?v=[0-9a-f]+)?"/, `href="style.css?v=${cssHash}"`)
  .replace(/src="app\.js(?:\?v=[0-9a-f]+)?"/, `src="app.js?v=${jsHash}"`);

if (!after.includes(`style.css?v=${cssHash}`) || !after.includes(`app.js?v=${jsHash}`)) {
  throw new Error('could not find the asset links in index.html');
}

if (after === before && touched === 0) {
  console.log(`unchanged (css ${cssHash}, js ${jsHash})`);
} else {
  if (after !== before) await writeFile(indexPath, after, 'utf8');
  console.log(`stamped css ${cssHash}, js ${jsHash} (${touched} module file${touched === 1 ? '' : 's'})`);
}

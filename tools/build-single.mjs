/**
 * Bundle the studio into one self-contained HTML file.
 *
 * The site is deliberately dependency-free ES modules, which is lovely to work
 * on but needs a web server: `file://` blocks module loading, and some hosts
 * (an Artifact, a pasted-in page, an email attachment) only take a single file.
 * esbuild flattens the module graph — it also renames the several private
 * `clamp` helpers that would otherwise collide once concatenated.
 *
 *   node tools/build-single.mjs
 *
 * Outputs:
 *   dist/doodle-faces.html  a complete page; opens straight off the disk
 *   dist/artifact.html      body content only, for hosts that supply the shell
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(join(root, p), 'utf8');

// `shell: true` because Node refuses to spawn a bare `.cmd` on Windows.
// esbuild is a dev-only tool: the site it produces still has no dependencies.
const bundle = execFileSync(
  'npx',
  ['--yes', 'esbuild', 'app.js', '--bundle', '--format=iife', '--minify-syntax', '--target=es2022'],
  { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: true },
);

const html = await read('index.html');
const css = await read('style.css');

// The page has two external references; swap both for their content. The
// patterns tolerate the `?v=hash` that stamp-assets.mjs adds for cache busting.
const inlined = html
  .replace(/<link rel="stylesheet" href="style\.css[^"]*">/, `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="app\.js[^"]*"><\/script>/, `<script>\n${bundle}\n</script>`);

if (inlined === html) throw new Error('nothing was inlined — did index.html change?');

await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/doodle-single.html'), inlined, 'utf8');

// Artifact-style hosts wrap the file in their own doctype/head/body, so strip
// the shell and keep the title, the styles and the markup.
const bodyOnly = inlined
  .replace(/^[\s\S]*?<head>/i, '')
  .replace(/<\/head>\s*<body>/i, '')
  .replace(/<\/body>\s*<\/html>\s*$/i, '')
  .replace(/<meta[^>]*>\s*/gi, '')
  .replace(/<link rel="icon"[^>]*>\s*/i, '')
  .trim();

await writeFile(join(root, 'dist/artifact.html'), bodyOnly, 'utf8');

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} kB`;
console.log(`dist/doodle-single.html  ${kb(inlined)}`);
console.log(`dist/artifact.html       ${kb(bodyOnly)}`);

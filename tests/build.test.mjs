import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const outputRoot = resolve(projectRoot, 'dist');
const run = promisify(execFile);

async function outputFiles(directory = outputRoot, prefix = '') {
  const files = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      for (const [path, data] of await outputFiles(resolve(directory, entry.name), relative + '/')) files.set(path, data);
    } else files.set(relative, await readFile(resolve(directory, entry.name)));
  }
  return files;
}

test('clean builds are reproducible and every generated local link and asset resolves', async () => {
  const build = () => run(process.execPath, ['generate-pages.mjs'], { cwd: projectRoot });
  const fingerprint = files => [...files].map(([path, data]) => [path, createHash('sha256').update(data).digest('hex')]).sort();
  await build();
  const first = await outputFiles();
  await writeFile(resolve(outputRoot, 'stale-build-artifact.txt'), 'This must disappear on the next build.');
  // Run from a different working directory as well as rebuilding from source.
  await run(process.execPath, [resolve(projectRoot, 'generate-pages.mjs')], { cwd: outputRoot });
  const second = await outputFiles();
  assert.deepEqual(fingerprint(second), fingerprint(first));

  const paths = [...second.keys()];
  assert.equal(paths.filter(path => /^site\.[a-f0-9]{12}\.css$/.test(path)).length, 1);
  assert.equal(paths.filter(path => /^app\.[a-f0-9]{12}\.js$/.test(path)).length, 1);
  assert.equal(paths.filter(path => path.endsWith('.html')).length, 11);
  for (const obsolete of ['styles.css', 'dark.css', 'topbar.css', 'fonts.css', 'app.js', 'assets/partner-aquart.png', 'assets/partner-retus-auto.png']) {
    assert.equal(second.has(obsolete), false, obsolete);
  }
  assert.deepEqual(JSON.parse(second.get('_routes.json')), { version: 1, include: ['/api/*'], exclude: [] });

  for (const [path, buffer] of second) {
    if (!/\.(html|css)$/.test(path)) continue;
    const text = buffer.toString();
    const references = path.endsWith('.html')
      ? [...text.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1])
      : [...text.matchAll(/url\(["']?([^\s"')]+)["']?\)/g)].map(match => match[1]);
    for (const reference of references) {
      const url = new URL(reference, 'https://site.test/' + path);
      if (url.origin !== 'https://site.test') continue;
      const destination = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
      assert.ok(second.has(destination), `${path} references missing ${destination}`);
      if (url.hash && destination.endsWith('.html')) {
        const fragment = decodeURIComponent(url.hash.slice(1));
        assert.ok(second.get(destination).toString().includes(`id="${fragment}"`), `${path} references missing anchor ${reference}`);
      }
    }
    if (path.endsWith('.css')) assert.doesNotMatch(text, /@import\b/);
    if (path.endsWith('.html')) {
      assert.equal([...text.matchAll(/rel="stylesheet"/g)].length, 1, path);
      assert.doesNotMatch(text, /RESEND_API_KEY|SMTP_PASS|class="toast"/);
    }
  }
});

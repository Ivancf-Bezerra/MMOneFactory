/**
 * Copia o output do Angular (MMSITE/dist) para a raiz do repositório.
 * GitHub Pages: Settings → Pages → Deploy from branch → pasta / (root).
 *
 * Remove na raiz apenas ficheiros de builds anteriores (hashes mudam entre builds).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'MMSITE', 'dist');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('sync-github-pages-root: rode antes em MMSITE: npm run build:github-pages');
  process.exit(1);
}

/** Nomes de ficheiros gerados pelo build na raiz do repo (não apagar README, .gitignore, etc.). */
function isPreviousRootBuildArtifact(name) {
  if (name === 'index.html' || name === '404.html' || name === 'favicon.ico') return true;
  if (name === '.nojekyll' || name === '_redirects') return true;
  if (name === 'prerendered-routes.json' || name === '3rdpartylicenses.txt') return true;
  if (/^chunk-.+\.js$/.test(name)) return true;
  if (/^main-.+\.js$/.test(name)) return true;
  if (/^polyfills-.+\.js$/.test(name)) return true;
  if (/^styles-.+\.css$/.test(name)) return true;
  return false;
}

for (const name of fs.readdirSync(root)) {
  const p = path.join(root, name);
  try {
    if (!fs.statSync(p).isFile()) continue;
    if (!isPreviousRootBuildArtifact(name)) continue;
    fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

for (const name of fs.readdirSync(src)) {
  const from = path.join(src, name);
  const to = path.join(root, name);
  if (!fs.statSync(from).isFile()) continue;
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(path.join(root, '.nojekyll'))) {
  fs.writeFileSync(path.join(root, '.nojekyll'), '');
}

console.log('sync-github-pages-root: build copiado para a raiz do repositório (GitHub Pages /).');

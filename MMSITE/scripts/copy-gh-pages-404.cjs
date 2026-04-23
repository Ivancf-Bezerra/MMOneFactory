/**
 * GitHub Pages: duplicar index como 404.html (SPA em sub-rotas).
 * Pasta de saída: docs/ na raiz do repositório (Pages → /docs).
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const browser = path.join(repoRoot, 'docs');
const index = path.join(browser, 'index.html');
const dest = path.join(browser, '404.html');

if (!fs.existsSync(index)) {
  console.error('copy-gh-pages-404: index.html nao encontrado em docs/. Rode ng build antes.');
  process.exit(1);
}
fs.copyFileSync(index, dest);

// Netlify — não usado no GitHub Pages
const redirects = path.join(browser, '_redirects');
if (fs.existsSync(redirects)) {
  fs.unlinkSync(redirects);
}

// Evitar processamento Jekyll em ficheiros com _ no nome
const nojekyll = path.join(browser, '.nojekyll');
if (!fs.existsSync(nojekyll)) {
  fs.writeFileSync(nojekyll, '');
}

// Artefactos do build Angular — não necessários para GitHub Pages (servir estático)
for (const name of ['3rdpartylicenses.txt', 'prerendered-routes.json']) {
  const p = path.join(browser, name);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

console.log('copy-gh-pages-404: 404.html e .nojekyll em docs/ (raiz do repo).');

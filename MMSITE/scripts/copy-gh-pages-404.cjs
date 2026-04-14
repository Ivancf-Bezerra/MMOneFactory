/**
 * GitHub Pages nao reescreve rotas para index.html; duplicar index como 404.html
 * faz o Angular carregar em URLs diretas / refresh em sub-rotas.
 */
const fs = require('fs');
const path = require('path');

const browser = path.join(__dirname, '..', 'dist', 'docs');
const index = path.join(browser, 'index.html');
const dest = path.join(browser, '404.html');

if (!fs.existsSync(index)) {
  console.error('copy-gh-pages-404: index.html nao encontrado. Rode ng build antes.');
  process.exit(1);
}
fs.copyFileSync(index, dest);
console.log('copy-gh-pages-404: 404.html criado em dist/docs/');

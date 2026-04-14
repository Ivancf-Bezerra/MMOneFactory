/**
 * Copia MMSITE/dist para /docs na raiz do repo (GitHub Pages: Deploy from branch > pasta /docs).
 * Preserva ficheiros .md já existentes em docs/ (documentação local).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'MMSITE', 'dist');
const dest = path.join(root, 'docs');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('sync-github-pages-docs: rode antes em MMSITE: npm run build:github-pages');
  process.exit(1);
}

const mdBackup = [];
if (fs.existsSync(dest)) {
  for (const name of fs.readdirSync(dest)) {
    if (!name.endsWith('.md')) continue;
    const p = path.join(dest, name);
    try {
      if (fs.statSync(p).isFile()) {
        mdBackup.push({ name, buf: fs.readFileSync(p) });
      }
    } catch {
      /* ignore */
    }
  }
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
fs.writeFileSync(path.join(dest, '.nojekyll'), '');

for (const { name, buf } of mdBackup) {
  fs.writeFileSync(path.join(dest, name), buf);
}

console.log('sync-github-pages-docs: build copiado para docs/ (GitHub Pages). .md locais preservados.');

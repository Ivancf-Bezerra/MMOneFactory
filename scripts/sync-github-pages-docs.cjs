/**
 * Copia o output do Angular (browser/) para /docs na raiz do repo.
 * GitHub Pages com "Deploy from branch" > pasta /docs so encontra index.html ai.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'MMSITE', 'dist', 'mmsite', 'browser');
const dest = path.join(root, 'docs');

if (!fs.existsSync(src)) {
  console.error('sync-github-pages-docs: pasta origem inexistente. Rode em MMSITE: npm run build:github-pages');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
fs.writeFileSync(path.join(dest, '.nojekyll'), '');
console.log('sync-github-pages-docs: conteudo copiado para docs/ (raiz do repo).');

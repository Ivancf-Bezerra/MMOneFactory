# MMOneFactory (deploy)

O build estatico do Angular e copiado para **`docs/`** na raiz do repositório para o **GitHub Pages** encontrar o `index.html`. O artefacto em **`MMSITE/dist/`** pode continuar a ser commitado para outros deploys.

## GitHub Pages (porque nao aparecia nada)

O Pages **so** publica ficheiros na **raiz do branch** ou na pasta **`/docs`**. Ter o site apenas em `MMSITE/dist/mmsite/browser/` **nao funciona** com "Deploy from branch" — nao ha `index.html` onde o GitHub procura.

### Configuracao no GitHub

1. **Settings → Pages → Build and deployment**
2. **Source:** *Deploy from a branch*
3. **Branch:** `main` (ou a que usar)
4. **Pasta:** **`/docs`** (nao use `/ (root)` a menos que copie o build para a raiz)

### Gerar e publicar

```bash
cd MMSITE
npm ci
npm run build:github-pages:docs
cd ..
git add docs MMSITE/dist README.md
git commit -m "deploy: GitHub Pages (docs/)"
git push
```

Isto corre `build:github-pages` (base `/MMOneFactory/`, `404.html`, `.nojekyll`) e copia tudo para **`docs/`**.

Se o repositorio **nao** se chamar `MMOneFactory`, edite em `MMSITE/package.json` o `--base-href /NomeDoRepo/` no script `build:github-pages`.

### URL

`https://<user>.github.io/<repo>/` — no GitHub Pages a app usa **rotas com hash** (`#/login`, `#/transaction/...`) só neste dominio, para o servidor nao devolver 404 ao recarregar. Em `localhost` ou noutros hosts as rotas continuam **sem** hash.

O build usa **`--base-href ./`** para os ficheiros JS/CSS carregarem bem em qualquer nome de repositório.

## Outros

- **Render:** ver `render.yaml` na raiz.
- **Comportamento:** `/` redireciona para `/login`; sessao ativa em `/login` vai para `/transaction/create`.

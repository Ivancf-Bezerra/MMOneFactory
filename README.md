# MMOneFactory

O build de produção do Angular para **GitHub Pages** (pasta **`/docs`**) é gerado na raiz do repositório: **`docs/`** (após `npm run build:github-pages` dentro de `MMSITE`).

## Build para hospedagem estática

```bash
cd MMSITE
npm ci
npm run build:github-pages
```

O output para deploy está em **`docs/`** na raiz (commitável no Git).

**GitHub Pages:** em *Settings → Pages*, escolhe a branch (ex. `main`) e pasta **`/docs`**.

**Render / Netlify / outros:** aponta o publish para **`./docs`** (ver `render.yaml`).

Se o repositório **não** se chamar `MMOneFactory`, ajuste em `MMSITE/package.json` o `--base-href /NomeDoRepo/` no script `build:github-pages` para o site em `usuario.github.io/NomeDoRepo/`.

### Rotas em hospedagem estática (ex.: `github.io`)

Em subpastas de domínio estático a app pode usar **rotas com hash** (`#/login`, `#/transaction/...`) para o servidor não devolver 404 ao recarregar. Em `localhost` ou outros hosts as rotas podem continuar **sem** hash.

O build `build:github-pages` usa **`--base-href ./`** para os ficheiros JS/CSS carregarem bem em qualquer caminho base.

## Outros

- **Render:** `render.yaml` usa `staticPublishPath: ./docs`.
- **Comportamento:** `/` redireciona para `/login`; sessão ativa em `/login` vai para `/transaction/create`.

Ficheiros de build na **raiz** do repo (fora de `docs/`) **não** devem ser commitados; estão bloqueados no `.gitignore`.

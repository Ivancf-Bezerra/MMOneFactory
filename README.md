# MMOneFactory

Este repositório publica o site estático em **`docs/`** (GitHub Pages: pasta **`/docs`**, branch `main`).

O **código-fonte Angular** (`MMSITE/`) **não** está versionado aqui; mantém-se apenas localmente ou noutro repositório.

## Gerar `docs/` a partir do projeto Angular local

Na pasta do projeto Angular (ex. `MMSITE` no teu disco):

```bash
cd MMSITE
npm ci
npm run build:github-pages
```

O comando de build deve escrever o output na pasta **`docs/` na raiz deste repositório** (configuração em `angular.json`: `outputPath` com `../docs`). Depois faz commit e push de `docs/` neste repo.

**Render / Netlify:** `render.yaml` usa `staticPublishPath: ./docs`.

Se o repositório **não** se chamar `MMOneFactory`, ajusta no `package.json` do projeto Angular o `--base-href /NomeDoRepo/` no script `build:github-pages` para `usuario.github.io/NomeDoRepo/`.

### Rotas em hospedagem estática (ex.: `github.io`)

Em subpastas de domínio estático a app pode usar **rotas com hash** (`#/login`, `#/transaction/...`) para o servidor não devolver 404 ao recarregar.

## Outros

- **Comportamento da app:** `/` redireciona para `/login`; sessão ativa em `/login` vai para `/transaction/create`.

Ficheiros de build na **raiz** do repo (fora de `docs/`) **não** devem ser commitados; estão bloqueados no `.gitignore`.

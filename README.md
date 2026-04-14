# MMOneFactory

O build de produção do Angular fica em **`MMSITE/dist/`** (após `npm run build` ou `npm run build:github-pages` dentro de `MMSITE`).

Para **GitHub Pages** (origem: branch `main`, pasta **`/docs`**), gere e copie o build para a raiz de **`docs/`** na raiz do repositório:

```bash
cd MMSITE
npm ci
npm run build:github-pages:docs
```

Ficheiros **`docs/*.md`** ficam **fora do Git** (documentação local); o script de sync **preserva** esses `.md` no disco ao atualizar o site estático.

## Build para hospedagem estática

```bash
cd MMSITE
npm ci
npm run build:github-pages
```

O output para deploy genérico está em **`MMSITE/dist/`** (Render, Netlify, etc.). Para Pages, use o comando com **`:docs`** acima.

Se o repositório **não** se chamar `MMOneFactory`, ajuste em `MMSITE/package.json` o `--base-href /NomeDoRepo/` no script `build:github-pages`.

### Rotas no GitHub Pages

Em `github.io/<repo>/` a app pode usar **rotas com hash** (`#/login`, `#/transaction/...`) para o servidor não devolver 404 ao recarregar. Em `localhost` ou outros hosts as rotas podem continuar **sem** hash.

O build `build:github-pages` usa **`--base-href ./`** para os ficheiros JS/CSS carregarem bem em qualquer nome de repositório.

## Outros

- **Render:** ver `render.yaml` na raiz.
- **Comportamento:** `/` redireciona para `/login`; sessão ativa em `/login` vai para `/transaction/create`.

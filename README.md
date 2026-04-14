# MMOneFactory

O build de produção do Angular fica em **`MMSITE/dist/`** (após `npm run build` ou `npm run build:github-pages` dentro de `MMSITE`).

A pasta **`docs/`** na raiz do repositório é só para **documentação local** (não faz parte do fluxo de build e não deve receber cópia do site estático).

## Build para hospedagem estática

```bash
cd MMSITE
npm ci
npm run build:github-pages
```

O output para deploy está em **`MMSITE/dist/`** (Render, Netlify, GitHub Actions, etc.). O repositório **não** versiona a pasta `dist` nem ficheiros de build na raiz.

Se o repositório **não** se chamar `MMOneFactory`, ajuste em `MMSITE/package.json` o `--base-href /NomeDoRepo/` no script `build:github-pages`.

### Rotas em hospedagem estática (ex.: `github.io`)

Em subpastas de domínio estático a app pode usar **rotas com hash** (`#/login`, `#/transaction/...`) para o servidor não devolver 404 ao recarregar. Em `localhost` ou outros hosts as rotas podem continuar **sem** hash.

O build `build:github-pages` usa **`--base-href ./`** para os ficheiros JS/CSS carregarem bem em qualquer caminho base.

## Outros

- **Render:** ver `render.yaml` na raiz.
- **Comportamento:** `/` redireciona para `/login`; sessão ativa em `/login` vai para `/transaction/create`.

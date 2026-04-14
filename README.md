# MMOneFactory

O build de produção do Angular fica em **`MMSITE/dist/docs/`** (após `npm run build` ou `npm run build:github-pages` dentro de `MMSITE`).

A pasta **`docs/`** na raiz do repositório é só para **documentação local** (não faz parte do fluxo de build e não deve receber cópia do site estático).

## Build para hospedagem estática

```bash
cd MMSITE
npm ci
npm run build:github-pages
```

O output para deploy está em **`MMSITE/dist/docs/`**. Este repositório **pode versionar** `MMSITE/dist/docs/` no Git para o teu pipeline publicar a partir daí (ex. **Render** com `render.yaml`, **Netlify**, **GitHub Actions** que copie ou publique essa pasta).

**Nota:** no GitHub, **Pages** com *Deploy from a branch* só serve ficheiros na **raiz** (`/`) ou em **`/docs`** na raiz do repositório — **não** há opção para servir diretamente `MMSITE/dist/docs/` por esse mecanismo. Para `github.io` sem Actions, costuma-se copiar o build para a raiz ou para `docs/`, ou usar **GitHub Actions**.

Ficheiros de build na **raiz** do repo (chunks, `index.html`, etc.) **não** devem ser commitados; estão bloqueados no `.gitignore`.

Se o repositório **não** se chamar `MMOneFactory`, ajuste em `MMSITE/package.json` o `--base-href /NomeDoRepo/` no script `build:github-pages`.

### Rotas em hospedagem estática (ex.: `github.io`)

Em subpastas de domínio estático a app pode usar **rotas com hash** (`#/login`, `#/transaction/...`) para o servidor não devolver 404 ao recarregar. Em `localhost` ou outros hosts as rotas podem continuar **sem** hash.

O build `build:github-pages` usa **`--base-href ./`** para os ficheiros JS/CSS carregarem bem em qualquer caminho base.

## Outros

- **Render:** se existir `render.yaml` na raiz do projeto (e estiver no Git), define `staticPublishPath` para `./MMSITE/dist/docs`.
- **Comportamento:** `/` redireciona para `/login`; sessão ativa em `/login` vai para `/transaction/create`.

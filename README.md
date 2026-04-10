# MMOneFactory (deploy)

Este repositório versiona **apenas o build estático** do Angular em **`MMSITE/dist/**`**, adequado para **GitHub Pages**, CDN ou **Render**.

## Regenerar a `dist`

### Build normal (local / Render com build proprio)

```bash
cd MMSITE
npm ci
npm run build
```

### Build para GitHub Pages (subpasta do site)

O site em `https://<user>.github.io/MMOneFactory/` fica numa **subpasta** do dominio. E preciso de `base-href` e de `404.html`:

```bash
cd MMSITE
npm ci
npm run build:github-pages
```

Isto gera `MMSITE/dist/mmsite/browser/` com `<base href="/MMOneFactory/">` e copia `index.html` para **`404.html`** (necessario para a SPA ao atualizar a pagina numa rota como `/login`).

Se o repositório tiver **outro nome**, edite o script `build:github-pages` em `MMSITE/package.json` e troque `/MMOneFactory/` pelo nome do repo (`/MeuRepo/`).

Conteúdo publicável: **`MMSITE/dist/mmsite/browser/`** (inclui `.nojekyll` para o GitHub Pages nao processar com Jekyll).

## Render

O ficheiro **`render.yaml`** na raiz publica **`./MMSITE/dist/mmsite/browser`** (artefacto ja commitado). Inclui rewrite `/* → /index.html`. Se passar a fazer build no Render, acrescente `rootDir: MMSITE` e `buildCommand` nesse ficheiro.

## Git

O `.gitignore` ignora o código em `MMSITE/` exceto **`MMSITE/dist/**`**. Depois do build:

```bash
git add MMSITE/dist README.md
git commit -m "deploy: atualiza dist"
git push
```

Assim o **README** no GitHub e no GitHub Pages atualiza (deixe de ver a versão antiga só depois do push).

## Comportamento da app

A rota raiz `/` redireciona para **`/login`**. Utilizadores já autenticados que abram `/login` são enviados para **`/transaction/create`**.

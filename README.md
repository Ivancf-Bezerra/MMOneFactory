# MMOneFactory (deploy)

Este repositório contém **apenas o output estático** do frontend Angular (`MMSITE/dist/mmsite`), adequado para hospedagem estática (ex.: GitHub Pages).

## Regenerar a `dist`

Na máquina de desenvolvimento (com o monorepo completo):

```bash
cd MMSITE
npm ci
npm run build
```

O conteúdo publicável para o utilizador final está em **`MMSITE/dist/mmsite/browser/`** (ficheiros `index.html`, JS e CSS). Os restantes ficheiros em `MMSITE/dist/mmsite/` são metadados do build.

## Git

O código-fonte do projeto **não** deve ser commitado neste remoto — apenas a pasta de build indicada no `.gitignore`.

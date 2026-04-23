# MMOneFactory

Este repositório publica o frontend **MMSITE** (Angular) no GitHub Pages, com artefatos estáticos em `docs/`.

## SDD — Software Design Description (MMSITE)

### 1) Objetivo do sistema

O `MMSITE` implementa a experiência web da plataforma Middleman:
- autenticação e perfil;
- abertura de negociação (`/transaction/create`);
- chat e fluxo de transação com etapas protegidas;
- dashboard e histórico operacional.

### 2) Contexto e fronteiras

- **Frontend principal:** `MMSITE/` (Angular 19).
- **Build publicado:** `docs/` (saída estática para GitHub Pages).
- **Backend/API:** integração por endpoints `/api/v1/*` (mock local disponível em dev).
- **Fora de escopo deste deploy:** pasta `MMAPI/` (não subir neste fluxo).

### 3) Arquitetura

- **Framework:** Angular standalone + Router.
- **Organização por feature:** `src/app/features/*` (auth, dashboard, transaction, profile, dispute).
- **Core compartilhado:** `src/app/core/*` (serviços, interceptors, models, utilitários).
- **UI e layout:** `src/app/layout/*` e componentes reutilizáveis em `src/app/shared/*`.
- **Persistência cliente:** `localStorage` e `sessionStorage` para estado de sessão/fluxo.

### 4) Decisões de design

- SPA com foco em fluxo guiado de negociação e redução de fricção operacional.
- Modo mock para acelerar desenvolvimento local sem dependência imediata de backend real.
- Build estático em `docs/` para facilitar publicação no GitHub Pages.
- Rotas suportadas em hospedagem estática com fallback (`404.html`) e configuração de base relativa.

### 5) Dependências de uso

#### Runtime (principais)
- `@angular/*` (v19)
- `@lucide/angular` (ícones)
- `@ngrx/store`, `@ngrx/effects`, `@ngrx/store-devtools`
- `rxjs`, `zone.js`, `qrcode`

#### Desenvolvimento
- `@angular/cli`, `@angular-devkit/build-angular`, `typescript`
- `karma`, `jasmine` (testes padrão Angular)
- `tailwindcss`, `postcss`, `autoprefixer`

#### Requisitos de ambiente
- Node.js 20+ (recomendado)
- npm 10+ (recomendado)

### 6) Contratos e endpoints

Base da API: `/api/v1`

#### Auth (MMSITE -> MMAPI)
- `POST /auth/register`
  - Request: `{ name, email, password }`
  - Response: `{ accessToken, user: { name, email } }`
- `POST /auth/login`
  - Request: `{ email, password }`
  - Response: `{ accessToken, user: { name, email } }`
- `POST /auth/google`
  - Request: `{ idToken? }`
  - Response: `{ accessToken, user: { name, email } }`
- `GET /auth/me` (**contrato previsto no frontend; ainda nao implementado no MMAPI**)

#### Transactions (MMAPI implementado)
- `GET /transactions?status=<pending|paid|completed|dispute>`
  - Lista transacoes para dashboard.
- `POST /transactions`
  - Request: `{ title, amount, currency, side }`
  - Response: `{ transactionId, inviteToken, participantId, role, snapshot }`
- `POST /transactions/join`
  - Request: `{ inviteToken }`
  - Response: `{ transactionId, participantId, role, snapshot }`
- `GET /transactions/{id}`
- `POST /transactions/{id}/confirm-ticket`
- `POST /transactions/{id}/simulate-payment`
- `POST /transactions/{id}/simulate-delivery`
- `POST /transactions/{id}/confirm-release`

> Para `GET /transactions/{id}` e todos os `POST /transactions/{id}/*`, o backend exige header:
> `X-Participant-Id: <guid>`

#### Negotiations / Users (contratos do frontend, pendentes no MMAPI)
- `GET /negotiations/inbox?q=...`
  - Response esperado: `NegotiationThread[]`
- `GET /negotiations/dashboard-search?q=...`
  - Response esperado: `{ threads: NegotiationThread[], directoryUsers: PublicUserProfile[] }`
- `GET /users/{userId}/public-profile`
  - Response esperado: `PublicUserProfile`
- `GET /users/directory-verified?q=...`
  - Response esperado: `PublicUserProfile[]` (somente utilizadores verificados)

## Build e publicação (somente MMSITE + docs)

### Build de produção para GitHub Pages

```bash
cd MMSITE
npm ci
npm run build:github-pages
```

Esse comando gera o build otimizado e grava em `../docs` (raiz do repositório), incluindo `404.html` e `.nojekyll`.

### Subir para o GitHub

```bash
git add MMSITE docs README.md
git commit -m "docs: atualiza SDD e build do MMSITE"
git push origin main
```

> Neste fluxo, suba apenas alterações relacionadas ao `MMSITE` e à pasta `docs/`.

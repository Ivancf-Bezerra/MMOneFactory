# SDD — Frontend WebApp Angular (Plataforma Middleman)

## 1. Visão Geral
Este documento descreve a arquitetura e implementação do frontend web utilizando Angular para uma plataforma de intermediação (middleman/escrow).

---

## 2. Stack Tecnológica

- Angular 17+
- TypeScript
- Angular Material
- RxJS
- NgRx (opcional)
- SCSS

---

## 3. Arquitetura

Arquitetura modular escalável:

```
src/app/
  core/
    services/
    interceptors/
    guards/
  shared/
    components/
    pipes/
    directives/
  features/
    auth/
    dashboard/
    transaction/
    dispute/
  layout/
```

---

## 4. Core Module

Responsável por:
- AuthService
- ApiService
- HTTP Interceptors
- Route Guards

---

## 5. Shared Module

Componentes reutilizáveis:
- ButtonComponent
- InputComponent
- ModalComponent
- StatusBadgeComponent
- LoaderComponent

---

## 6. Feature Modules

### Auth
- login.component
- register.component

### Dashboard
- transaction-list.component

### Transaction
- create-transaction.component
- transaction-detail.component

### Dispute
- dispute-form.component
- dispute-detail.component

---

## 7. Rotas

```
/login
/register
/dashboard
/transaction/create
/transaction/:id
/dispute/:id
```

Com Lazy Loading:

```ts
{
  path: 'transaction',
  loadChildren: () => import('./features/transaction/transaction.module')
    .then(m => m.TransactionModule)
}
```

---

## 8. Serviços

### ApiService
Centraliza chamadas HTTP:

```ts
get(url: string) {
  return this.http.get(url);
}
```

### TransactionService

```ts
getTransactions() {
  return this.api.get('/transactions');
}
```

---

## 9. Gerenciamento de Estado

### Simples
- BehaviorSubject

### Avançado (NgRx)
- Store
- Actions
- Reducers
- Effects

---

## 10. Fluxos de Interface

### Fluxo de Compra
1. Usuário cria transação
2. Realiza pagamento
3. Aguarda entrega
4. Confirma recebimento

### Fluxo de Disputa
1. Usuário abre disputa
2. Envia evidências
3. Aguarda decisão

---

## 11. UI/UX

- Design limpo estilo marketplace
- Feedback visual por status:
  - pending (cinza)
  - paid (azul)
  - completed (verde)
  - dispute (vermelho)

- Snackbar para feedback
- Skeleton loaders

---

## 12. Segurança

- JWT armazenado via interceptor
- AuthGuard para rotas protegidas
- Sanitização de inputs

---

## 13. Responsividade

- Mobile-first
- Grid + Flexbox

---

## 14. Performance

- Lazy loading
- ChangeDetectionStrategy.OnPush
- TrackBy em listas

---

## 15. Build e Deploy

Build:

```
ng build --configuration production
```

Deploy:
- Firebase Hosting
- AWS S3 + CloudFront

---

## 16. Estrutura de Código

Boas práticas:
- Separação de responsabilidades
- Componentes pequenos
- Serviços isolados
- Tipagem forte (interfaces)

---

## 17. Conclusão

Este frontend Angular foi projetado para ser:
- Escalável
- Seguro
- Performático
- Fácil de manter

Foco principal:
- Experiência clara do usuário
- Transparência no fluxo de transações

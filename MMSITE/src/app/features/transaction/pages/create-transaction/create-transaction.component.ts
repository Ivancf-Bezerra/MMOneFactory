import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, inject, isDevMode } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideChevronDown, LucideSearch, LucideShoppingCart, LucideTag, LucideUserCheck } from '@lucide/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthService, VerifiedProfileData } from '../../../../core/services/auth.service';
import { NegotiationInboxService } from '../../../../core/services/negotiation-inbox.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { InviteCodeService } from '../../../../core/services/invite-code.service';
import { PublicUserProfile } from '../../../../core/models/negotiation-thread.model';
import { PLATFORM_DISPUTE_WINDOW_HOURS, TransactionSide } from '../../../../core/models/transaction.model';
import { controlErrorMessage } from '../../../../core/utils/form-messages';
import { normalizeFreeText } from '../../../../core/utils/sanitize';
import { minAmount } from '../../../../core/validators/mm-validators';
import { randomHex } from '../../../../core/utils/random-token';
import { debounceTime, distinctUntilChanged, startWith, switchMap, take } from 'rxjs';

/** Preenchimento automático do formulário em `ng serve` / builds não otimizadas para produção. */
const MOCK_TICKET_FORM = {
  title: 'Licença de software anual — exemplo',
  amount: 199.9,
  currency: 'BRL' as const,
};

const MOCK_VERIFIED_PROFILE: VerifiedProfileData = {
  fullName: 'Usuário Teste Verificado',
  cpf: '12345678901',
  phone: '11999998888',
  birthDate: '1995-05-15',
  documentId: 'RG1234567',
};

@Component({
  selector: 'app-create-transaction',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    LucideShoppingCart,
    LucideTag,
    LucideChevronDown,
    LucideSearch,
    LucideUserCheck,
  ],
  template: `
    <section class="mm-page-shell min-w-0 space-y-5">
      <article class="glass-panel p-5 text-center sm:p-6">
        <h1 class="mm-page-h1">Nova transação com pagamento protegido</h1>
        <p class="mx-auto mt-2 max-w-md mm-page-lead">
          Três passos, no seu ritmo: entre por convite, busque a outra pessoa no diretório ou inicie a negociação sem convite.
        </p>

        <div class="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-slate-600">
          <span
            class="rounded-full border px-2.5 py-1 transition"
            [class.border-violet-300]="currentHelpStep === 1 && formStarted"
            [class.bg-mm-surface]="currentHelpStep === 1 && formStarted"
            [class.border-slate-200]="!(currentHelpStep === 1 && formStarted)"
            [class.bg-slate-50]="!(currentHelpStep === 1 && formStarted)"
            >1 — Papel</span
          >
          <span
            class="rounded-full border px-2.5 py-1 transition"
            [class.border-violet-300]="currentHelpStep === 2 && formStarted"
            [class.bg-mm-surface]="currentHelpStep === 2 && formStarted"
            [class.border-slate-200]="!(currentHelpStep === 2 && formStarted)"
            [class.bg-slate-50]="!(currentHelpStep === 2 && formStarted)"
            >2 — Dados</span
          >
          <span
            class="rounded-full border px-2.5 py-1 transition"
            [class.border-violet-300]="currentHelpStep === 3 && formStarted"
            [class.bg-mm-surface]="currentHelpStep === 3 && formStarted"
            [class.border-slate-200]="!(currentHelpStep === 3 && formStarted)"
            [class.bg-slate-50]="!(currentHelpStep === 3 && formStarted)"
            >3 — Revisão</span
          >
        </div>

        @if (!formStarted) {
          <div class="mx-auto mt-6 w-full max-w-lg space-y-3 text-left">
            <div class="rounded-mm border border-slate-200 bg-slate-50/80 p-3">
              <p class="mb-1 text-xs font-medium text-slate-600">Código de convite</p>
              <p class="mt-0.5 text-[11px] leading-relaxed text-slate-600">Quando não puder enviar o endereço completo, use o código no formato ABC-1234.</p>
              <div class="mt-2 flex items-center gap-2">
                <label class="min-w-0 flex-1">
                  <span class="sr-only">Código do convite</span>
                  <input
                    type="text"
                    maxlength="8"
                    class="input-flat w-full text-center text-sm font-semibold tracking-[0.14em] uppercase"
                    placeholder="ABC1234"
                    [formControl]="inviteCodeControl"
                    autocomplete="off"
                  />
                </label>
                <button
                  type="button"
                  class="rounded-mm border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-mm-purple-dark transition hover:bg-mm-surface disabled:cursor-not-allowed disabled:opacity-50"
                  [disabled]="!inviteCodeControl.value.trim()"
                  (click)="openByInviteCode()"
                >
                  Abrir
                </button>
              </div>
            </div>

            <div class="rounded-mm border border-slate-200 bg-white/80 p-3">
              <p class="mb-2 text-xs font-medium text-slate-600">Pesquisa de participante</p>
            <div class="glass-panel flex items-center gap-2 px-3 py-2">
              <span class="grid h-9 w-9 shrink-0 place-content-center rounded-mm bg-mm-surface text-mm-purple">
                <svg lucideSearch class="h-4 w-4 shrink-0" aria-hidden="true" />
              </span>
              <label class="min-w-0 flex-1">
                <span class="sr-only">Pesquisar por nome ou ID</span>
                <input
                  type="search"
                  class="input-flat w-full text-sm"
                  placeholder="Nome ou ID — só contas com identidade verificada"
                  [formControl]="peerSearchControl"
                  autocomplete="off"
                />
              </label>
            </div>
            <p class="mt-1.5 text-center text-[10px] leading-relaxed text-slate-500">Apenas contas com identidade verificada.</p>
            @if (verifiedDirectory$ | async; as dirUsers) {
              @if (peerSearchControl.value.trim() && dirUsers.length === 0) {
                <p class="mt-3 text-center text-xs text-slate-500">Nenhum usuário verificado com esse termo.</p>
              }
              @if (dirUsers.length > 0) {
                <ul class="mt-3 space-y-1.5" role="list">
                  @for (u of dirUsers; track u.userId) {
                    <li>
                      <button
                        type="button"
                        class="flex w-full items-center justify-between gap-2 rounded-mm border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-violet-200 hover:bg-mm-surface/50"
                        (click)="selectPeerFromDirectory(u)"
                      >
                        <span class="min-w-0 font-medium text-mm-ink">{{ u.displayName }}</span>
                        <span class="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          <svg lucideUserCheck class="h-3 w-3 shrink-0" aria-hidden="true" />
                          Verificado
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              }
            }
            </div>
          </div>
          @if (counterpartLoading) {
            <p class="mt-4 text-xs text-slate-500">Carregando dados da outra parte…</p>
          }
          @if (selectedCounterpart) {
            <div
              class="mx-auto mt-4 w-full max-w-md rounded-mm border border-violet-200/80 bg-gradient-to-b from-white to-mm-surface/40 px-4 py-3 text-left shadow-sm"
            >
              <p class="text-[10px] text-slate-500">Contraparte</p>
              <p class="mt-1 text-sm font-semibold text-mm-ink">{{ selectedCounterpart.displayName }}</p>
              <p class="mt-0.5 text-[10px] text-slate-500">{{ selectedCounterpart.userId }}</p>
              @if (selectedCounterpart.verified) {
                <p class="mt-2 text-[11px] font-medium text-emerald-700">Perfil verificado na plataforma</p>
              }
              <button
                type="button"
                class="mt-3 text-[11px] font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-mm-ink"
                (click)="clearSelectedCounterpart()"
              >
                Remover seleção
              </button>
            </div>
          }
          <div class="mt-5 flex justify-center">
            <button
              type="button"
              (click)="startTicket()"
              class="neon-button flex flex-col items-center px-6 py-2 text-sm leading-tight"
            >
              <span class="text-sm font-semibold">Continuar</span>
              <span class="text-[11px] font-medium opacity-90">Dados e revisão a seguir</span>
            </button>
          </div>
          @if (!profileVerified()) {
            <p class="mt-3 text-xs text-slate-500">Complete o perfil verificado (menu Perfil ou ao continuar) para publicar.</p>
          }
        }
      </article>

      @if (formStarted) {
        <div class="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <article class="glass-panel mx-auto w-full max-w-xl p-4 sm:p-5">
            <h2 class="mm-page-h2 text-center">Dados da negociação</h2>
            @if (devMode) {
              <div class="mx-auto mt-2 flex max-w-lg flex-wrap items-center justify-center gap-2 rounded-mm border border-amber-200 bg-amber-50/90 px-2 py-1.5 text-[11px] text-amber-950">
                <span>Ambiente local: campos com dados de exemplo.</span>
                <button type="button" (click)="applyMockTicketForm()" class="rounded border border-amber-300 bg-white px-2 py-0.5 font-medium hover:bg-amber-50">
                  Reaplicar exemplo
                </button>
              </div>
            }

            <form class="mx-auto mt-4 max-w-md space-y-3" [formGroup]="ticketForm">
              <!-- Passo 1 -->
              <div
                class="overflow-hidden rounded-mm border border-violet-100/90 bg-white shadow-sm transition-all duration-300 ease-out"
                [class.opacity-55]="!isStepUnlocked(1)"
                [class.ring-2]="openProfile && isStepUnlocked(1)"
                [class.ring-violet-200]="openProfile && isStepUnlocked(1)"
                [class.mm-step-flash]="flashStep === 1"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-3 bg-gradient-to-r from-slate-50 to-white px-3 py-3 text-left hover:from-slate-100/90 sm:px-3.5"
                  (click)="toggleSection('profile')"
                  [disabled]="!isStepUnlocked(1)"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-mm bg-gradient-to-br from-mm-purple-deep to-mm-purple text-sm font-bold leading-none text-white shadow-sm"
                    aria-hidden="true"
                    >1</span
                  >
                  <span class="min-w-0 flex-1 text-sm font-semibold leading-tight text-slate-800">Seu papel</span>
                  <svg
                    lucideChevronDown
                    class="h-4 w-4 shrink-0 self-center text-slate-400 transition-transform duration-200"
                    [class.-rotate-90]="!openProfile"
                    aria-hidden="true"
                  />
                </button>
                @if (openProfile && isStepUnlocked(1)) {
                  <div class="mm-step-reveal space-y-3 border-t border-slate-100 px-3 py-3 sm:px-4">
                    <span class="block text-center text-xs text-slate-600">Compra ou venda</span>
                    <div class="flex flex-wrap items-stretch justify-center gap-3">
                      <button
                        type="button"
                        (click)="setTransactionSide('buy')"
                        [class]="selectionCardClass(transactionSide !== null && transactionSide === 'buy')"
                      >
                        <span class="grid place-content-center text-mm-purple-dark"><svg lucideShoppingCart class="h-5 w-5 shrink-0" aria-hidden="true" /></span>
                        <p class="leading-tight">Compra</p>
                      </button>
                      <button
                        type="button"
                        (click)="setTransactionSide('sell')"
                        [class]="selectionCardClass(transactionSide !== null && transactionSide === 'sell')"
                      >
                        <span class="grid place-content-center text-mm-purple-dark"><svg lucideTag class="h-5 w-5 shrink-0" aria-hidden="true" /></span>
                        <p class="leading-tight">Venda</p>
                      </button>
                    </div>
                    <div class="flex justify-center pt-0.5">
                      <button
                        type="button"
                        class="neon-button px-5 py-2 text-xs font-semibold disabled:opacity-50"
                        [disabled]="transactionSide === null"
                        (click)="confirmStep1()"
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                }
              </div>

              <!-- Passo 2 -->
              <div
                class="overflow-hidden rounded-mm border border-violet-100/90 bg-white shadow-sm transition-all duration-300 ease-out"
                [class.opacity-55]="!isStepUnlocked(2)"
                [class.ring-2]="openNegotiation && isStepUnlocked(2)"
                [class.ring-violet-200]="openNegotiation && isStepUnlocked(2)"
                [class.mm-step-flash]="flashStep === 2"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-3 bg-gradient-to-r from-slate-50 to-white px-3 py-3 text-left hover:from-slate-100/90 sm:px-3.5"
                  (click)="toggleSection('negotiation')"
                  [disabled]="!isStepUnlocked(2)"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-mm bg-gradient-to-br from-mm-purple-deep to-mm-purple text-sm font-bold leading-none text-white shadow-sm"
                    aria-hidden="true"
                    >2</span
                  >
                  <span class="min-w-0 flex-1 text-sm font-semibold leading-tight text-slate-800">Valor e título</span>
                  <svg
                    lucideChevronDown
                    class="h-4 w-4 shrink-0 self-center text-slate-400 transition-transform duration-200"
                    [class.-rotate-90]="!openNegotiation"
                    aria-hidden="true"
                  />
                </button>
                @if (openNegotiation && isStepUnlocked(2)) {
                  <div class="mm-step-reveal space-y-3 border-t border-slate-100 px-3 py-3 sm:px-4">
                    <label class="block">
                      <span class="mb-1 block text-xs font-medium text-slate-700">Título</span>
                      <input
                        formControlName="title"
                        type="text"
                        placeholder="Ex.: iPhone 14 Pro, Licença Adobe..."
                        class="input-flat text-sm"
                        [class.input-error]="ticketForm.controls.title.touched && ticketForm.controls.title.invalid"
                      />
                      @if (ticketForm.controls.title.touched && ticketForm.controls.title.invalid) {
                        <p class="mt-1 text-xs text-red-600">{{ ticketErr('title') }}</p>
                      }
                    </label>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                      <label class="block sm:col-span-1">
                        <span class="mb-1 block text-xs font-medium text-slate-700">Valor</span>
                        <input
                          formControlName="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          class="input-flat text-sm"
                          [class.input-error]="ticketForm.controls.amount.touched && ticketForm.controls.amount.invalid"
                        />
                        @if (ticketForm.controls.amount.touched && ticketForm.controls.amount.invalid) {
                          <p class="mt-1 text-xs text-red-600">{{ ticketErr('amount') }}</p>
                        }
                      </label>
                      <label class="block sm:col-span-1">
                        <span class="mb-1 block text-xs font-medium text-slate-700">Moeda</span>
                        <select formControlName="currency" class="input-flat text-sm">
                          <option value="BRL">BRL</option>
                          <option value="USD">USD</option>
                        </select>
                      </label>
                    </div>
                    <div class="flex justify-center pt-0.5">
                      <button type="button" class="neon-button px-5 py-2 text-xs font-semibold" (click)="confirmStep2()">
                        Continuar
                      </button>
                    </div>
                  </div>
                }
              </div>

              <!-- Passo 3 -->
              <div
                class="overflow-hidden rounded-mm border border-violet-100/90 bg-white shadow-sm transition-all duration-300 ease-out"
                [class.opacity-55]="!isStepUnlocked(3)"
                [class.ring-2]="openFinalize && isStepUnlocked(3)"
                [class.ring-violet-200]="openFinalize && isStepUnlocked(3)"
                [class.mm-step-flash]="flashStep === 3"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-3 bg-gradient-to-r from-slate-50 to-white px-3 py-3 text-left hover:from-slate-100/90 sm:px-3.5"
                  (click)="toggleSection('finalize')"
                  [disabled]="!isStepUnlocked(3)"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-mm bg-gradient-to-br from-mm-purple-deep to-mm-purple text-sm font-bold leading-none text-white shadow-sm"
                    aria-hidden="true"
                    >3</span
                  >
                  <span class="min-w-0 flex-1 text-sm font-semibold leading-tight text-slate-800">Revisão</span>
                  <svg
                    lucideChevronDown
                    class="h-4 w-4 shrink-0 self-center text-slate-400 transition-transform duration-200"
                    [class.-rotate-90]="!openFinalize"
                    aria-hidden="true"
                  />
                </button>
                @if (openFinalize && isStepUnlocked(3)) {
                  <div class="mm-step-reveal space-y-3 border-t border-slate-100 px-3 py-3 sm:px-4">
                    <div class="rounded-mm border border-slate-200 bg-slate-50/90 p-3 text-xs leading-relaxed text-slate-600">
                      <p>Prazo, local e forma de entrega vocês combinam com a outra parte; aqui fica registrado o valor e o resumo comercial.</p>
                    </div>

                    <div class="rounded-mm border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
                      <p class="text-[10px] text-slate-500">Resumo</p>
                      <p class="mt-2 text-slate-700">Operação: {{ transactionSideLabel() }}</p>
                      <p class="mt-2 text-slate-500">A seguir, pagamento em custódia e entrega tratam-se na mesma sala de negociação.</p>
                      <p class="mt-2 text-slate-500">Ao publicar, envie o convite e retome o alinhamento no chat.</p>
                    </div>

                    <div class="flex justify-center pt-0.5">
                      <button type="button" (click)="saveTransaction()" class="neon-button px-6 py-2 text-xs font-semibold">Publicar</button>
                    </div>
                  </div>
                }
              </div>
            </form>
          </article>

          <aside class="lg:sticky lg:top-24" aria-label="Dica do passo atual">
            <div class="glass-panel border-violet-100/80 p-3.5 text-[12px] leading-relaxed text-slate-600 shadow-sm sm:p-4">
              <p class="section-label mb-1.5">Etapa {{ currentHelpStep }}/3</p>
              <h2 class="text-sm font-semibold text-mm-ink">{{ asideHintTitle }}</h2>
              @switch (currentHelpStep) {
                @case (1) {
                  <p class="mt-2">{{ helpStep1Profile }}</p>
                  <p class="mt-2 text-slate-500">{{ helpSide }}</p>
                }
                @case (2) {
                  <p class="mt-2">{{ helpStep2Negotiation }}</p>
                  <p class="mt-2 text-slate-500">{{ helpFieldTitle }}</p>
                  <p class="mt-1 text-slate-500">{{ helpFieldAmount }}</p>
                  <p class="mt-1 text-slate-500">{{ helpFieldCurrency }}</p>
                }
                @case (3) {
                  <p class="mt-2">{{ helpStep3 }}</p>
                  <p class="mt-2 text-slate-500">{{ helpDeliveryNote }}</p>
                  <p class="mt-2 text-slate-500">{{ helpSummary }}</p>
                }
              }
            </div>
          </aside>
        </div>
      }

      @if (showCreateTransitionModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div class="w-full max-w-sm rounded-mm-card border border-violet-200/80 bg-white p-4 shadow-2xl">
            <p class="text-xs font-medium text-slate-500">Preparando a sala</p>
            <h3 class="mt-1 text-base font-semibold text-mm-ink">Redirecionamento</h3>
            <p class="mt-1 text-xs leading-relaxed text-slate-600">Abrindo a sala de negociação. Só um instante.</p>
            <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-violet-100">
              <div
                class="h-full rounded-full bg-gradient-to-r from-mm-purple-deep via-mm-purple to-mm-accent transition-[width] duration-100 ease-linear"
                [style.width.%]="createTransitionProgressPct"
              ></div>
            </div>
            <p class="mt-1 text-right text-[11px] tabular-nums text-slate-500">{{ createTransitionSecondsLeft }}s</p>
          </div>
        </div>
      }

      @if (showProfileRequiredAlertModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div class="w-full max-w-sm rounded-mm-card border border-violet-200/80 bg-white p-4 shadow-2xl">
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600">Atenção</p>
            <h3 class="mt-1 text-base font-semibold text-mm-ink">Perfil verificado obrigatório</h3>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">
              Conclua a identidade no menu Perfil para publicar negociações com segurança.
            </p>
            <div class="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                class="rounded-mm border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                (click)="closeProfileRequiredAlertModal()"
              >
                Fechar
              </button>
              <button
                type="button"
                class="neon-button px-4 py-2 text-xs font-semibold"
                (click)="proceedToProfileVerification()"
              >
                Criar perfil
              </button>
            </div>
          </div>
        </div>
      }

      @if (showProfileVerificationModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div class="w-full max-w-md rounded-mm-card border border-violet-200/80 bg-white p-4 shadow-2xl">
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600">Perfil obrigatório</p>
            <h3 class="mt-1 text-base font-semibold text-mm-ink">Verificação de identidade</h3>
            <p class="mt-1 text-xs leading-relaxed text-slate-600">
              Só contas com perfil verificado publicam negociações. Em ambiente local, os campos podem vir pré-preenchidos para teste.
            </p>

            <form class="mt-3 space-y-3" [formGroup]="profileVerificationForm" (ngSubmit)="confirmProfileVerification()">
              <label class="block">
                <span class="mb-1 block text-xs font-medium text-slate-700">Nome completo</span>
                <input formControlName="fullName" type="text" class="input-flat text-sm" />
              </label>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-700">CPF</span>
                  <input formControlName="cpf" type="text" class="input-flat text-sm" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-700">Telefone</span>
                  <input formControlName="phone" type="text" class="input-flat text-sm" />
                </label>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-700">Data de nascimento</span>
                  <input formControlName="birthDate" type="date" class="input-flat text-sm" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs font-medium text-slate-700">Documento</span>
                  <input formControlName="documentId" type="text" class="input-flat text-sm" />
                </label>
              </div>
              <label class="flex items-start gap-2 rounded-mm border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                <input formControlName="dataConfirmation" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-mm-purple" />
                <span class="text-[11px] leading-relaxed text-slate-700">
                  Confirmo a veracidade dos dados e autorizo o vínculo deste CPF ao meu e-mail para uso da plataforma.
                </span>
              </label>
              @if (profileVerificationForm.invalid && profileVerificationForm.touched) {
                <p class="text-xs text-red-600">Preencha todos os campos e confirme a veracidade dos dados para validar o perfil.</p>
              }
              <div class="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  class="rounded-mm border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  (click)="showProfileVerificationModal = false"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="rounded-mm border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  (click)="prefillMockVerificationData()"
                >
                  Reaplicar exemplo
                </button>
                <button type="submit" class="neon-button px-4 py-2 text-xs font-semibold">
                  Validar perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </section>
  `,
})
export class CreateTransactionComponent implements OnDestroy, OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly negotiationInbox = inject(NegotiationInboxService);
  private readonly notificationService = inject(NotificationService);
  private readonly inviteCodeService = inject(InviteCodeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly peerSearchControl = new FormControl('', { nonNullable: true });
  readonly inviteCodeControl = new FormControl('', { nonNullable: true });

  readonly verifiedDirectory$ = this.peerSearchControl.valueChanges.pipe(
    startWith(this.peerSearchControl.value),
    debounceTime(250),
    distinctUntilChanged(),
    switchMap((q) => this.negotiationInbox.searchVerifiedDirectoryUsersForInvite(q)),
    takeUntilDestroyed(this.destroyRef),
  );

  /** `true` em build de desenvolvimento; em produção os campos começam vazios. */
  readonly devMode = isDevMode();

  /** Textos do aside (dica por passo ativo). */
  readonly helpStep1Profile = 'Diga se você compra ou vende; o convite abre o papel oposto para a outra pessoa.';
  readonly helpStep2Negotiation = 'Título, valor e moeda formam o resumo que as duas partes vão ver na mesma sala.';
  readonly helpStep3 = 'Revise e publique; o fluxo continua na sala de negociação.';
  readonly helpFieldTitle = 'Nome curto e claro para o objeto da negociação.';
  readonly helpFieldAmount = 'Valor total acordado ou a acordar nesta etapa.';
  readonly helpFieldCurrency = 'Moeda usada no resumo do valor.';
  readonly helpSide = 'O papel define quais botões e mensagens aparecem na sessão.';
  readonly helpDeliveryNote = 'Prazo e forma de entrega ficam no alinhamento pelo chat; o painel acompanha o estado.';
  readonly helpSummary = 'Após publicar, envie o convite e continue com a outra parte no mesmo fluxo.';

  /** Passo em foco: acordeão aberto; se todos fechados, o último liberado. */
  get currentHelpStep(): 1 | 2 | 3 {
    if (this.openProfile) return 1;
    if (this.openNegotiation) return 2;
    if (this.openFinalize) return 3;
    const u = this.unlockedStep;
    if (u <= 1) return 1;
    if (u === 2) return 2;
    return 3;
  }

  get asideHintTitle(): string {
    switch (this.currentHelpStep) {
      case 1:
        return 'Seu papel';
      case 2:
        return 'Dados do resumo';
      case 3:
        return 'Antes de publicar';
      default:
        return 'Orientação';
    }
  }

  formStarted = false;
  /** 1–3: perfil, negociacao, condicoes + resumo + acoes */
  unlockedStep = 1;
  openProfile = true;
  openNegotiation = false;
  openFinalize = false;

  /** Destaque suave no cartao do passo que acaba de ser liberado (some sozinho). */
  flashStep = 0;
  showCreateTransitionModal = false;
  showProfileRequiredAlertModal = false;
  showProfileVerificationModal = false;
  createTransitionProgressPct = 0;
  createTransitionSecondsLeft = 5;
  private createTransitionIntervalId: number | null = null;
  private createTransitionTimeoutId: number | null = null;

  readonly ticketForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    amount: [null as number | null, [Validators.required, minAmount(0.01), Validators.max(999999999.99)]],
    currency: ['BRL', [Validators.required, Validators.pattern(/^(BRL|USD)$/)]],
  });

  readonly profileVerificationForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    cpf: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]],
    birthDate: ['', [Validators.required]],
    documentId: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(40)]],
    dataConfirmation: [false, [Validators.requiredTrue]],
  });

  transactionSide: TransactionSide | null = null;

  /** Usuário escolhido na pesquisa (Transações) — convidado desta negociação. */
  selectedCounterpart: PublicUserProfile | null = null;
  counterpartLoading = false;
  /** Mantém o id vindo da URL até o perfil público carregar (ex.: validação de perfil em paralelo). */
  private pendingInviteUserId: string | null = null;

  ngOnDestroy(): void {
    this.clearCreateTransitionTimers();
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('editProfile') === '1') {
      this.openProfileVerificationModal();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { editProfile: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    const perfilUsuario = this.route.snapshot.queryParamMap.get('perfilUsuario')?.trim();
    if (perfilUsuario) {
      this.pendingInviteUserId = perfilUsuario;
      this.loadCounterpartFromUserId(perfilUsuario);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { perfilUsuario: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private loadCounterpartFromUserId(userId: string): void {
    this.counterpartLoading = true;
    this.negotiationInbox
      .getPublicProfile(userId)
      .pipe(take(1))
      .subscribe((p) => {
        this.selectedCounterpart = p;
        this.counterpartLoading = false;
        if (p) {
          this.pendingInviteUserId = null;
          if (this.profileVerified()) {
            this.toastService.show(
              'Participante selecionado',
              `${p.displayName} entra como referência nesta negociação. Você pode começar agora.`,
              'info',
            );
          }
        }
      });
  }

  clearSelectedCounterpart(): void {
    this.selectedCounterpart = null;
    this.pendingInviteUserId = null;
  }

  selectPeerFromDirectory(user: PublicUserProfile): void {
    this.selectedCounterpart = user;
    this.pendingInviteUserId = null;
    this.toastService.show(
      'Participante selecionado',
      `${user.displayName} entra como referência nesta negociação.`,
      'info',
    );
  }

  openByInviteCode(): void {
    const normalized = this.inviteCodeService.normalizeCode(this.inviteCodeControl.value);
    if (!normalized) return;
    const href = this.inviteCodeService.resolveInviteUrlByCode(normalized);
    if (!href) {
      this.toastService.show('Código inválido', 'Não encontramos uma negociação para este código.', 'warning');
      return;
    }
    this.toastService.show('Convite localizado', `Abrindo negociação (${this.inviteCodeService.formatCode(normalized)}).`, 'success');
    void this.router.navigateByUrl(href);
  }

  ticketErr(field: 'title' | 'amount'): string {
    return controlErrorMessage(this.ticketForm.get(field), { min: 0.01, max: 999999999.99 });
  }

  startTicket(): void {
    if (!this.profileVerified()) {
      this.openProfileRequiredAlertModal();
      return;
    }
    this.formStarted = true;
    this.unlockedStep = 1;
    this.openProfile = true;
    this.openNegotiation = false;
    this.openFinalize = false;
    this.flashStep = 0;
    this.ticketForm.reset({
      title: '',
      amount: null,
      currency: 'BRL',
    });
    if (this.devMode) {
      this.ticketForm.patchValue(MOCK_TICKET_FORM);
    }
    this.transactionSide = null;
    this.toastService.show(
      'Tudo pronto para começar',
      this.devMode
        ? 'Preparamos um exemplo para você acelerar a configuração.'
        : 'Preencha os dados para publicar sua negociação.',
      'info',
    );
  }

  profileVerified(): boolean {
    return this.authService.isProfileVerified();
  }

  openProfileRequiredAlertModal(): void {
    this.showProfileRequiredAlertModal = true;
  }

  closeProfileRequiredAlertModal(): void {
    this.showProfileRequiredAlertModal = false;
  }

  proceedToProfileVerification(): void {
    this.showProfileRequiredAlertModal = false;
    this.openProfileVerificationModal();
  }

  openProfileVerificationModal(): void {
    this.showProfileVerificationModal = true;
    const existing = this.authService.getVerifiedProfile();
    this.profileVerificationForm.patchValue(existing ?? MOCK_VERIFIED_PROFILE);
    this.toastService.show(
      'Perfil verificado obrigatório',
      'Conclua o cadastro (exemplos em ambiente local) para publicar.',
      'warning',
    );
  }

  prefillMockVerificationData(): void {
    this.profileVerificationForm.patchValue({ ...MOCK_VERIFIED_PROFILE, dataConfirmation: false });
  }

  confirmProfileVerification(): void {
    this.profileVerificationForm.markAllAsTouched();
    if (this.profileVerificationForm.invalid) {
      this.toastService.show('Cadastro incompleto', 'Preencha todos os dados do perfil para continuar.', 'warning');
      return;
    }
    const raw = this.profileVerificationForm.getRawValue();
    const payload: VerifiedProfileData = {
      fullName: normalizeFreeText(raw.fullName ?? ''),
      cpf: (raw.cpf ?? '').replace(/\D/g, ''),
      phone: (raw.phone ?? '').replace(/\D/g, ''),
      birthDate: raw.birthDate ?? '',
      documentId: normalizeFreeText(raw.documentId ?? ''),
    };
    const result = this.authService.setVerifiedProfile(payload);
    if (!result.ok) {
      this.toastService.show('Não foi possível validar', result.message, 'warning');
      return;
    }
    this.showProfileVerificationModal = false;
    this.toastService.show('Perfil validado', 'Já pode publicar negociações.', 'success');
    if (!this.selectedCounterpart && this.pendingInviteUserId) {
      this.counterpartLoading = true;
      this.negotiationInbox
        .getPublicProfile(this.pendingInviteUserId)
        .pipe(take(1))
        .subscribe((p) => {
          this.selectedCounterpart = p;
          this.pendingInviteUserId = null;
          this.counterpartLoading = false;
          if (!p) {
            this.toastService.show('Perfil', 'Não foi possível carregar o convidado.', 'warning');
          }
          this.startTicket();
        });
      return;
    }
    this.pendingInviteUserId = null;
    this.startTicket();
  }

  applyMockTicketForm(): void {
    if (!this.devMode) return;
    this.ticketForm.patchValue(MOCK_TICKET_FORM);
    this.toastService.show('Exemplo aplicado', 'Sugestões atualizadas para agilizar sua publicação.', 'info');
  }

  /** Confirma o passo 1 (papel) e libera o passo 2. */
  confirmStep1(): void {
    if (this.transactionSide === null) {
      this.toastService.show('Falta um detalhe', 'Escolha seu perfil para continuar.', 'warning');
      return;
    }
    this.unlockedStep = Math.max(this.unlockedStep, 2);
    this.openProfile = false;
    this.openNegotiation = true;
    this.pulseFlash(2);
    this.toastService.show('Tudo certo', 'Agora preencha os detalhes da proposta.', 'info');
  }

  /** Confirma o passo 2 (dados) e libera o passo 3. */
  confirmStep2(): void {
    this.ticketForm.patchValue(
      { title: normalizeFreeText(this.ticketForm.controls.title.value ?? '') },
      { emitEvent: false },
    );
    this.ticketForm.markAllAsTouched();
    if (this.ticketForm.invalid) {
      this.toastService.show('Quase lá', 'Ajuste os dados principais para avançar.', 'warning');
      return;
    }
    this.unlockedStep = Math.max(this.unlockedStep, 3);
    this.openNegotiation = false;
    this.openFinalize = true;
    this.pulseFlash(3);
    this.toastService.show('Perfeito', 'Revise e publique sua negociação no próximo passo.', 'info');
  }

  private pulseFlash(step: number): void {
    this.flashStep = step;
    window.setTimeout(() => {
      this.flashStep = 0;
    }, 700);
  }

  private validateSelections(): boolean {
    if (this.transactionSide === null) {
      this.toastService.show('Falta definir seu perfil', 'Escolha se você vai comprar ou vender.', 'warning');
      this.openProfile = true;
      return false;
    }
    if (this.unlockedStep < 3) {
      this.toastService.show(
        'Etapa pendente',
        'Complete as informações da proposta para publicar.',
        'warning',
      );
      this.openNegotiation = true;
      return false;
    }
    return true;
  }

  private validateTicketForm(): boolean {
    this.ticketForm.patchValue(
      {
        title: normalizeFreeText(this.ticketForm.controls.title.value ?? ''),
      },
      { emitEvent: false },
    );
    this.ticketForm.markAllAsTouched();
    if (this.ticketForm.invalid) {
      this.toastService.show(
        'Ajustes necessários',
        'Revise os campos destacados para continuar.',
        'warning',
      );
      this.openInvalidSections();
      return false;
    }
    return true;
  }

  private openInvalidSections(): void {
    const { title, amount } = this.ticketForm.controls;
    if (title.invalid || amount.invalid) {
      this.openNegotiation = true;
    }
    this.openFinalize = this.unlockedStep >= 3;
  }

  private sanitizeTicketPayload(): { title: string; currency: string; amount: number } {
    const raw = this.ticketForm.getRawValue();
    return {
      title: normalizeFreeText(raw.title ?? ''),
      currency: raw.currency ?? 'BRL',
      amount: Number(raw.amount),
    };
  }

  isStepUnlocked(step: number): boolean {
    return this.unlockedStep >= step;
  }

  toggleSection(id: 'negotiation' | 'profile' | 'finalize'): void {
    const step: Record<typeof id, number> = {
      profile: 1,
      negotiation: 2,
      finalize: 3,
    };
    if (!this.isStepUnlocked(step[id])) return;
    switch (id) {
      case 'negotiation':
        this.openNegotiation = !this.openNegotiation;
        break;
      case 'profile':
        this.openProfile = !this.openProfile;
        break;
      case 'finalize':
        this.openFinalize = !this.openFinalize;
        break;
    }
  }

  setTransactionSide(side: TransactionSide): void {
    const prev = this.transactionSide;
    if (prev !== null && prev !== side && this.unlockedStep >= 2) {
      this.unlockedStep = 1;
      this.openFinalize = false;
      this.openNegotiation = false;
      this.openProfile = true;
      this.toastService.show('Perfil atualizado', 'Confirme novamente para seguir com consistência.', 'info');
    }
    this.transactionSide = side;
  }

  selectionCardClass(active: boolean): string {
    const base =
      'flex size-[4.875rem] flex-none flex-col items-center justify-center gap-1 rounded-mm border p-2 text-center text-[11px] font-semibold leading-tight transition sm:size-[5.25rem] sm:text-xs';
    return active
      ? `${base} border-mm-purple-dark bg-mm-surface shadow-sm ring-1 ring-violet-200/60`
      : `${base} border-slate-200 bg-white hover:border-violet-300`;
  }

  transactionSideLabel(): string {
    if (this.transactionSide === null) return 'A definir';
    return this.transactionSide === 'buy' ? 'Compra (pagamento protegido)' : 'Venda (pagamento protegido)';
  }

  saveTransaction(): void {
    if (!this.validateTicketForm()) return;
    if (!this.validateSelections()) return;
    const ticket = this.sanitizeTicketPayload();
    const transactionId = `TRX-${randomHex(8)}`;
    const gate = randomHex(16);
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(`mm-tx-gate:${transactionId}`, gate);
        sessionStorage.setItem(`mm-tx-host:${transactionId}`, '1');
        sessionStorage.setItem(`mm-tx-order:${transactionId}`, JSON.stringify(ticket));
        if (this.selectedCounterpart) {
          sessionStorage.setItem(
            `mm-tx-counterparty:${transactionId}`,
            JSON.stringify({
              userId: this.selectedCounterpart.userId,
              displayName: this.selectedCounterpart.displayName,
            }),
          );
        }
      } catch {
        /* quota / privado */
      }
    }
    const side = this.transactionSide!;
    const queryParams = {
      side,
      gate,
      window: String(PLATFORM_DISPUTE_WINDOW_HOURS),
      openInviteQr: '1',
      itemTitle: ticket.title,
      itemAmount: ticket.amount,
      itemCurrency: ticket.currency,
      ...(this.selectedCounterpart
        ? {
            counterpartUserId: this.selectedCounterpart.userId,
            counterpartName: this.selectedCounterpart.displayName,
          }
        : {}),
    };
    const relativeUrl = this.router.serializeUrl(
      this.router.createUrlTree(['/transaction', transactionId], { queryParams }),
    );
    const inviteCode = this.inviteCodeService.registerInvite({ href: relativeUrl, transactionId });
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(`mm-tx-invite-code:${transactionId}`, inviteCode);
      } catch {
        /* quota / privado */
      }
    }
    if (this.selectedCounterpart) {
      this.notificationService.recordTransactionInvite({
        transactionId,
        title: ticket.title,
        counterpartUserId: this.selectedCounterpart.userId,
        counterpartName: this.selectedCounterpart.displayName,
        creatorDisplayName: this.authService.userDisplayName() ?? 'Usuário',
        relativeUrl,
        inviteCode: this.inviteCodeService.formatCode(inviteCode),
      });
    }
    this.toastService.show(
      'Negociação publicada',
      `Código do convite: ${this.inviteCodeService.formatCode(inviteCode)}.`,
      'success',
    );
    this.startCreateToTransactionTransition(() => {
      void this.router.navigate(['/transaction', transactionId], { queryParams });
    });
  }

  private clearCreateTransitionTimers(): void {
    if (this.createTransitionIntervalId !== null) {
      clearInterval(this.createTransitionIntervalId);
      this.createTransitionIntervalId = null;
    }
    if (this.createTransitionTimeoutId !== null) {
      clearTimeout(this.createTransitionTimeoutId);
      this.createTransitionTimeoutId = null;
    }
  }

  private startCreateToTransactionTransition(onDone: () => void): void {
    this.clearCreateTransitionTimers();
    this.showCreateTransitionModal = true;
    this.createTransitionProgressPct = 0;
    this.createTransitionSecondsLeft = 5;

    const totalMs = 5000;
    const stepMs = 100;
    const startedAt = Date.now();

    this.createTransitionIntervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      this.createTransitionProgressPct = Math.min(100, (elapsed / totalMs) * 100);
      this.createTransitionSecondsLeft = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
    }, stepMs);

    this.createTransitionTimeoutId = window.setTimeout(() => {
      this.clearCreateTransitionTimers();
      this.showCreateTransitionModal = false;
      this.createTransitionProgressPct = 100;
      this.createTransitionSecondsLeft = 0;
      onDone();
    }, totalMs);
  }
}

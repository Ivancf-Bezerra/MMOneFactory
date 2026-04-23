import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideChevronRight,
  LucideClipboardList,
  LucideFlag,
  LucideLock,
  LucideMessageCircle,
  LucideSearch,
  LucideUserCheck,
} from '@lucide/angular';
import { Store } from '@ngrx/store';
import { debounceTime, distinctUntilChanged, map, startWith, switchMap, take } from 'rxjs';
import { PublicUserProfile } from '../../../../core/models/negotiation-thread.model';
import { TransactionSide } from '../../../../core/models/transaction.model';
import { NegotiationInboxService } from '../../../../core/services/negotiation-inbox.service';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import * as TransactionActions from '../../../transaction/state/transaction.actions';
import {
  selectTransactions,
  selectTransactionsError,
  selectTransactionsLoading,
} from '../../../transaction/state/transaction.selectors';

@Component({
  selector: 'app-dashboard-home',
  imports: [
    AsyncPipe,
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    StatusBadgeComponent,
    LucideClipboardList,
    LucideLock,
    LucideFlag,
    LucideChevronRight,
    LucideSearch,
    LucideMessageCircle,
    LucideUserCheck,
  ],
  template: `
    <section class="mm-page-shell space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 class="mm-page-h1">Transações</h1>
          <p class="mt-0.5 mm-page-lead">
            Pesquise negociações existentes ou utilizadores com quem ainda não abriu ticket — pode ver o perfil público antes de combinar.
          </p>
        </div>
        <a routerLink="/transaction/create" class="neon-button px-3 py-1.5 text-xs">+ Nova transação</a>
      </header>

      <!-- KPIs (API / store) -->
      <div class="flex flex-wrap gap-2 sm:gap-3">
        <article class="glass-panel flex items-center gap-2 px-2.5 py-2 sm:min-w-0 sm:flex-1">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-mm bg-mm-surface text-mm-purple">
            <svg lucideClipboardList class="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Em andamento</p>
            @if (loading$ | async) {
              <p class="text-lg font-bold leading-tight text-slate-300">…</p>
            } @else {
              <p class="text-lg font-bold leading-tight text-mm-ink">{{ ongoingTransactions$ | async }}</p>
            }
          </div>
        </article>
        <article class="glass-panel flex items-center gap-2 px-2.5 py-2 sm:min-w-0 sm:flex-1">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-mm bg-mm-surface text-mm-purple">
            <svg lucideLock class="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Dinheiro guardado</p>
            @if (loading$ | async) {
              <p class="text-lg font-bold leading-tight text-slate-300">…</p>
            } @else {
              <p class="text-lg font-bold leading-tight text-mm-ink">{{ paidTransactions$ | async }}</p>
            }
          </div>
        </article>
        <article class="glass-panel flex items-center gap-2 px-2.5 py-2 sm:min-w-0 sm:flex-1">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-mm bg-red-50 text-red-500">
            <svg lucideFlag class="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Em disputa</p>
            @if (loading$ | async) {
              <p class="text-lg font-bold leading-tight text-slate-300">…</p>
            } @else {
              <p class="text-lg font-bold leading-tight text-mm-ink">{{ disputeTransactions$ | async }}</p>
            }
          </div>
        </article>
      </div>

      @if (error$ | async; as errorMessage) {
        <p class="rounded-mm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {{ errorMessage }}
        </p>
      }

      <!-- Lista estilo conversas (mock local / API futura) -->
      <div class="glass-panel flex items-center gap-2 px-3 py-2 sm:px-4">
        <span class="grid h-9 w-9 shrink-0 place-content-center rounded-mm bg-mm-surface text-mm-purple">
          <svg lucideSearch class="h-4 w-4 shrink-0" aria-hidden="true" />
        </span>
        <label class="min-w-0 flex-1">
          <span class="sr-only">Buscar transações</span>
          <input
            type="search"
            class="input-flat w-full text-sm"
            placeholder="Negociações: título, ID, mensagem… · Novos contactos: nome ou ID do utilizador (ex.: Elia, gabriela)"
            [formControl]="searchControl"
            autocomplete="off"
          />
        </label>
      </div>

      @if (dashboard$ | async; as dash) {
        @if (dash.threads.length > 0) {
          <div class="space-y-1.5">
            <p class="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Suas negociações · {{ dash.threads.length }}
              {{ dash.threads.length === 1 ? 'resultado' : 'resultados' }}
            </p>
            @for (thread of dash.threads; track thread.transactionId) {
              <article
                class="glass-panel flex flex-col gap-2 px-2 py-2.5 sm:flex-row sm:items-stretch sm:gap-3 sm:px-3"
              >
                <div
                  class="hidden w-1 shrink-0 self-stretch rounded-full sm:block"
                  [class]="statusBarClass(thread.status)"
                ></div>

                <div class="flex min-w-0 flex-1 gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    class="grid h-11 w-11 shrink-0 place-content-center rounded-full bg-gradient-to-br from-mm-purple-deep to-mm-purple text-xs font-bold text-white shadow-sm ring-1 ring-violet-200/70"
                    (click)="openProfileModal(thread.counterpart.userId)"
                    [attr.aria-label]="'Ver perfil de ' + thread.counterpart.displayName"
                  >
                    {{ initials(thread.counterpart.displayName) }}
                  </button>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {{ thread.transactionId }}
                      </p>
                      <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {{ roleLabel(thread.myRole) }}
                      </span>
                    </div>
                    <a
                      [routerLink]="['/transaction', thread.transactionId]"
                      class="group mt-0.5 block"
                    >
                      <h2
                        class="truncate text-sm font-semibold leading-snug text-mm-ink group-hover:text-mm-purple-dark"
                      >
                        {{ thread.title }}
                      </h2>
                    </a>
                    <p class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      <span class="font-medium text-slate-700">{{ thread.counterpart.displayName }}</span>
                      @if (thread.counterpart.verified) {
                        <span
                          class="ml-1 inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-1 py-0.5 text-[10px] font-semibold text-violet-800"
                        >
                          <svg lucideUserCheck class="h-3 w-3 shrink-0" aria-hidden="true" />
                          Verificado
                        </span>
                      }
                      — {{ thread.previewLine }}
                    </p>
                  </div>
                </div>

                <div
                  class="flex shrink-0 flex-row items-center justify-between gap-2 border-t border-slate-100 pt-2 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0"
                >
                  <div class="text-left sm:text-right">
                    <app-status-badge [status]="thread.status" />
                    <p class="mt-0.5 text-xs font-semibold text-mm-ink">
                      {{ thread.amount | currency: thread.currency : 'symbol' : '1.2-2' }}
                    </p>
                    <p class="text-[10px] text-slate-400">
                      {{ thread.lastActivityAt | date: "dd/MM/yy 'às' HH:mm" }}
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center justify-end gap-1">
                    <button
                      type="button"
                      class="rounded-mm border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                      (click)="openProfileModal(thread.counterpart.userId)"
                    >
                      Perfil
                    </button>
                    <a
                      routerLink="/transaction/create"
                      [queryParams]="{ perfilUsuario: thread.counterpart.userId }"
                      class="rounded-mm border border-violet-200 bg-mm-surface/80 px-2 py-1.5 text-[11px] font-semibold text-mm-purple-dark transition hover:bg-mm-surface"
                    >
                      Nova com esta pessoa
                    </a>
                    <a
                      [routerLink]="['/transaction', thread.transactionId]"
                      class="inline-flex items-center gap-0.5 text-slate-400 transition hover:text-mm-accent"
                    >
                      <span class="sr-only">Abrir negociação</span>
                      <svg lucideChevronRight class="h-5 w-5 shrink-0" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </article>
            }
          </div>
        }

        @if (dash.directoryUsers.length > 0) {
          <div class="space-y-2 pt-1">
            <p class="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Ainda sem negociação contigo — verifique o perfil antes de combinar ·
              {{ dash.directoryUsers.length }}
              {{ dash.directoryUsers.length === 1 ? 'pessoa' : 'pessoas' }}
            </p>
            @for (user of dash.directoryUsers; track user.userId) {
              <article
                class="glass-panel flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div class="flex min-w-0 flex-1 items-center gap-2.5">
                  <button
                    type="button"
                    class="grid h-11 w-11 shrink-0 place-content-center rounded-full bg-gradient-to-br from-slate-600 to-slate-700 text-xs font-bold text-white shadow-sm ring-1 ring-slate-300/60"
                    (click)="openProfileModal(user.userId)"
                    [attr.aria-label]="'Ver perfil de ' + user.displayName"
                  >
                    {{ initials(user.displayName) }}
                  </button>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-mm-ink">{{ user.displayName }}</p>
                    <p class="truncate text-[10px] text-slate-500">{{ user.userId }}</p>
                    @if (user.verified) {
                      <span
                        class="mt-0.5 inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800"
                      >
                        <svg lucideUserCheck class="h-3 w-3 shrink-0" aria-hidden="true" />
                        Verificado
                      </span>
                    }
                  </div>
                </div>
                <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-mm border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    (click)="openProfileModal(user.userId)"
                  >
                    Ver perfil
                  </button>
                  <a
                    routerLink="/transaction/create"
                    [queryParams]="{ perfilUsuario: user.userId }"
                    class="neon-button px-3 py-1.5 text-[11px] font-semibold"
                  >
                    Nova transação
                  </a>
                </div>
              </article>
            }
          </div>
        }

        @if (dash.threads.length === 0 && dash.directoryUsers.length === 0) {
          <div class="rounded-mm border border-dashed border-slate-300 bg-white p-6 text-center">
            <div class="mx-auto mb-2 grid h-12 w-12 place-content-center rounded-full bg-mm-surface text-mm-purple">
              <svg lucideMessageCircle class="h-6 w-6 shrink-0" aria-hidden="true" />
            </div>
            <p class="text-sm font-medium text-mm-ink">
              @if (searchControl.value.trim()) {
                Nenhum resultado para esta busca
              } @else {
                Nenhuma transação listada
              }
            </p>
            <p class="mt-1 text-xs text-slate-500">
              @if (searchControl.value.trim()) {
                Tente outro termo ou crie uma nova transação.
              } @else {
                Quando existir movimento, aparece aqui. Experimente buscar por nome para encontrar novos contactos.
              }
            </p>
            <a routerLink="/transaction/create" class="neon-button mt-3 inline-flex px-3 py-1.5 text-xs">
              Nova transação
            </a>
          </div>
        }
      }

      @if (profileModalUserId) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
          role="presentation"
          (click)="closeProfileModal()"
        >
          <div
            class="w-full max-w-md rounded-mm-card border border-violet-200/80 bg-white p-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-profile-title"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600">Perfil na plataforma</p>
                <h3 id="dash-profile-title" class="mt-1 text-base font-semibold text-mm-ink">
                  @if (profileLoading) {
                    Carregando…
                  } @else if (profileDetail) {
                    {{ profileDetail.displayName }}
                  } @else {
                    Perfil indisponível
                  }
                </h3>
              </div>
              <button
                type="button"
                class="rounded-mm px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                (click)="closeProfileModal()"
              >
                Fechar
              </button>
            </div>

            @if (!profileLoading && profileDetail) {
              <div class="mt-4 flex items-center gap-3">
                <div
                  class="grid h-14 w-14 shrink-0 place-content-center rounded-full bg-gradient-to-br from-mm-purple-deep to-mm-purple text-lg font-bold text-white shadow-sm"
                >
                  {{ initials(profileDetail.displayName) }}
                </div>
                <div class="min-w-0 text-sm text-slate-600">
                  @if (profileDetail.verified) {
                    <p class="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <svg lucideUserCheck class="h-4 w-4 shrink-0" aria-hidden="true" />
                      Identidade verificada
                    </p>
                  } @else {
                    <p class="font-medium text-slate-700">Perfil ainda não verificado</p>
                  }
                  @if (profileDetail.memberSince) {
                    <p class="mt-1 text-xs text-slate-500">
                      Membro desde {{ profileDetail.memberSince | date: 'MM/yyyy' }}
                    </p>
                  }
                  @if (profileDetail.completedDealsCount != null) {
                    <p class="mt-0.5 text-xs text-slate-500">
                      {{ profileDetail.completedDealsCount }} negociações concluídas (estimativa)
                    </p>
                  }
                </div>
              </div>
              <p class="mt-4 text-xs leading-relaxed text-slate-500">
                Dados sensíveis (CPF, documentos) não são exibidos. Em produção, este painel reflete o que a API
                autorizar para a sua conta.
              </p>
            } @else if (!profileLoading && !profileDetail) {
              <p class="mt-3 text-sm text-slate-600">Não foi possível carregar este perfil.</p>
            }

            <div class="mt-4 flex justify-end">
              <button type="button" class="neon-button px-4 py-2 text-xs font-semibold" (click)="closeProfileModal()">
                Ok
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class DashboardHomeComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly inboxService = inject(NegotiationInboxService);
  private readonly destroyRef = inject(DestroyRef);

  readonly transactions$ = this.store.select(selectTransactions);
  readonly loading$ = this.store.select(selectTransactionsLoading);
  readonly error$ = this.store.select(selectTransactionsError);

  readonly ongoingTransactions$ = this.transactions$.pipe(
    map((transactions) => transactions.filter((t) => t.status !== 'completed').length),
  );
  readonly paidTransactions$ = this.transactions$.pipe(
    map((transactions) => transactions.filter((t) => t.status === 'paid').length),
  );
  readonly disputeTransactions$ = this.transactions$.pipe(
    map((transactions) => transactions.filter((t) => t.status === 'dispute').length),
  );

  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly dashboard$ = this.searchControl.valueChanges.pipe(
    startWith(this.searchControl.value),
    debounceTime(250),
    distinctUntilChanged(),
    switchMap((q) => this.inboxService.dashboardSearch(q)),
    takeUntilDestroyed(this.destroyRef),
  );

  profileModalUserId: string | null = null;
  profileDetail: PublicUserProfile | null = null;
  profileLoading = false;

  ngOnInit(): void {
    this.store.dispatch(TransactionActions.loadTransactions({}));
  }

  openProfileModal(userId: string): void {
    this.profileModalUserId = userId;
    this.profileDetail = null;
    this.profileLoading = true;
    this.inboxService
      .getPublicProfile(userId)
      .pipe(take(1))
      .subscribe((p) => {
        this.profileDetail = p;
        this.profileLoading = false;
      });
  }

  closeProfileModal(): void {
    this.profileModalUserId = null;
    this.profileDetail = null;
    this.profileLoading = false;
  }

  initials(name: string): string {
    const n = name.trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
  }

  roleLabel(side: TransactionSide): string {
    return side === 'buy' ? 'Você compra' : 'Você vende';
  }

  statusBarClass(status: string): string {
    const barByStatus: Record<string, string> = {
      pending: 'bg-slate-400',
      paid: 'bg-mm-purple',
      completed: 'bg-green-500',
      dispute: 'bg-red-500',
    };
    return barByStatus[status] ?? 'bg-slate-300';
  }
}

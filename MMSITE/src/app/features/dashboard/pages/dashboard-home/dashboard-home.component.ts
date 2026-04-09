import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import * as TransactionActions from '../../../transaction/state/transaction.actions';
import {
  selectTransactions,
  selectTransactionsError,
  selectTransactionsLoading,
} from '../../../transaction/state/transaction.selectors';
import { Transaction } from '../../../../core/models/transaction.model';

@Component({
  selector: 'app-dashboard-home',
  imports: [AsyncPipe, CurrencyPipe, DatePipe, RouterLink, StatusBadgeComponent],
  template: `
    <section class="space-y-4">

      <!-- Cabeçalho -->
      <header class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 class="text-lg font-semibold text-slate-900">Transações em andamento</h1>
          <p class="mt-0.5 text-xs text-slate-500">
            Acompanhe o status de cada negociação e acesse detalhes com um clique.
          </p>
        </div>
        <a routerLink="/transaction/create" class="neon-button px-3 py-1.5 text-xs">+ Nova transação</a>
      </header>

      <!-- KPIs compactos -->
      <div class="flex flex-wrap gap-2 sm:gap-3">
        <article class="glass-panel flex items-center gap-2 px-2.5 py-2 sm:min-w-0 sm:flex-1">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-sm text-blue-600">📋</div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Em andamento</p>
            <p class="text-lg font-bold leading-tight text-slate-900">{{ ongoingTransactions$ | async }}</p>
          </div>
        </article>
        <article class="glass-panel flex items-center gap-2 px-2.5 py-2 sm:min-w-0 sm:flex-1">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-sm text-blue-600">🔒</div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Em custódia</p>
            <p class="text-lg font-bold leading-tight text-slate-900">{{ paidTransactions$ | async }}</p>
          </div>
        </article>
        <article class="glass-panel flex items-center gap-2 px-2.5 py-2 sm:min-w-0 sm:flex-1">
          <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-red-50 text-sm text-red-500">⚑</div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Em disputa</p>
            <p class="text-lg font-bold leading-tight text-slate-900">{{ disputeTransactions$ | async }}</p>
          </div>
        </article>
      </div>

      <!-- Lista de transações -->
      @if (loading$ | async) {
        <div class="rounded-md border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-400">
          Carregando transações...
        </div>
      } @else {
        @if (transactions$ | async; as transactions) {
          @if (ongoingOnly(transactions).length > 0) {
            <div class="space-y-1.5">
              <p class="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {{ ongoingOnly(transactions).length }} ativa(s)
              </p>
              @for (transaction of ongoingOnly(transactions); track transaction.id) {
                <a
                  [routerLink]="['/transaction', transaction.id]"
                  class="glass-panel group flex items-center gap-2 px-2 py-2 transition hover:border-blue-200 hover:shadow-sm sm:gap-3 sm:px-3"
                >
                  <div
                    class="h-12 w-0.5 shrink-0 self-stretch rounded-full sm:h-14"
                    [class]="statusBarClass(transaction.status)"
                  ></div>

                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {{ transaction.id }}
                    </p>
                    <h3 class="truncate text-sm font-semibold leading-snug text-slate-800 group-hover:text-blue-800">
                      {{ transaction.title }}
                    </h3>
                    <p class="truncate text-[10px] text-slate-500">
                      {{ transaction.buyerName }} → {{ transaction.sellerName }}
                    </p>
                  </div>

                  <div class="hidden shrink-0 text-right sm:block">
                    <app-status-badge [status]="transaction.status" />
                    <p class="mt-0.5 text-xs font-semibold text-slate-900">
                      {{ transaction.amount | currency: transaction.currency : 'symbol' : '1.2-2' }}
                    </p>
                    <p class="text-[10px] text-slate-400">{{ transaction.createdAt | date: 'dd/MM/yy' }}</p>
                  </div>

                  <div class="flex shrink-0 flex-col items-end gap-0.5 text-right sm:hidden">
                    <p class="text-xs font-semibold text-slate-900">
                      {{ transaction.amount | currency: transaction.currency : 'symbol' : '1.2-2' }}
                    </p>
                    <app-status-badge [status]="transaction.status" />
                  </div>

                  <span class="shrink-0 text-lg leading-none text-slate-300 group-hover:text-blue-400">›</span>
                </a>
              }
            </div>
          } @else {
            <div class="rounded-md border border-dashed border-slate-300 bg-white p-5 text-center">
              <p class="text-xs font-medium text-slate-500">Nenhuma transação em andamento.</p>
              <a routerLink="/transaction/create" class="neon-button mt-3 inline-flex px-3 py-1.5 text-xs">
                Iniciar primeira transação
              </a>
            </div>
          }
        }
      }

      @if (error$ | async; as errorMessage) {
        <p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {{ errorMessage }}
        </p>
      }
    </section>
  `,
})
export class DashboardHomeComponent implements OnInit {
  private readonly store = inject(Store);

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

  ngOnInit(): void {
    this.store.dispatch(TransactionActions.loadTransactions({}));
  }

  ongoingOnly(transactions: Transaction[]): Transaction[] {
    return transactions.filter((transaction) => transaction.status !== 'completed');
  }

  statusBarClass(status: string): string {
    const map: Record<string, string> = {
      pending:   'bg-slate-400',
      paid:      'bg-blue-500',
      completed: 'bg-green-500',
      dispute:   'bg-red-500',
    };
    return map[status] ?? 'bg-slate-300';
  }
}

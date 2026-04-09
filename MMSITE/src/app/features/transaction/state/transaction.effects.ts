import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of, switchMap } from 'rxjs';
import { Transaction } from '../../../core/models/transaction.model';
import * as TransactionActions from './transaction.actions';

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'TRX-001',
    title: 'Servico de design',
    amount: 1500,
    currency: 'BRL',
    buyerName: 'Ana',
    sellerName: 'Carlos',
    status: 'pending',
    createdAt: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 'TRX-002',
    title: 'Desenvolvimento landing page',
    amount: 2200,
    currency: 'BRL',
    buyerName: 'Joao',
    sellerName: 'Marina',
    status: 'paid',
    createdAt: '2026-04-03T12:30:00.000Z',
  },
  {
    id: 'TRX-003',
    title: 'Mentoria tecnica',
    amount: 900,
    currency: 'BRL',
    buyerName: 'Paula',
    sellerName: 'Rafael',
    status: 'dispute',
    createdAt: '2026-04-05T08:15:00.000Z',
  },
];

@Injectable()
export class TransactionEffects {
  private readonly actions$ = inject(Actions);

  loadTransactions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.loadTransactions),
      switchMap(({ status }) => {
        const filtered = status
          ? MOCK_TRANSACTIONS.filter((transaction) => transaction.status === status)
          : MOCK_TRANSACTIONS;

        return of(
          TransactionActions.loadTransactionsSuccess({
            transactions: filtered,
          }),
        );
      }),
    ),
  );
}

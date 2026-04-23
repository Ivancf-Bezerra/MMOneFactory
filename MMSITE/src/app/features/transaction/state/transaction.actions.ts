import { createAction, props } from '@ngrx/store';
import { Transaction, TransactionStatus } from '../../../core/models/transaction.model';

export const loadTransactions = createAction(
  '[Transaction] Load Transactions',
  props<{ status?: TransactionStatus }>(),
);

export const loadTransactionsSuccess = createAction(
  '[Transaction] Load Transactions Success',
  props<{ transactions: Transaction[] }>(),
);

export const loadTransactionsFailure = createAction(
  '[Transaction] Load Transactions Failure',
  props<{ message: string }>(),
);

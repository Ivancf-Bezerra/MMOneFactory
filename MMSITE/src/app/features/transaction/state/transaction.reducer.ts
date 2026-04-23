import { createReducer, on } from '@ngrx/store';
import { Transaction } from '../../../core/models/transaction.model';
import * as TransactionActions from './transaction.actions';

export const transactionFeatureKey = 'transactions';

export interface TransactionState {
  items: Transaction[];
  loading: boolean;
  error: string | null;
}

export const initialState: TransactionState = {
  items: [],
  loading: false,
  error: null,
};

export const transactionReducer = createReducer(
  initialState,
  on(TransactionActions.loadTransactions, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(TransactionActions.loadTransactionsSuccess, (state, { transactions }) => ({
    ...state,
    loading: false,
    items: transactions,
  })),
  on(TransactionActions.loadTransactionsFailure, (state, { message }) => ({
    ...state,
    loading: false,
    error: message,
  })),
);

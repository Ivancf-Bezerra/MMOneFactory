import { createFeatureSelector, createSelector } from '@ngrx/store';
import { transactionFeatureKey, TransactionState } from './transaction.reducer';

export const selectTransactionState = createFeatureSelector<TransactionState>(transactionFeatureKey);

export const selectTransactions = createSelector(selectTransactionState, (state) => state.items);
export const selectTransactionsLoading = createSelector(
  selectTransactionState,
  (state) => state.loading,
);
export const selectTransactionsError = createSelector(selectTransactionState, (state) => state.error);

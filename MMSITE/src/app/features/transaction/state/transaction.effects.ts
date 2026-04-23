import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { TransactionApiService } from '../../../core/services/transaction-api.service';
import * as TransactionActions from './transaction.actions';

@Injectable()
export class TransactionEffects {
  private readonly actions$ = inject(Actions);
  private readonly transactionApi = inject(TransactionApiService);

  loadTransactions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.loadTransactions),
      switchMap(({ status }) =>
        this.transactionApi.list(status).pipe(
          map((transactions) => TransactionActions.loadTransactionsSuccess({ transactions })),
          catchError(() =>
            of(
              TransactionActions.loadTransactionsFailure({
                message: 'Não foi possível carregar transações da API.',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}

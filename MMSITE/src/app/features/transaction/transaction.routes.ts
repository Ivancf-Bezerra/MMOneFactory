import { Routes } from '@angular/router';
import { CreateTransactionComponent } from './pages/create-transaction/create-transaction.component';
import { TransactionDetailComponent } from './pages/transaction-detail/transaction-detail.component';

export const TRANSACTION_ROUTES: Routes = [
  { path: 'create', component: CreateTransactionComponent },
  { path: ':id', component: TransactionDetailComponent },
];

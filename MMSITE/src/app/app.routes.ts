import { Routes } from '@angular/router';
import { MainShellComponent } from './layout/main-shell/main-shell.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: MainShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      { path: 'catalogo', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'transaction',
        loadChildren: () =>
          import('./features/transaction/transaction.routes').then((m) => m.TRANSACTION_ROUTES),
      },
      {
        path: 'dispute',
        loadChildren: () =>
          import('./features/dispute/dispute.routes').then((m) => m.DISPUTE_ROUTES),
      },
      { path: '', pathMatch: 'full', redirectTo: 'transaction/create' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];

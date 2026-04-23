import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideLucideConfig } from '@lucide/angular';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { mockBackendInterceptor } from './core/interceptors/mock-backend.interceptor';
import { transactionFeatureKey, transactionReducer } from './features/transaction/state/transaction.reducer';
import { TransactionEffects } from './features/transaction/state/transaction.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideLucideConfig({ strokeWidth: 1.75 }),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Em *.github.io o servidor nao faz fallback para index.html; hash evita 404 ao recarregar.
    provideRouter(
      routes,
      ...(typeof window !== 'undefined' && /\.github\.io$/i.test(window.location.hostname)
        ? [withHashLocation()]
        : []),
    ),
    provideHttpClient(withInterceptors([mockBackendInterceptor, jwtInterceptor])),
    provideStore({
      [transactionFeatureKey]: transactionReducer,
    }),
    provideEffects([TransactionEffects]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: false,
    }),
  ],
};

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { ClerkService } from '../services/clerk.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const clerkService = inject(ClerkService);

  return from(clerkService.getToken()).pipe(
    switchMap((clerkToken) => {
      const localToken = localStorage.getItem('mm_access_token');
      const token = clerkToken ?? localToken;
      if (!token) return next(req);

      const authRequest = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
      return next(authRequest);
    }),
  );
};

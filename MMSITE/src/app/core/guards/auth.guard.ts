import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ClerkService } from '../services/clerk.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const clerkService = inject(ClerkService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  if (await clerkService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

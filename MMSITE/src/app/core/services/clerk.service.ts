import { Injectable } from '@angular/core';
import { CLERK_FRONTEND_API_URL, CLERK_PUBLISHABLE_KEY } from '../config/clerk.config';

type ClerkInstance = {
  load: () => Promise<void>;
  isSignedIn: boolean;
  session?: { getToken: () => Promise<string | null> } | null;
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    primaryEmailAddress?: { emailAddress?: string | null } | null;
  } | null;
  redirectToSignIn: () => Promise<unknown>;
  signOut: () => Promise<unknown>;
};

declare global {
  interface Window {
    Clerk?: new (publishableKey: string) => ClerkInstance;
  }
}

@Injectable({ providedIn: 'root' })
export class ClerkService {
  private clerk: ClerkInstance | null = null;
  private loadingPromise: Promise<ClerkInstance> | null = null;

  private async ensureClerkScript(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (window.Clerk) return;

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-clerk-loader="1"]');
      if (existing) {
        if (window.Clerk) {
          resolve();
          return;
        }
        if (existing.dataset['clerkLoaded'] === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('clerk_script_error')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = `${CLERK_FRONTEND_API_URL}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;
      script.async = true;
      script.defer = true;
      script.dataset['clerkLoader'] = '1';
      script.setAttribute('data-clerk-publishable-key', CLERK_PUBLISHABLE_KEY);
      script.setAttribute('crossorigin', 'anonymous');
      script.onload = () => {
        script.dataset['clerkLoaded'] = '1';
        resolve();
      };
      script.onerror = () => reject(new Error('clerk_script_error'));
      document.head.appendChild(script);
    });
  }

  private async getClerk(): Promise<ClerkInstance> {
    if (this.clerk) return this.clerk;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      await this.ensureClerkScript();
      if (!window.Clerk) throw new Error('clerk_unavailable');
      const instance = new window.Clerk(CLERK_PUBLISHABLE_KEY);
      await instance.load();
      this.clerk = instance;
      return instance;
    })();

    return this.loadingPromise;
  }

  async isAuthenticated(): Promise<boolean> {
    const clerk = await this.getClerk();
    return clerk.isSignedIn;
  }

  async getToken(): Promise<string | null> {
    const clerk = await this.getClerk();
    return (await clerk.session?.getToken()) ?? null;
  }

  async getUserProfile(): Promise<{ name: string | null; email: string | null }> {
    const clerk = await this.getClerk();
    const user = clerk.user;
    const email = user?.primaryEmailAddress?.emailAddress ?? null;
    const firstName = user?.firstName?.trim() ?? '';
    const lastName = user?.lastName?.trim() ?? '';
    const fullName = `${firstName} ${lastName}`.trim() || user?.username || null;
    return { name: fullName, email };
  }

  async redirectToSignIn(): Promise<void> {
    const clerk = await this.getClerk();
    await clerk.redirectToSignIn();
  }

  async signOut(): Promise<void> {
    const clerk = await this.getClerk();
    await clerk.signOut();
  }
}

import { Component, inject, OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthApiService } from '../../../../core/services/auth-api.service';
import { ClerkService } from '../../../../core/services/clerk.service';
import { ToastService } from '../../../../core/services/toast.service';
import { controlErrorMessage } from '../../../../core/utils/form-messages';
import { normalizeFreeText } from '../../../../core/utils/sanitize';
import { passwordStrengthValidator } from '../../../../core/validators/mm-validators';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mm-auth-shell">
      <div class="mb-6 text-center">
        <span class="mb-3 inline-grid h-12 w-12 place-content-center rounded-mm bg-gradient-to-br from-mm-purple-deep to-mm-purple text-xl font-bold text-white shadow-sm ring-1 ring-violet-200/70">M</span>
        <h1 class="mm-page-h1">Bem-vindo de volta</h1>
        <p class="mt-1 mm-page-lead">Entre para negociar com confiança e acompanhar cada etapa com transparência.</p>
      </div>

      @if (localDemoAuth && !showLocalApiCredentialsHint) {
        <div
          class="mb-5 rounded-mm-xl border-2 border-amber-400/90 bg-gradient-to-br from-amber-50 via-white to-violet-50 px-4 py-4 shadow-md"
          role="region"
          aria-label="Acesso de teste GitHub Pages"
        >
          <p class="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900/85">GitHub Pages · não é produção</p>
          <h2 class="mt-1.5 text-center text-base font-semibold text-mm-ink">Acesso de teste (administrador)</h2>
          <p class="mx-auto mt-2 max-w-sm text-center text-[11px] leading-relaxed text-slate-600">
            Sessão só neste navegador. Use para navegar pela interface; não há API de negociações por trás neste site estático.
          </p>
          <button type="button" class="neon-button mt-4 w-full py-2.5 text-sm" (click)="enterAdminDemo()">
            Entrar como administrador (demo)
          </button>
        </div>
      }

      <div class="glass-panel p-5 sm:p-6">
        <form class="space-y-4" [formGroup]="form" (ngSubmit)="onSubmit()">
          <label class="block">
            <span class="mb-1 block text-sm font-medium text-slate-700">E-mail</span>
            <input
              formControlName="email"
              type="email"
              placeholder="seu@email.com"
              autocomplete="email"
              class="input-base"
              [class.input-error]="form.controls.email.touched && form.controls.email.invalid"
            />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <p class="mt-1 text-xs text-red-600">{{ err('email') }}</p>
            }
          </label>

          <label class="block">
            <span class="mb-1 block text-sm font-medium text-slate-700">Senha</span>
            <input
              formControlName="password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              class="input-base"
              [class.input-error]="form.controls.password.touched && form.controls.password.invalid"
            />
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <p class="mt-1 text-xs text-red-600">{{ err('password') }}</p>
            }
          </label>

          <button type="submit" class="neon-button w-full py-2.5">
            Entrar
          </button>
        </form>

        @if (localDemoAuth && showLocalApiCredentialsHint) {
          <p class="mt-3 rounded-mm border border-violet-100 bg-mm-surface/60 px-3 py-2 text-left text-[11px] leading-relaxed text-slate-600">
            <span class="font-semibold text-mm-purple-dark">Com a API local</span>
            (pasta MMAPI, <code class="rounded bg-white/80 px-1">dotnet run</code>, proxy do
            <code class="rounded bg-white/80 px-1">ng serve</code>): e-mail
            <code class="rounded bg-white/80 px-1">{{ localDemoEmail }}</code>
            · senha <code class="rounded bg-white/80 px-1">{{ localDemoPassword }}</code>
          </p>
          <button
            type="button"
            class="mt-2 w-full rounded-mm border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
            (click)="enterAdminDemo()"
          >
            Entrar como administrador (demo, sem API)
          </button>
        }

        <button
          type="button"
          class="mt-2 w-full rounded-mm border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          (click)="signInWithClerk()"
        >
          Continuar com Google
        </button>

        <p class="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
          Novo por aqui?
          <a routerLink="/register" class="font-semibold text-mm-purple-dark hover:underline">Crie sua conta grátis</a>
        </p>
      </div>

      <p class="mt-4 text-center text-xs text-slate-400">
        Sua experiência protegida do início ao fim
      </p>
    </section>
  `,
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly clerkService = inject(ClerkService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly localDemoAuth = environment.localDemoAuth;
  readonly showLocalApiCredentialsHint = environment.showLocalApiCredentialsHint;
  /** Evita `@` literal no template (parser de control flow do Angular). */
  readonly localDemoEmail = 'local@middleman.test';
  readonly localDemoPassword = 'Localdemo1';

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      void this.router.navigateByUrl('/transaction/create');
      return;
    }
    const q = this.route.snapshot.queryParamMap;
    if (environment.localDemoAuth && (q.get('admin') === '1' || q.get('demo') === '1')) {
      this.enterAdminDemo();
      return;
    }
    void this.hydrateClerkSessionIfAny();
  }

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
  });

  err(field: 'email' | 'password'): string {
    return controlErrorMessage(this.form.get(field));
  }

  async onSubmit(): Promise<void> {
    const emailNorm = normalizeFreeText(this.form.controls.email.value).toLowerCase();
    this.form.controls.email.setValue(emailNorm, { emitViewToModelChange: false });
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    try {
      const response = await firstValueFrom(
        this.authApi.login({
          email: emailNorm,
          password: this.form.controls.password.value,
        }),
      );

      if (!response?.accessToken) {
        this.toastService.show('Não foi possível entrar', 'Tente novamente em instantes.', 'warning');
        return;
      }

      this.authService.saveToken(response.accessToken);
      this.authService.setUserEmail(response.user?.email ?? emailNorm);
      if (response.user?.name) {
        this.authService.setUserDisplayName(response.user.name);
      }
      void this.router.navigateByUrl('/transaction/create');
    } catch {
      this.toastService.show('Não foi possível entrar', 'Confira seus dados e tente novamente.', 'warning');
    }
  }

  /**
   * Sessão de teste só no frontend (localStorage). Usado no GitHub Pages e em dev sem API.
   * Token arbitrário — o guard só verifica presença; não há validação remota neste modo.
   */
  enterAdminDemo(): void {
    this.authService.saveToken('mm-gh-pages-admin-demo');
    this.authService.setUserDisplayName('Administrador (demo)');
    this.authService.setUserEmail('admin.demo@github-pages.local');
    this.toastService.show(
      'Sessão de teste',
      'Modo administrador (demonstração): pode navegar pela interface. Dados só neste navegador.',
      'success',
    );
    void this.router.navigateByUrl('/transaction/create');
  }

  async signInWithClerk(): Promise<void> {
    try {
      await this.clerkService.redirectToSignIn();
    } catch {
      this.toastService.show('Google indisponível', 'Não conseguimos abrir o login com Google agora.', 'warning');
    }
  }

  private async hydrateClerkSessionIfAny(): Promise<void> {
    try {
      const signedIn = await this.clerkService.isAuthenticated();
      if (!signedIn) return;
      const token = await this.clerkService.getToken();
      const profile = await this.clerkService.getUserProfile();
      if (token) this.authService.saveToken(token);
      if (profile.name) this.authService.setUserDisplayName(profile.name);
      if (profile.email) this.authService.setUserEmail(profile.email);
      void this.router.navigateByUrl('/transaction/create');
    } catch {
      // Mantém fallback no login tradicional caso Clerk falhe.
    }
  }
}

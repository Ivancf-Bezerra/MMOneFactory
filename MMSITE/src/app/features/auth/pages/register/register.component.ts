import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthApiService } from '../../../../core/services/auth-api.service';
import { ClerkService } from '../../../../core/services/clerk.service';
import { ToastService } from '../../../../core/services/toast.service';
import { controlErrorMessage } from '../../../../core/utils/form-messages';
import { normalizeFreeText } from '../../../../core/utils/sanitize';
import { passwordStrengthValidator } from '../../../../core/validators/mm-validators';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mm-auth-shell">
      <div class="mb-6 text-center">
        <span class="mb-3 inline-grid h-12 w-12 place-content-center rounded-mm bg-gradient-to-br from-mm-purple-deep to-mm-purple text-xl font-bold text-white shadow-sm ring-1 ring-violet-200/70">M</span>
        <h1 class="mm-page-h1">Criar sua conta</h1>
        <p class="mt-1 mm-page-lead">Abra sua conta e negocie com o dinheiro guardado na plataforma até tudo ser concluído.</p>
      </div>

      <div class="glass-panel p-5 sm:p-6">
        <form class="space-y-4" [formGroup]="form" (ngSubmit)="onSubmit()">
          <label class="block">
            <span class="mb-1 block text-sm font-medium text-slate-700">Nome completo</span>
            <input
              formControlName="name"
              type="text"
              placeholder="Seu nome"
              autocomplete="name"
              class="input-base"
              [class.input-error]="form.controls.name.touched && form.controls.name.invalid"
            />
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <p class="mt-1 text-xs text-red-600">{{ err('name') }}</p>
            }
          </label>

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
              autocomplete="new-password"
              class="input-base"
              [class.input-error]="form.controls.password.touched && form.controls.password.invalid"
            />
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <p class="mt-1 text-xs text-red-600">{{ err('password') }}</p>
            }
            <p class="mt-1 text-xs text-slate-400">Mínimo 8 caracteres, com letras e números.</p>
          </label>

          <button type="submit" class="neon-button w-full py-2.5">Criar conta</button>
        </form>

        <div class="my-4 flex items-center gap-3">
          <span class="h-px flex-1 bg-slate-200"></span>
          <span class="text-xs font-medium uppercase tracking-wide text-slate-400">ou</span>
          <span class="h-px flex-1 bg-slate-200"></span>
        </div>

        <button
          type="button"
          class="w-full rounded-mm border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          (click)="onGoogleSignup()"
        >
          Continuar com Google
        </button>

        <p class="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
          Já tem conta?
          <a routerLink="/login" class="font-semibold text-mm-purple-dark hover:underline">Entrar</a>
        </p>
      </div>

      <p class="mt-4 text-center text-xs text-slate-400">
        Dados tratados com cuidado · Pagamentos com proteção
      </p>
    </section>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly clerkService = inject(ClerkService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
  });

  err(field: 'name' | 'email' | 'password'): string {
    return controlErrorMessage(this.form.get(field));
  }

  async onSubmit(): Promise<void> {
    const nameNorm = normalizeFreeText(this.form.controls.name.value);
    this.form.controls.name.setValue(nameNorm, { emitViewToModelChange: false });
    const emailNorm = normalizeFreeText(this.form.controls.email.value).toLowerCase();
    this.form.controls.email.setValue(emailNorm, { emitViewToModelChange: false });

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    try {
      const response = await firstValueFrom(
        this.authApi.register({
          name: nameNorm,
          email: emailNorm,
          password: this.form.controls.password.value,
        }),
      );

      if (!response?.accessToken) {
        this.toastService.show('Falha no cadastro', 'A API não retornou token de acesso.', 'warning');
        return;
      }

      this.authService.saveToken(response.accessToken);
      this.authService.setUserDisplayName(response.user?.name ?? nameNorm);
      this.authService.setUserEmail(response.user?.email ?? emailNorm);
      void this.router.navigateByUrl('/transaction/create');
    } catch {
      this.toastService.show('Falha no cadastro', 'Não foi possível criar conta na API.', 'warning');
    }
  }

  async onGoogleSignup(): Promise<void> {
    try {
      await this.clerkService.redirectToSignIn();
    } catch {
      this.toastService.show('Falha no Clerk', 'Não foi possível abrir o login com Google.', 'warning');
    }
  }
}

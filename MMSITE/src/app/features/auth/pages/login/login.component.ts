import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { controlErrorMessage } from '../../../../core/utils/form-messages';
import { normalizeFreeText } from '../../../../core/utils/sanitize';
import { passwordStrengthValidator } from '../../../../core/validators/mm-validators';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mx-auto mt-14 max-w-md">
      <div class="mb-6 text-center">
        <span class="mb-3 inline-grid h-12 w-12 place-content-center rounded-md bg-blue-900 text-xl font-bold text-white shadow">M</span>
        <h1 class="text-xl font-semibold text-slate-900">Entrar na plataforma</h1>
        <p class="mt-1 text-sm text-slate-500">Gerencie suas transações com segurança e transparência.</p>
      </div>

      <div class="glass-panel p-6">
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

        <p class="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
          Ainda não tem conta?
          <a routerLink="/register" class="font-semibold text-blue-700 hover:underline">Criar conta grátis</a>
        </p>
      </div>

      <p class="mt-4 text-center text-xs text-slate-400">
        Ambiente seguro · Dados protegidos · Custódia certificada
      </p>
    </section>
  `,
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
  });

  err(field: 'email' | 'password'): string {
    return controlErrorMessage(this.form.get(field));
  }

  onSubmit(): void {
    const emailNorm = normalizeFreeText(this.form.controls.email.value).toLowerCase();
    this.form.controls.email.setValue(emailNorm, { emitViewToModelChange: false });
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.authService.saveToken('dev-token');
    void this.router.navigateByUrl('/transaction/create');
  }
}

import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { LucideShield, LucideUserCheck } from '@lucide/angular';
import { AuthService, VerifiedProfileData } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TransactionApiService } from '../../../../core/services/transaction-api.service';
import { Transaction } from '../../../../core/models/transaction.model';
import { normalizeFreeText } from '../../../../core/utils/sanitize';

@Component({
  selector: 'app-profile-page',
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, LucideShield, LucideUserCheck],
  template: `
    <section class="mm-page-shell min-w-0 space-y-5">
      <header class="mm-page-header">
        <div class="min-w-0 space-y-1.5">
          <h1 class="mm-page-h1">Seu perfil Middleman</h1>
          <p class="mm-page-lead">
            Ajuste como você aparece nas negociações e veja, num único lugar, o resumo de confiança da sua conta.
          </p>
        </div>
        <a routerLink="/transaction/create" class="neon-button shrink-0 px-3 py-1.5 text-xs">Nova transação</a>
      </header>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article class="glass-panel p-4 sm:p-5">
          <div class="mb-4 flex items-start gap-3 sm:items-center">
            <span class="grid h-8 w-8 shrink-0 place-content-center rounded-mm bg-mm-surface text-mm-purple">
              <svg lucideUserCheck class="h-4 w-4 shrink-0" aria-hidden="true" />
            </span>
            <div class="min-w-0 space-y-1">
              <h2 class="text-sm font-semibold text-mm-ink">Identidade verificada</h2>
              <p class="text-xs text-slate-500">
                Use um perfil confiável para abrir negociações com mais segurança e clareza para todas as partes.
              </p>
            </div>
          </div>
          @if (!hasVerifiedProfile && !showVerifiedForm) {
            <div class="space-y-3">
              <p class="text-xs leading-relaxed text-slate-600">
                Crie seu perfil verificado para desbloquear a abertura de negociações com proteção. Os dados ficam
                vinculados ao seu e-mail, apenas para uso na plataforma.
              </p>
              <div class="flex justify-center pt-0.5">
                <button
                  type="button"
                  class="neon-button px-4 py-2 text-xs font-semibold"
                  (click)="startVerifiedProfileCreation()"
                >
                  Ativar perfil verificado
                </button>
              </div>
            </div>
          }
          @if (showVerifiedForm) {
            <form class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
            <label class="block sm:col-span-2">
              <span class="mb-1 block text-xs font-medium text-slate-700">Nome de exibição (perfil social)</span>
              <input formControlName="displayName" type="text" class="input-flat text-sm" />
            </label>
            <p class="sm:col-span-2 rounded-mm border border-violet-100 bg-violet-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-violet-900">
              Os dados cadastrais abaixo são protegidos e usados apenas para validar o uso da conta. Depois de
              confirmados, ajustes estruturais só podem ser pedidos ao suporte.
            </p>
            <label class="block sm:col-span-2">
              <span class="mb-1 block text-xs font-medium text-slate-700">Nome completo</span>
              <input
                formControlName="fullName"
                type="text"
                class="input-flat text-sm"
                [attr.readonly]="hasVerifiedProfile ? '' : null"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">CPF</span>
              <input
                formControlName="cpf"
                type="text"
                class="input-flat text-sm"
                [attr.readonly]="hasVerifiedProfile ? '' : null"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Telefone</span>
              <input
                formControlName="phone"
                type="text"
                class="input-flat text-sm"
                [attr.readonly]="hasVerifiedProfile ? '' : null"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Data de nascimento</span>
              <input
                formControlName="birthDate"
                type="date"
                class="input-flat text-sm"
                [attr.readonly]="hasVerifiedProfile ? '' : null"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-medium text-slate-700">Documento</span>
              <input
                formControlName="documentId"
                type="text"
                class="input-flat text-sm"
                [attr.readonly]="hasVerifiedProfile ? '' : null"
              />
            </label>
            @if (!hasVerifiedProfile) {
              <label class="flex items-start gap-3 rounded-mm border border-slate-200 bg-slate-50/70 px-3 py-2.5 sm:col-span-2">
                <input formControlName="dataConfirmation" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-mm-purple" />
                <span class="text-[11px] leading-relaxed text-slate-700">
                  Confirmo a veracidade dos dados e autorizo o vínculo deste CPF ao meu e-mail para uso da plataforma.
                </span>
              </label>
            }
            @if (profileForm.invalid && profileForm.touched) {
              <p class="sm:col-span-2 text-xs text-red-600">Revise os campos obrigatórios para salvar.</p>
            }
            <div class="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
              <button type="submit" class="neon-button px-4 py-2 text-xs font-semibold">Salvar perfil social</button>
            </div>
            </form>
          }
        </article>

        <aside class="space-y-3">
          <article class="glass-panel p-3.5">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Resumo da sua atividade</p>
            @if (kpis$ | async; as kpis) {
              <div class="mt-2 space-y-2 text-xs text-slate-600">
                <p class="flex items-center justify-between gap-2">
                  <span>Total de negociações criadas</span><strong class="text-mm-ink">{{ kpis.total }}</strong>
                </p>
                <p class="flex items-center justify-between gap-2">
                  <span>Concluídas com sucesso</span><strong class="text-emerald-700">{{ kpis.completed }}</strong>
                </p>
                <p class="flex items-center justify-between gap-2">
                  <span>Ativas neste momento</span><strong class="text-mm-purple-dark">{{ kpis.ongoing }}</strong>
                </p>
                <p class="flex items-center justify-between gap-2">
                  <span>Em disputa assistida</span><strong class="text-red-700">{{ kpis.dispute }}</strong>
                </p>
              </div>
            }
          </article>

          <article class="glass-panel p-3.5">
            <div class="mb-1.5 flex items-center gap-1.5 text-mm-purple-dark">
              <svg lucideShield class="h-4 w-4 shrink-0" aria-hidden="true" />
              <p class="text-[10px] font-semibold uppercase tracking-wide">Confiança e privacidade</p>
            </div>
            <ul class="list-disc space-y-1.5 pl-4 text-xs text-slate-600">
              <li>Negociações exigem perfil verificado; o valor só libera com confirmação de ambas as partes.</li>
              <li>Dados de identidade servem à validação — nada disso em páginas públicas. O nome de exibição pode mudar quando quiser.</li>
              <li>Ao sair, informação sensível armazenada localmente é limpa neste dispositivo.</li>
            </ul>
          </article>
        </aside>
      </div>
    </section>
  `,
})
export class ProfilePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly transactionApi = inject(TransactionApiService);

  hasVerifiedProfile = false;
  showVerifiedForm = false;

  readonly profileForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    cpf: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]],
    birthDate: ['', [Validators.required]],
    documentId: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(40)]],
    dataConfirmation: [false],
  });

  readonly kpis$ = this.transactionApi.list().pipe(
    map((transactions: Transaction[]) => {
      const completed = transactions.filter((t) => t.status === 'completed').length;
      const dispute = transactions.filter((t) => t.status === 'dispute').length;
      const total = transactions.length;
      return { total, completed, dispute, ongoing: Math.max(0, total - completed) };
    }),
    // fallback para ambientes sem API disponível
    catchError(() => of({ total: 0, completed: 0, dispute: 0, ongoing: 0 })),
  );

  ngOnInit(): void {
    const existing = this.authService.getVerifiedProfile();
    if (existing) {
      this.hasVerifiedProfile = true;
      this.showVerifiedForm = true;
      this.profileForm.patchValue({
        ...existing,
        displayName: this.authService.userDisplayName() ?? existing.fullName,
      });
      this.profileForm.get('dataConfirmation')?.clearValidators();
      this.profileForm.get('dataConfirmation')?.updateValueAndValidity({ emitEvent: false });
    } else {
      this.hasVerifiedProfile = false;
      this.showVerifiedForm = false;
      this.resetMockData();
      this.profileForm.get('dataConfirmation')?.clearValidators();
      this.profileForm.get('dataConfirmation')?.updateValueAndValidity({ emitEvent: false });
    }
  }

  resetMockData(): void {
    this.profileForm.patchValue({
      displayName: 'Usuário Teste',
      fullName: 'Usuário Teste Verificado',
      cpf: '12345678901',
      phone: '11999998888',
      birthDate: '1995-05-15',
      documentId: 'RG1234567',
      dataConfirmation: false,
    });
  }

  startVerifiedProfileCreation(): void {
    this.showVerifiedForm = true;
    this.resetMockData();
    this.profileForm.get('dataConfirmation')?.setValidators([Validators.requiredTrue]);
    this.profileForm.get('dataConfirmation')?.setValue(false);
    this.profileForm.get('dataConfirmation')?.updateValueAndValidity();
  }

  saveProfile(): void {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) {
      this.toastService.show('Ajuste necessário', 'Revise os campos obrigatórios do perfil.', 'warning');
      return;
    }
    const raw = this.profileForm.getRawValue();
    const displayName = normalizeFreeText(raw.displayName ?? '');
    this.authService.setUserDisplayName(displayName);

    if (!this.hasVerifiedProfile) {
      const payload: VerifiedProfileData = {
        fullName: normalizeFreeText(raw.fullName ?? ''),
        cpf: (raw.cpf ?? '').replace(/\D/g, ''),
        phone: (raw.phone ?? '').replace(/\D/g, ''),
        birthDate: raw.birthDate ?? '',
        documentId: normalizeFreeText(raw.documentId ?? ''),
      };
      const result = this.authService.setVerifiedProfile(payload);
      if (!result.ok) {
        this.toastService.show('Não foi possível salvar', result.message, 'warning');
        return;
      }
      this.hasVerifiedProfile = true;
      this.profileForm.get('dataConfirmation')?.clearValidators();
      this.profileForm.get('dataConfirmation')?.updateValueAndValidity({ emitEvent: false });
      this.toastService.show('Perfil verificado criado', 'Seus dados foram vinculados ao e-mail com sucesso.', 'success');
    } else {
      this.toastService.show('Nome de exibição salvo', 'A alteração entra em vigor nas negociações em seguida.', 'success');
    }
  }
}

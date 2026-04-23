import { Component, inject } from '@angular/core';
import { LucideFlag } from '@lucide/angular';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../../core/services/toast.service';
import { controlErrorMessage } from '../../../../core/utils/form-messages';
import { normalizeFreeText } from '../../../../core/utils/sanitize';

@Component({
  selector: 'app-dispute-detail',
  imports: [ReactiveFormsModule, RouterLink, LucideFlag],
  template: `
    <section class="mm-page-shell--narrow space-y-5">
      <header class="glass-panel flex items-start gap-4 p-5 sm:p-6">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-mm bg-red-50 text-red-500">
          <svg lucideFlag class="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
        </div>
        <div>
          <h1 class="mm-page-h1">Abrir disputa</h1>
          <p class="mt-1 mm-page-lead">
            Transação <strong class="text-slate-700">{{ transactionId }}</strong> —
            Descreva o que aconteceu e envie o que tiver como prova para abrir a mediação.
          </p>
        </div>
      </header>

      <div class="glass-panel p-5 sm:p-6">
        <form class="space-y-5" [formGroup]="form" (ngSubmit)="submitDispute()">
          <label class="block">
            <span class="mb-1 block text-sm font-medium text-slate-700">Motivo principal</span>
            <select
              formControlName="reason"
              class="input-flat"
              [class.input-error]="form.controls.reason.touched && form.controls.reason.invalid"
            >
              <option value="" disabled>Selecione um motivo…</option>
              <option value="nao_recebido">Produto/serviço não recebido</option>
              <option value="divergente">Item diferente do anunciado</option>
              <option value="acesso_negado">Acesso bloqueado ou revogado</option>
              <option value="outros">Outro motivo</option>
            </select>
            @if (form.controls.reason.touched && form.controls.reason.invalid) {
              <p class="mt-1 text-xs text-red-600">{{ err('reason') }}</p>
            }
          </label>

          <label class="block">
            <span class="mb-1 block text-sm font-medium text-slate-700">Descrição detalhada</span>
            <p class="mb-2 text-xs text-slate-400">
              Inclua datas, evidências e qualquer informação relevante (mínimo 20 caracteres).
            </p>
            <textarea
              formControlName="description"
              rows="6"
              placeholder="Ex.: Paguei no dia X, o vendedor disse que entregou, mas eu não recebi o acesso..."
              class="input-base resize-none"
              [class.input-error]="form.controls.description.touched && form.controls.description.invalid"
            ></textarea>
            @if (form.controls.description.touched && form.controls.description.invalid) {
              <p class="mt-1 text-xs text-red-600">{{ err('description') }}</p>
            }
          </label>

          <div class="rounded-mm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p class="font-semibold">Antes de continuar</p>
            <p class="mt-0.5">Tente resolver pelo chat da transação primeiro. Sem evidências, o caso pode ser encerrado sem decisão.</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button type="submit" class="btn-danger">Registrar disputa</button>
            <a
              [routerLink]="['/transaction', transactionId]"
              [queryParams]="returnTxQueryParams"
              class="btn-ghost py-2.5"
            >
              Voltar para transação
            </a>
          </div>
        </form>
      </div>
    </section>
  `,
})
export class DisputeDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly transactionId = this.route.snapshot.paramMap.get('id') ?? '---';
  /** Mesmos query params da transacao (ida pela pagina de detalhe) para restaurar progresso ao voltar. */
  readonly returnTxQueryParams: Record<string, string> = this.extractReturnTxQueryParams(
    this.route.snapshot.queryParamMap,
  );

  readonly form = this.fb.group({
    reason: ['', [Validators.required, Validators.pattern(/^(nao_recebido|divergente|acesso_negado|outros)$/)]],
    description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(8000)]],
  });

  err(field: 'reason' | 'description'): string {
    return controlErrorMessage(this.form.get(field));
  }

  private extractReturnTxQueryParams(queryParamMap: ParamMap): Record<string, string> {
    const o: Record<string, string> = {};
    for (const k of ['type', 'side', 'delivery', 'window', 'gate']) {
      const v = queryParamMap.get(k);
      if (v !== null && v !== '') o[k] = v;
    }
    return o;
  }

  submitDispute(): void {
    const desc = normalizeFreeText(this.form.controls.description.value);
    this.form.controls.description.setValue(desc, { emitViewToModelChange: false });
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.toastService.show(
        'Revise o formulário',
        'Preencha motivo e descrição conforme solicitado.',
        'warning',
      );
      return;
    }

    void this.form.getRawValue().reason;

    this.toastService.show(
      'Disputa registrada',
      'Recebemos as informações. Em breve a mediação entra em contato.',
      'success',
    );
  }
}

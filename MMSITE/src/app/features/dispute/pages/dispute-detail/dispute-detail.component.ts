import { Component, inject } from '@angular/core';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../../core/services/toast.service';
import { controlErrorMessage } from '../../../../core/utils/form-messages';
import { normalizeFreeText } from '../../../../core/utils/sanitize';

@Component({
  selector: 'app-dispute-detail',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="mx-auto max-w-2xl space-y-5">
      <header class="glass-panel flex items-start gap-4 p-5">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50 text-xl">⚑</div>
        <div>
          <h1 class="text-lg font-semibold text-slate-900">Abrir disputa</h1>
          <p class="mt-0.5 text-sm text-slate-500">
            Transação <strong class="text-slate-700">{{ transactionId }}</strong> —
            Detalhe os motivos e evidências para que a mediação seja iniciada.
          </p>
        </div>
      </header>

      <div class="glass-panel p-5">
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
              placeholder="Ex.: Realizei o pagamento no dia X, o vendedor confirmou entrega, mas o acesso nunca foi disponibilizado..."
              class="input-base resize-none"
              [class.input-error]="form.controls.description.touched && form.controls.description.invalid"
            ></textarea>
            @if (form.controls.description.touched && form.controls.description.invalid) {
              <p class="mt-1 text-xs text-red-600">{{ err('description') }}</p>
            }
          </label>

          <div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p class="font-semibold">Antes de continuar</p>
            <p class="mt-0.5">Certifique-se de ter tentado resolver diretamente no chat da transação. Disputas sem
              evidências podem ser encerradas sem decisão.</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              type="submit"
              class="rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 active:bg-red-700"
            >
              Registrar disputa
            </button>
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

  private extractReturnTxQueryParams(m: ParamMap): Record<string, string> {
    const o: Record<string, string> = {};
    for (const k of ['type', 'side', 'delivery', 'window']) {
      const v = m.get(k);
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
      'Evidências enviadas. Aguarde o contato da mediação.',
      'warning',
    );
  }
}

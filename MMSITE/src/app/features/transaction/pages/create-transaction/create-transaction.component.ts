import { Component, inject, isDevMode } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastService } from '../../../../core/services/toast.service';
import { PLATFORM_DISPUTE_WINDOW_HOURS, TransactionSide, TransactionType } from '../../../../core/models/transaction.model';
import { controlErrorMessage } from '../../../../core/utils/form-messages';
import { normalizeFreeText } from '../../../../core/utils/sanitize';
import { minAmount } from '../../../../core/validators/mm-validators';

/** Preenchimento automatico do formulario em `ng serve` / builds nao otimizadas para producao. */
const MOCK_TICKET_FORM = {
  title: '[TESTE] Licenca software anual — MM OneFactory',
  amount: 199.9,
  currency: 'BRL' as const,
};

@Component({
  selector: 'app-create-transaction',
  imports: [ReactiveFormsModule],
  template: `
    <section class="mx-auto max-w-4xl space-y-5">
      <article class="glass-panel p-6 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <h1 class="text-2xl font-semibold">Nova transacao segura</h1>
          <button
            type="button"
            class="mm-help-btn"
            [attr.title]="helpIntroPage"
            aria-label="O que e este fluxo"
            (click)="$event.stopPropagation()"
          >
            ?
          </button>
        </div>
        <p class="mx-auto mt-2 max-w-xl text-xs text-slate-500">Tres passos: papel, dados, finalizar.</p>

        <div class="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-700">
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">1 · Papel</span>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">2 · Negociacao</span>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">3 · Regras e ticket</span>
        </div>

        @if (!formStarted) {
          <div class="mt-5">
            <button type="button" (click)="startTicket()" class="neon-button">Iniciar nova transacao</button>
          </div>
        }
      </article>

      @if (formStarted) {
        <article class="glass-panel p-6">
          <div class="flex items-center gap-1.5">
            <h2 class="text-lg font-semibold">Abrir ticket</h2>
            <button
              type="button"
              class="mm-help-btn"
              [attr.title]="helpFlow"
              aria-label="Como usar o formulario"
              (click)="$event.stopPropagation()"
            >
              ?
            </button>
          </div>
          @if (devMode) {
            <div class="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50/90 px-2 py-1.5 text-[11px] text-amber-950">
              <span><strong>Dev:</strong> mock nos campos.</span>
              <button type="button" (click)="applyMockTicketForm()" class="rounded border border-amber-300 bg-white px-2 py-0.5 font-medium hover:bg-amber-50">
                Reaplicar mock
              </button>
            </div>
          }

          <form class="mt-4 space-y-3" [formGroup]="ticketForm">
            <!-- Sessao 1: Perfil (papel) -->
            <div
              class="overflow-hidden rounded-md border border-slate-200 bg-white transition-all duration-300 ease-out"
              [class.opacity-60]="!isStepUnlocked(1)"
              [class.mm-step-flash]="flashStep === 1"
            >
              <button
                type="button"
                class="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                (click)="toggleSection('profile')"
                [disabled]="!isStepUnlocked(1)"
              >
                <span class="mm-step-badge">1</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-xs font-semibold uppercase tracking-wide text-blue-800">Passo 1</span>
                  <span class="flex items-center gap-1 font-semibold text-slate-800">
                    Seu papel
                    <button
                      type="button"
                      class="mm-help-btn"
                      [attr.title]="helpStep1Profile"
                      aria-label="Ajuda: comprador ou vendedor"
                      (click)="stopAccordionToggle($event)"
                    >
                      ?
                    </button>
                  </span>
                </span>
                <span class="text-slate-400" aria-hidden="true">{{ openProfile ? '▼' : '▶' }}</span>
              </button>
              @if (openProfile && isStepUnlocked(1)) {
                <div class="mm-step-reveal space-y-4 border-t border-slate-200 p-4">
                  <div>
                    <span class="mb-2 flex items-center gap-1 text-sm font-medium text-slate-700">
                      Compra ou venda
                      <button
                        type="button"
                        class="mm-help-btn"
                        [attr.title]="helpSide"
                        aria-label="Ajuda: compra versus venda"
                        (click)="$event.preventDefault()"
                      >
                        ?
                      </button>
                    </span>
                    <div class="flex flex-wrap items-center gap-2 md:gap-3">
                      <button
                        type="button"
                        (click)="setTransactionSide('buy')"
                        [class]="selectionCardClass(transactionSide !== null && transactionSide === 'buy')"
                      >
                        <span class="text-lg leading-none">🛒</span>
                        <p class="leading-tight">Compra</p>
                      </button>
                      <button
                        type="button"
                        (click)="setTransactionSide('sell')"
                        [class]="selectionCardClass(transactionSide !== null && transactionSide === 'sell')"
                      >
                        <span class="text-lg leading-none">🏷️</span>
                        <p class="leading-tight">Venda</p>
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- Sessao 2: Negociacao -->
            <div
              class="overflow-hidden rounded-md border border-slate-200 bg-white transition-all duration-300 ease-out"
              [class.opacity-60]="!isStepUnlocked(2)"
              [class.mm-step-flash]="flashStep === 2"
            >
              <button
                type="button"
                class="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                (click)="toggleSection('negotiation')"
                [disabled]="!isStepUnlocked(2)"
              >
                <span class="mm-step-badge">2</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-xs font-semibold uppercase tracking-wide text-blue-800">Passo 2</span>
                  <span class="flex items-center gap-1 font-semibold text-slate-800">
                    Dados da negociacao
                    <button
                      type="button"
                      class="mm-help-btn"
                      [attr.title]="helpStep2Negotiation"
                      aria-label="Ajuda: dados da negociacao"
                      (click)="stopAccordionToggle($event)"
                    >
                      ?
                    </button>
                  </span>
                </span>
                <span class="text-slate-400" aria-hidden="true">{{ openNegotiation ? '▼' : '▶' }}</span>
              </button>
              @if (openNegotiation && isStepUnlocked(2)) {
                <div class="mm-step-reveal space-y-4 border-t border-slate-200 p-4">
                  <div class="grid gap-4 md:grid-cols-2">
                    <label class="block">
                      <span class="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
                        Titulo
                        <button
                          type="button"
                          class="mm-help-btn"
                          [attr.title]="helpFieldTitle"
                          aria-label="Ajuda: titulo"
                          (click)="$event.preventDefault()"
                        >
                          ?
                        </button>
                      </span>
                      <input
                        formControlName="title"
                        type="text"
                        placeholder="Ex.: iPhone 14 Pro, Licença Adobe..."
                        class="input-flat"
                        [class.input-error]="ticketForm.controls.title.touched && ticketForm.controls.title.invalid"
                      />
                      @if (ticketForm.controls.title.touched && ticketForm.controls.title.invalid) {
                        <p class="mt-1 text-xs text-red-600">{{ ticketErr('title') }}</p>
                      }
                    </label>
                  </div>
                  <div class="grid gap-4 md:grid-cols-3 md:items-center">
                    <label class="block">
                      <span class="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
                        Valor
                        <button
                          type="button"
                          class="mm-help-btn"
                          [attr.title]="helpFieldAmount"
                          aria-label="Ajuda: valor"
                          (click)="$event.preventDefault()"
                        >
                          ?
                        </button>
                      </span>
                      <input
                        formControlName="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        class="input-flat"
                        [class.input-error]="ticketForm.controls.amount.touched && ticketForm.controls.amount.invalid"
                      />
                      @if (ticketForm.controls.amount.touched && ticketForm.controls.amount.invalid) {
                        <p class="mt-1 text-xs text-red-600">{{ ticketErr('amount') }}</p>
                      }
                    </label>
                    <label class="block md:col-span-1">
                      <span class="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
                        Moeda
                        <button
                          type="button"
                          class="mm-help-btn"
                          [attr.title]="helpFieldCurrency"
                          aria-label="Ajuda: moeda"
                          (click)="$event.preventDefault()"
                        >
                          ?
                        </button>
                      </span>
                      <select formControlName="currency" class="input-flat">
                        <option value="BRL">BRL</option>
                        <option value="USD">USD</option>
                      </select>
                    </label>
                  </div>
                  <div>
                    <span class="mb-2 flex items-center gap-1 text-sm font-medium text-slate-700">
                      Tipo da transacao
                      <button
                        type="button"
                        class="mm-help-btn"
                        [attr.title]="helpTransactionType"
                        aria-label="Ajuda: tipo fisico ou digital"
                        (click)="$event.preventDefault()"
                      >
                        ?
                      </button>
                    </span>
                    <div class="flex flex-wrap items-center gap-2 md:gap-3">
                      <button
                        type="button"
                        (click)="setTransactionType('physical')"
                        [class]="selectionCardClass(transactionType !== null && transactionType === 'physical')"
                      >
                        <span class="text-lg leading-none">📦</span>
                        <p class="leading-tight">Fisico</p>
                      </button>
                      <button
                        type="button"
                        (click)="setTransactionType('digital')"
                        [class]="selectionCardClass(transactionType !== null && transactionType === 'digital')"
                      >
                        <span class="text-lg leading-none">💻</span>
                        <p class="leading-tight">Digital</p>
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- Sessao 3: Condicoes + resumo + acoes (unico passo final) -->
            <div
              class="overflow-hidden rounded-md border border-slate-200 bg-white transition-all duration-300 ease-out"
              [class.opacity-60]="!isStepUnlocked(3)"
              [class.mm-step-flash]="flashStep === 3"
            >
              <button
                type="button"
                class="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                (click)="toggleSection('finalize')"
                [disabled]="!isStepUnlocked(3)"
              >
                <span class="mm-step-badge">3</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-xs font-semibold uppercase tracking-wide text-blue-800">Passo 3</span>
                  <span class="flex items-center gap-1 font-semibold text-slate-800">
                    Regras e finalizar
                    <button
                      type="button"
                      class="mm-help-btn"
                      [attr.title]="helpStep3"
                      aria-label="Ajuda: ultimo passo"
                      (click)="stopAccordionToggle($event)"
                    >
                      ?
                    </button>
                  </span>
                </span>
                <span class="text-slate-400" aria-hidden="true">{{ openFinalize ? '▼' : '▶' }}</span>
              </button>
              @if (openFinalize && isStepUnlocked(3)) {
                <div class="mm-step-reveal space-y-4 border-t border-slate-200 p-4">
                  @if (transactionType === 'digital') {
                    <div class="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div class="flex items-start gap-2">
                        <p class="min-w-0 flex-1 leading-snug">
                          <strong>Digital:</strong> contestacao em
                          <strong> {{ platformDisputeWindowHours }} h</strong>, fixo pela plataforma (nao editavel).
                          <span class="text-slate-500">Custodia com registro de entrega.</span>
                        </p>
                        <button
                          type="button"
                          class="mm-help-btn shrink-0"
                          [attr.aria-expanded]="showDisputeLegal"
                          aria-label="Detalhes sobre prazo legal"
                          (click)="toggleDisputeLegal($event)"
                        >
                          ?
                        </button>
                      </div>
                      @if (showDisputeLegal) {
                        <p class="mt-2 border-t border-slate-200 pt-2 text-[11px] leading-snug text-slate-500">
                          Prazo alinhado a legislacao e regras de pagamento. Ha tambem prazos legais complementares
                          (consumidor, administradora etc.) fora deste fluxo. Consulte termos e suporte.
                        </p>
                      }
                    </div>
                  }
                  @if (transactionType === 'physical') {
                    <div class="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      <p class="min-w-0 flex-1 leading-snug">
                        <strong>Fisico:</strong> entrega ja combinada fora da plataforma. Liberacao possivel com QR no encontro.
                      </p>
                      <button
                        type="button"
                        class="mm-help-btn shrink-0"
                        [attr.title]="helpPhysicalQr"
                        aria-label="Ajuda: QR e encontro"
                        (click)="$event.preventDefault()"
                      >
                        ?
                      </button>
                    </div>
                  }

                  <div class="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
                    <div class="flex items-center gap-1 border-b border-slate-100 pb-2 text-xs font-semibold text-slate-500">
                      Resumo
                      <button
                        type="button"
                        class="mm-help-btn"
                        [attr.title]="helpSummary"
                        aria-label="Ajuda: resumo"
                        (click)="$event.preventDefault()"
                      >
                        ?
                      </button>
                    </div>
                    <p class="mt-2"><strong>Tipo:</strong> {{ transactionTypeLabel() }}</p>
                    <p><strong>Operacao:</strong> {{ transactionSideLabel() }}</p>
                    @if (transactionType === 'digital') {
                      <p class="mt-1 text-xs text-slate-500">Contestacao: {{ platformDisputeWindowHours }} h</p>
                    }
                    <p class="mt-1 text-xs text-slate-500">Taxas exibidas ao pagar na custodia.</p>
                    <p class="mt-2 text-xs text-slate-500">Apos criar o ticket, voce envia o convite na tela da transacao.</p>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button type="button" (click)="saveTransaction()" class="neon-button">Criar ticket</button>
                  </div>
                </div>
              }
            </div>
          </form>
        </article>
      }
    </section>
  `,
})
export class CreateTransactionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  /** `true` em desenvolvimento; em producao os campos nao recebem mock automatico. */
  readonly devMode = isDevMode();

  /** Textos de ajuda (tooltip nativo via title / aria-label). */
  readonly helpIntroPage =
    'Entrega e detalhes costumam estar acordados fora daqui. Primeiro seu papel (compra ou venda), depois titulo, valor e tipo do bem.';
  readonly helpFlow =
    'Passo 1: papel na custodia. Passo 2: dados e tipo (fisico/digital). Passo 3: regras e criar ticket; envio do convite na tela da transacao.';
  readonly helpStep1Profile =
    'Compra: voce paga e recebe apos validacao. Venda: voce entrega e recebe o pagamento apos a contraparte confirmar.';
  readonly helpStep2Negotiation =
    'Titulo do bem ou servico, valor total, moeda. Depois Fisico (item material) ou Digital (arquivo, licenca, acesso).';
  readonly helpStep3 =
    'Leia a regra do tipo, confira o resumo e clique em Criar ticket. Depois, na tela da transacao, envie o link a quem participa da negociacao.';
  readonly helpFieldTitle =
    'Nome objetivo do que esta sendo negociado. Entre 3 e 200 caracteres. Evite expor dados pessoais sem necessidade.';
  readonly helpFieldAmount = 'Valor total negociado (minimo 0,01). Moeda escolhida no campo ao lado.';
  readonly helpFieldCurrency = 'BRL ou USD — moeda usada no pagamento em custodia.';
  readonly helpTransactionType =
    'Fisico: produto com envio ou retirada. Digital: licenca, software, curso, conta, arquivo para download, etc.';
  readonly helpSide = 'Defina o seu lado nesta custodia: quem compra o bem/servico ou quem vende.';
  readonly helpPhysicalQr =
    'Local e prazo da entrega seguem o que ja foi combinado. O QR pode ser usado no encontro para liberacao com acordo das duas partes.';
  readonly helpSummary =
    'Ultima conferencia: tipo, seu papel, prazo de contestacao (se digital). Taxas ao pagar. Entrega conforme acordo externo.';

  /** Detalhe legal longo do prazo digital: alterna com o botao ? */
  showDisputeLegal = false;

  formStarted = false;
  /** 1–3: perfil, negociacao, condicoes + resumo + acoes */
  unlockedStep = 1;
  openProfile = true;
  openNegotiation = false;
  openFinalize = false;

  /** Destaque suave no cartao do passo que acaba de ser liberado (some sozinho). */
  flashStep = 0;

  readonly ticketForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    amount: [null as number | null, [Validators.required, minAmount(0.01), Validators.max(999999999.99)]],
    currency: ['BRL', [Validators.required, Validators.pattern(/^(BRL|USD)$/)]],
  });

  transactionType: TransactionType | null = null;
  transactionSide: TransactionSide | null = null;
  securityWindowHours: number | null = null;

  readonly platformDisputeWindowHours = PLATFORM_DISPUTE_WINDOW_HOURS;

  ticketErr(field: 'title' | 'amount'): string {
    return controlErrorMessage(this.ticketForm.get(field), { min: 0.01, max: 999999999.99 });
  }

  startTicket(): void {
    this.formStarted = true;
    this.unlockedStep = 1;
    this.openProfile = true;
    this.openNegotiation = false;
    this.openFinalize = false;
    this.flashStep = 0;
    this.showDisputeLegal = false;
    this.ticketForm.reset({
      title: '',
      amount: null,
      currency: 'BRL',
    });
    if (this.devMode) {
      this.ticketForm.patchValue(MOCK_TICKET_FORM);
    }
    this.transactionType = null;
    this.transactionSide = null;
    this.securityWindowHours = null;
    this.toastService.show(
      'Fluxo iniciado',
      this.devMode
        ? 'Dados mock aplicados nos campos de texto (apenas em desenvolvimento).'
        : 'Preencha os dados para abrir o ticket da transacao.',
      'info',
    );
  }

  applyMockTicketForm(): void {
    if (!this.devMode) return;
    this.ticketForm.patchValue(MOCK_TICKET_FORM);
    this.toastService.show('Mock aplicado', 'Campos de titulo e valor atualizados para teste.', 'info');
  }

  stopAccordionToggle(ev: Event): void {
    ev.stopPropagation();
  }

  toggleDisputeLegal(ev: Event): void {
    ev.stopPropagation();
    this.showDisputeLegal = !this.showDisputeLegal;
  }

  private pulseFlash(step: number): void {
    this.flashStep = step;
    window.setTimeout(() => {
      this.flashStep = 0;
    }, 700);
  }

  private validateSelections(): boolean {
    if (this.transactionSide === null) {
      this.toastService.show('Perfil obrigatorio', 'Indique se voce e comprador ou vendedor.', 'warning');
      this.openProfile = true;
      return false;
    }
    if (this.transactionType === null) {
      this.toastService.show('Tipo obrigatorio', 'Selecione produto fisico ou digital.', 'warning');
      this.openNegotiation = true;
      return false;
    }
    if (this.unlockedStep < 3) {
      this.toastService.show(
        'Fluxo incompleto',
        'Confirme o tipo (fisico/digital) apos alterar o papel, se necessario.',
        'warning',
      );
      this.openNegotiation = true;
      return false;
    }
    return true;
  }

  private validateTicketForm(): boolean {
    this.ticketForm.patchValue(
      {
        title: normalizeFreeText(this.ticketForm.controls.title.value ?? ''),
      },
      { emitEvent: false },
    );
    this.ticketForm.markAllAsTouched();
    if (this.ticketForm.invalid) {
      this.toastService.show(
        'Formulario incompleto',
        'Corrija os campos em vermelho antes de continuar.',
        'warning',
      );
      this.openInvalidSections();
      return false;
    }
    return true;
  }

  private openInvalidSections(): void {
    const { title, amount } = this.ticketForm.controls;
    if (title.invalid || amount.invalid) {
      this.openNegotiation = true;
    }
    this.openFinalize = this.unlockedStep >= 3;
  }

  private sanitizeTicketPayload(): { title: string; currency: string; amount: number } {
    const raw = this.ticketForm.getRawValue();
    return {
      title: normalizeFreeText(raw.title ?? ''),
      currency: raw.currency ?? 'BRL',
      amount: Number(raw.amount),
    };
  }

  isStepUnlocked(step: number): boolean {
    return this.unlockedStep >= step;
  }

  toggleSection(id: 'negotiation' | 'profile' | 'finalize'): void {
    const step: Record<typeof id, number> = {
      profile: 1,
      negotiation: 2,
      finalize: 3,
    };
    if (!this.isStepUnlocked(step[id])) return;
    switch (id) {
      case 'negotiation':
        this.openNegotiation = !this.openNegotiation;
        break;
      case 'profile':
        this.openProfile = !this.openProfile;
        break;
      case 'finalize':
        this.openFinalize = !this.openFinalize;
        break;
    }
  }

  setTransactionType(type: TransactionType): void {
    const prev = this.transactionType;
    if (prev !== type) {
      this.showDisputeLegal = false;
      if (this.unlockedStep > 2) {
        this.unlockedStep = 2;
        this.openFinalize = false;
        this.openNegotiation = true;
      }
    }
    this.transactionType = type;
    if (type === 'digital') {
      this.securityWindowHours = PLATFORM_DISPUTE_WINDOW_HOURS;
    } else {
      this.securityWindowHours = null;
    }
    this.unlockedStep = Math.max(this.unlockedStep, 3);
    this.openFinalize = true;
    this.openNegotiation = false;
    this.pulseFlash(3);
  }

  setTransactionSide(side: TransactionSide): void {
    const prev = this.transactionSide;
    if (prev !== null && prev !== side && this.unlockedStep > 2) {
      this.unlockedStep = 2;
      this.openFinalize = false;
      this.openNegotiation = true;
    }
    this.transactionSide = side;
    this.unlockedStep = Math.max(this.unlockedStep, 2);
    this.openNegotiation = true;
    this.openProfile = false;
    this.pulseFlash(2);
  }

  selectionCardClass(active: boolean): string {
    const base =
      'flex size-[5.25rem] flex-none flex-col items-center justify-center gap-0.5 rounded-md border p-1.5 text-center text-[11px] font-semibold leading-tight transition sm:size-24 sm:text-xs';
    return active
      ? `${base} border-blue-700 bg-blue-50 shadow-sm`
      : `${base} border-slate-300 bg-white hover:border-blue-300`;
  }

  transactionTypeLabel(): string {
    if (this.transactionType === null) return 'A definir';
    return this.transactionType === 'physical' ? 'Produto fisico' : 'Produto digital / servico';
  }

  transactionSideLabel(): string {
    if (this.transactionSide === null) return 'A definir';
    return this.transactionSide === 'buy' ? 'Compra protegida' : 'Venda protegida';
  }

  saveTransaction(): void {
    if (!this.validateTicketForm()) return;
    if (!this.validateSelections()) return;
    void this.sanitizeTicketPayload();
    const transactionId = `TRX-${Date.now().toString().slice(-6)}`;
    this.toastService.show(
      'Ticket criado',
      `Use a secao Convidar na proxima tela para enviar o link a quem participa da negociacao.`,
      'success',
    );
    const type = this.transactionType!;
    const side = this.transactionSide!;
    void this.router.navigate(['/transaction', transactionId], {
      queryParams: {
        type,
        side,
        ...(type === 'digital' ? { window: PLATFORM_DISPUTE_WINDOW_HOURS } : {}),
      },
    });
  }
}

import { NgClass } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../../core/services/toast.service';
import { clampText } from '../../../../core/utils/sanitize';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import {
  DeliveryMethod,
  PLATFORM_DISPUTE_WINDOW_HOURS,
  TransactionSide,
  TransactionStatus,
  TransactionType,
} from '../../../../core/models/transaction.model';

type FlowStep =
  | 'ticket_created'
  | 'ticket_confirmed'
  | 'payment_escrow'
  | 'delivery'
  | 'delivery_confirmed'
  | 'released';

const FLOW_STEPS_DEF: { id: FlowStep }[] = [
  { id: 'ticket_created' },
  { id: 'ticket_confirmed' },
  { id: 'payment_escrow' },
  { id: 'delivery' },
  { id: 'delivery_confirmed' },
  { id: 'released' },
];

/** Rotulos curtos para a linha do tempo dentro do chat (visivel para ambos). */
const STEP_SHORT_LABELS: string[] = ['Convite', 'Dados', 'Custodia', 'Entrega', '2 lados', 'Feito'];

type EscrowPaymentMethodId = 'pix' | 'credit_card' | 'debit_card' | 'boleto' | 'wallet';

const ESCROW_PAYMENT_OPTIONS: { id: EscrowPaymentMethodId; label: string; hint: string; emoji: string }[] = [
  { id: 'pix', label: 'PIX', hint: 'QR dinamico / copia e cola', emoji: 'PIX' },
  { id: 'credit_card', label: 'Cartao credito', hint: 'Parcelado no app', emoji: 'CR' },
  { id: 'debit_card', label: 'Cartao debito', hint: 'Debito em conta', emoji: 'DB' },
  { id: 'boleto', label: 'Boleto', hint: 'Compensacao em dias uteis', emoji: 'B' },
  { id: 'wallet', label: 'Carteira digital', hint: 'PicPay, Mercado Pago, etc.', emoji: 'W' },
];

/** Snapshot local (sessionStorage) para nao perder o fluxo ao voltar da disputa ou recarregar na mesma sessao. */
interface MmTxDetailPersistedV1 {
  v: 1;
  flowStep: FlowStep;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  selectedEscrowPayment: EscrowPaymentMethodId | null;
  paymentQrDataUrl: string;
  inviteQrDataUrl: string;
  showInviteQrPanel: boolean;
  deliveryQrToken: string;
  digitalEvidenceCategory: 'print' | 'ownership' | 'other';
  chatMessages: Array<{ id: number; sender: 'buyer' | 'seller' | 'chatbot'; text: string; time: string }>;
  evidences: Array<{ id: number; title: string; type: string; date: string }>;
  flowDetailsOpen: boolean;
}

@Component({
  selector: 'app-transaction-detail',
  imports: [NgClass, ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section
      class="mx-auto flex w-full max-w-6xl min-h-0 flex-col gap-4 px-2 pb-6 pt-2 lg:flex-row lg:items-start lg:gap-8"
    >
      <div class="flex min-w-0 flex-1 flex-col lg:max-w-xl">
      <div class="mb-2 flex items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
        <span class="truncate font-mono text-slate-600">#{{ transactionId }}</span>
        <app-status-badge [status]="currentStatus" />
        <div class="flex shrink-0 gap-1">
          <button type="button" class="rounded-md px-2 py-0.5 hover:bg-slate-200/70" (click)="cancelTransaction()">Sair</button>
          <a routerLink="/transaction/create" class="rounded-md px-2 py-0.5 no-underline hover:bg-slate-200/70">Nova</a>
        </div>
      </div>

      <div
        class="flex min-h-[min(78vh,36rem)] flex-1 flex-col overflow-hidden rounded-2xl border shadow-lg shadow-slate-400/15 sm:min-h-[min(82vh,40rem)]"
        [ngClass]="isFlowLocked() ? 'border-emerald-300/50 ring-1 ring-emerald-200/60' : 'border-slate-300/50'"
        style="background-color: #e9edef"
      >
        <header class="flex shrink-0 items-center gap-2.5 border-b border-black/6 bg-[#f0f2f5] px-3 py-2.5">
          <div
            class="grid h-10 w-10 shrink-0 place-content-center rounded-full bg-gradient-to-br from-indigo-600 to-teal-500 text-xs font-bold text-white shadow-sm"
          >M</div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h1 class="truncate text-[15px] font-semibold leading-tight text-slate-900">Custodia</h1>
              @if (isFlowLocked()) {
                <span class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800">Concluida</span>
              }
            </div>
            <p class="truncate text-[11px] text-slate-500">
              {{ sideLabel() }} · {{ typeLabel() }} · {{ transactionStatusLabel() }}
              @if (isFlowLocked()) {
                <span class="text-slate-400"> · leitura apenas</span>
              }
            </p>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-slate-500 hover:bg-black/5"
            (click)="toggleFlowDetailsPanel()"
            [attr.aria-expanded]="flowDetailsOpen"
            aria-label="Ver progresso e confirmacoes"
          >
            <span class="text-base leading-none">{{ flowDetailsOpen ? '▴' : 'ⓘ' }}</span>
          </button>
        </header>

        <div class="h-0.5 w-full shrink-0 bg-black/10">
          <div
            class="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-teal-500 transition-all duration-300"
            [style.width.%]="guideProgressPercent()"
          ></div>
        </div>

        @if (flowDetailsOpen) {
          <div
            class="max-h-40 shrink-0 space-y-2 overflow-y-auto border-b border-black/6 bg-white/90 px-3 py-2 backdrop-blur-sm"
            role="region"
            aria-label="Detalhes do fluxo"
          >
            <p class="text-[11px] leading-snug text-slate-600">{{ guideLine() }}</p>
            <div class="flex flex-wrap justify-center gap-1">
              @for (label of stepShortLabels; track $index) {
                <span
                  class="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                  [class.bg-blue-100]="stepVisualState($index) === 'current'"
                  [class.text-blue-800]="stepVisualState($index) === 'current'"
                  [class.text-slate-400]="stepVisualState($index) === 'upcoming'"
                  [class.text-slate-600]="stepVisualState($index) === 'done'"
                >{{ $index + 1 }} {{ label }}</span>
              }
            </div>
            <div class="flex gap-2 text-[10px]">
              <span class="flex-1 truncate rounded-md bg-slate-50 px-2 py-1 text-center text-slate-700">{{ mutualBuyerCompact() }}</span>
              <span class="flex-1 truncate rounded-md bg-slate-50 px-2 py-1 text-center text-slate-700">{{ mutualSellerCompact() }}</span>
            </div>
          </div>
        }

        <div class="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-3">
            @for (message of chatMessages; track message.id) {
              @if (message.sender === 'chatbot') {
                <div class="flex justify-start px-0.5">
                  <div class="max-w-[min(92%,24rem)] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm ring-1 ring-black/[0.04]">
                    <p class="text-[13px] leading-snug text-slate-800">{{ message.text }}</p>
                    <p class="mt-1 text-right text-[10px] tabular-nums text-slate-400">{{ message.time }}</p>
                  </div>
                </div>
              } @else if (isMyMessage(message)) {
                <div class="flex justify-end px-0.5">
                  <div
                    class="max-w-[min(88%,24rem)] rounded-2xl rounded-tr-sm bg-gradient-to-br from-sky-500 to-indigo-600 px-3 py-2 shadow-sm"
                  >
                    <p class="text-[13px] leading-snug text-white">{{ message.text }}</p>
                    <p class="mt-0.5 text-right text-[10px] tabular-nums text-sky-100">{{ message.time }}</p>
                  </div>
                </div>
              } @else {
                <div class="flex justify-start px-0.5">
                  <div class="max-w-[min(88%,24rem)] rounded-2xl rounded-tl-sm border border-slate-200/90 bg-white px-3 py-2 shadow-sm">
                    <p class="text-[13px] leading-snug text-slate-800">{{ message.text }}</p>
                    <p class="mt-0.5 text-[10px] tabular-nums text-slate-400">{{ message.time }}</p>
                  </div>
                </div>
              }
            }

            @switch (flowStep) {
              @case ('ticket_created') {
                <div class="flex justify-start px-0.5">
                  <div class="max-w-[min(92%,22rem)] space-y-2.5 rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/[0.05]">
                    <p class="text-sm leading-snug text-slate-800">
                      <span class="font-semibold text-blue-800">Agora:</span>
                      mande o convite para a outra pessoa entrar nesta mesma tela.
                    </p>
                    <p class="text-xs text-slate-500">
                      Escolha um jeito rapido. O convite abre para a outra parte como
                      {{ transactionSide === 'sell' ? 'comprador' : 'vendedor' }}
                      (papel oposto ao seu nesta pagina).
                    </p>
                    <div class="flex flex-wrap gap-1.5">
                      <button type="button" class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs hover:bg-white" (click)="shareInviteWhatsApp()">WhatsApp</button>
                      <button type="button" class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs hover:bg-white" (click)="shareInviteEmail()">E-mail</button>
                      <button type="button" class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs hover:bg-white" (click)="toggleInviteQrPanel()">QR code</button>
                    </div>
                    @if (showInviteQrPanel) {
                      <div class="flex gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                        @if (inviteQrDataUrl) {
                          <img [src]="inviteQrDataUrl" alt="QR do convite" class="size-16 shrink-0 rounded border border-white bg-white p-0.5" width="64" height="64" />
                        } @else {
                          <span class="size-16 shrink-0 animate-pulse rounded bg-slate-200" aria-hidden="true"></span>
                        }
                        <p class="text-[11px] leading-relaxed text-slate-500">QR gerado nesta pagina. A outra parte escaneia para abrir o convite.</p>
                      </div>
                    }
                    <button type="button" class="mm-btn-block" (click)="confirmTicketCreated()">
                      Ja enviei — continuar
                    </button>
                  </div>
                </div>
              }

              @case ('ticket_confirmed') {
                <div class="flex justify-start px-0.5">
                  <div class="max-w-[min(92%,22rem)] space-y-2.5 rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/[0.05]">
                    <p class="text-sm leading-snug text-slate-800">
                      <span class="font-semibold text-blue-800">Agora:</span>
                      veja se o combinado bate com o que voces fecharam (tipo, entrega, seu papel).
                    </p>
                    <div class="grid grid-cols-2 gap-1.5 text-xs">
                      <div class="rounded-lg bg-slate-50 px-2 py-1.5"><span class="text-slate-500">Tipo</span><br /><span class="font-medium text-slate-800">{{ typeLabel() }}</span></div>
                      <div class="rounded-lg bg-slate-50 px-2 py-1.5"><span class="text-slate-500">Entrega</span><br /><span class="font-medium text-slate-800">{{ deliveryLabel() }}</span></div>
                      <div class="rounded-lg bg-slate-50 px-2 py-1.5"><span class="text-slate-500">Voce</span><br /><span class="font-medium text-slate-800">{{ sideLabel() }}</span></div>
                      @if (transactionType === 'digital') {
                        <div class="rounded-lg bg-slate-50 px-2 py-1.5"><span class="text-slate-500">Prazo contestacao</span><br /><span class="font-medium text-slate-800">{{ securityWindowHours }}h</span></div>
                      }
                    </div>
                    <button type="button" class="mm-btn-block" (click)="confirmTicketDetails()">
                      Esta certo para mim — proximo
                    </button>
                  </div>
                </div>
              }

              @case ('payment_escrow') {
                <div class="flex justify-start px-0.5">
                  <div class="max-w-[min(92%,24rem)] space-y-2.5 rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/[0.05]">
                    <p class="text-sm leading-snug text-slate-800">
                      <span class="font-semibold text-blue-800">Agora:</span>
                      pagamento em
                      <span class="font-semibold">custodia</span>
                      via QR gerado
                      <span class="font-semibold">neste chat</span>
                      . So o
                      <span class="font-semibold">comprador</span>
                      escolhe a forma de pagamento e gera o codigo.
                    </p>

                    @if (transactionSide === 'buy') {
                      <p class="text-[11px] font-medium text-slate-700">Como voce vai pagar?</p>
                      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        @for (opt of escrowPaymentOptions; track opt.id) {
                          <button
                            type="button"
                            (click)="selectEscrowPaymentMethod(opt.id)"
                            class="rounded-lg border px-2 py-2 text-left text-[11px] font-semibold transition"
                            [class.border-blue-600]="selectedEscrowPayment === opt.id"
                            [class.bg-blue-50]="selectedEscrowPayment === opt.id"
                            [class.shadow-sm]="selectedEscrowPayment === opt.id"
                            [class.border-slate-200]="selectedEscrowPayment !== opt.id"
                            [class.bg-slate-50]="selectedEscrowPayment !== opt.id"
                          >
                            <span class="text-sm">{{ opt.emoji }}</span>
                            <span class="mt-0.5 block leading-tight text-slate-900">{{ opt.label }}</span>
                            <span class="mt-0.5 block font-normal leading-tight text-slate-500">{{ opt.hint }}</span>
                          </button>
                        }
                      </div>
                      @if (selectedEscrowPayment) {
                        <button
                          type="button"
                          class="mm-btn-soft border-slate-300 bg-gradient-to-r from-slate-50 to-blue-50 font-semibold text-slate-900 disabled:opacity-60"
                          [disabled]="paymentQrGenerating"
                          (click)="generateEscrowPaymentQr()"
                        >
                          {{ paymentQrGenerating ? 'Gerando QR…' : 'Gerar QR de pagamento no chat' }}
                        </button>
                      }
                      @if (paymentQrDataUrl) {
                        <button type="button" class="mm-btn-block" (click)="confirmPaymentEscrow()">
                          Ja paguei — confirmar custodia
                        </button>
                      }
                    } @else {
                      <p class="text-xs text-slate-600">
                        Voce e o
                        <span class="font-semibold">vendedor</span>
                        : aguarde o comprador escolher a forma de pagamento. O QR aparecera aqui para as duas partes acompanharem.
                      </p>
                    }

                    @if (paymentQrDataUrl) {
                      <div class="rounded-xl bg-slate-50/90 p-2.5 ring-1 ring-slate-200/80">
                        <p class="text-center text-[10px] font-medium text-slate-600">{{ escrowPaymentMethodLabel() }}</p>
                        <img [src]="paymentQrDataUrl" alt="QR de pagamento em custodia" class="mx-auto mt-1.5 size-40 rounded-lg bg-white p-1 shadow-sm" width="160" height="160" />
                        <p class="mt-1.5 line-clamp-2 break-all font-mono text-[9px] text-slate-400">{{ paymentPayloadPreview() }}</p>
                      </div>
                    }
                  </div>
                </div>
              }

              @case ('delivery') {
                <div class="flex justify-start px-0.5">
                  <div class="max-w-[min(92%,24rem)] space-y-2.5 rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/[0.05]">
                    <p class="text-sm leading-snug text-slate-800">
                      <span class="font-semibold text-blue-800">Agora:</span>
                      {{ transactionType === 'digital' ? 'registre que entregou o acesso digital, depois confirme.' : 'Gere o QR de liberacao; quando a outra parte confirmar a leitura, avance para a confirmacao dos dois.' }}
                    </p>

                    @if (transactionType === 'digital') {
                      <p class="text-xs text-slate-500">Dica: escolha o tipo de prova, descreva em uma linha e salve. Depois clique em "Tudo entregue".</p>
                      <p class="text-[11px] font-medium text-slate-700">Que tipo de registro?</p>
                      <div class="flex flex-wrap gap-2">
                        <button type="button" (click)="setEvidenceCategory('print')" [disabled]="isFlowLocked()" [class]="evidenceCategoryCardClass('print')">
                          <span class="text-base leading-none">📷</span>
                          <p class="leading-tight">Print</p>
                          <p class="line-clamp-1 font-normal text-slate-500">Tela ou log</p>
                        </button>
                        <button type="button" (click)="setEvidenceCategory('ownership')" [disabled]="isFlowLocked()" [class]="evidenceCategoryCardClass('ownership')">
                          <span class="text-base leading-none">🔑</span>
                          <p class="leading-tight">Conta</p>
                          <p class="line-clamp-1 font-normal text-slate-500">Titular</p>
                        </button>
                        <button type="button" (click)="setEvidenceCategory('other')" [disabled]="isFlowLocked()" [class]="evidenceCategoryCardClass('other')">
                          <span class="text-base leading-none">📎</span>
                          <p class="leading-tight">Outro</p>
                          <p class="line-clamp-1 font-normal text-slate-500">Observacao</p>
                        </button>
                      </div>
                      <input type="text" placeholder="Ex.: print da tela de ativacao..." class="input-flat text-sm" [formControl]="evidenceControl" [class.input-error]="evidenceControl.touched && evidenceControl.invalid && evidenceControl.enabled" />
                      @if (evidenceControl.touched && evidenceControl.invalid && evidenceControl.enabled) {
                        <p class="text-xs text-red-600">Escreva pelo menos 4 caracteres.</p>
                      }
                      @if (evidences.length > 0) {
                        <ul class="max-h-24 space-y-1 overflow-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs">
                          @for (item of evidences; track item.id) {
                            <li><span class="font-medium">{{ item.title }}</span></li>
                          }
                        </ul>
                      }
                      <div class="flex flex-wrap gap-2">
                        <button type="button" [disabled]="isFlowLocked()" (click)="addDigitalEvidence()" [class]="actionCardClass(!isFlowLocked())">
                          <span class="text-base leading-none">🧾</span>
                          <p class="leading-tight">Salvar registro</p>
                        </button>
                        <button type="button" [disabled]="isFlowLocked()" (click)="confirmDigitalAccess()" [class]="primaryReleaseCardClass()">
                          <span class="text-base leading-none">✓</span>
                          <p class="leading-tight">Tudo entregue</p>
                        </button>
                      </div>
                    }

                    @if (transactionType === 'physical') {
                      <div class="flex flex-wrap gap-2">
                        <button type="button" [disabled]="isFlowLocked()" (click)="generateDeliveryQr()" [class]="actionCardClass(!isFlowLocked())">
                          <span class="text-base leading-none">📱</span>
                          <p class="leading-tight">Gerar QR</p>
                        </button>
                      </div>
                      @if (deliveryQrToken) {
                        <div class="space-y-2 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 text-xs">
                          <p class="text-slate-600">Codigo para liberacao — a outra parte usa no aparelho:</p>
                          <p class="font-mono text-sm text-slate-900">{{ deliveryQrToken }}</p>
                          <button
                            type="button"
                            [disabled]="isFlowLocked()"
                            (click)="simulateQrScan()"
                            class="mm-btn-soft disabled:cursor-not-allowed"
                          >
                            Simular: leitura do QR confirmada
                          </button>
                        </div>
                      }
                    }
                  </div>
                </div>
              }

              @case ('delivery_confirmed') {
                <div class="flex justify-start px-0.5">
                  <div class="max-w-[min(92%,22rem)] space-y-2.5 rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/[0.05]">
                    <p class="text-sm leading-snug text-slate-800">
                      <span class="font-semibold text-blue-800">Agora:</span>
                      voce esta como
                      <span class="font-semibold">{{ sideLabelLower() }}</span>.
                      Confirme so o seu lado; a outra parte confirma na sessao dela (com o convite).
                      Quando os dois tiverem confirmado, o valor segue para o vendedor.
                    </p>
                    @if (transactionSide === 'buy') {
                      <button
                        type="button"
                        [disabled]="isFlowLocked() || buyerConfirmed"
                        (click)="confirmByBuyer()"
                        class="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                        [class.border-green-400]="buyerConfirmed"
                        [class.bg-green-50]="buyerConfirmed"
                        [class.text-green-900]="buyerConfirmed"
                        [class.border-blue-300]="!buyerConfirmed"
                        [class.bg-blue-50]="!buyerConfirmed"
                        [class.text-slate-900]="!buyerConfirmed"
                      >
                        @if (buyerConfirmed) {
                          <span>Confirmado como comprador</span>
                        } @else {
                          <span>Confirmo como comprador</span>
                        }
                      </button>
                    }
                    @if (transactionSide === 'sell') {
                      <button
                        type="button"
                        [disabled]="isFlowLocked() || sellerConfirmed"
                        (click)="confirmBySeller()"
                        class="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                        [class.border-green-400]="sellerConfirmed"
                        [class.bg-green-50]="sellerConfirmed"
                        [class.text-green-900]="sellerConfirmed"
                        [class.border-blue-300]="!sellerConfirmed"
                        [class.bg-blue-50]="!sellerConfirmed"
                        [class.text-slate-900]="!sellerConfirmed"
                      >
                        @if (sellerConfirmed) {
                          <span>Confirmado como vendedor</span>
                        } @else {
                          <span>Confirmo como vendedor</span>
                        }
                      </button>
                    }
                    <a
                      [routerLink]="['/dispute', transactionId]"
                      [queryParams]="transactionQueryParamsForRouter()"
                      class="flex w-full items-center justify-center rounded-md border border-red-300 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-800 no-underline hover:border-red-400 hover:bg-red-100"
                    >Algo errado? Abrir disputa</a>
                  </div>
                </div>
              }

              @case ('released') {
                <div class="flex justify-start px-0.5">
                  <div class="max-w-[min(92%,22rem)] rounded-2xl rounded-tl-sm bg-emerald-50/90 px-3 py-3 text-center shadow-sm ring-1 ring-emerald-200/60 sm:px-4">
                    <p class="text-lg" aria-hidden="true">✅</p>
                    <p class="text-sm font-semibold text-green-900">Pronto — pagamento liberado.</p>
                    <p class="mt-1 text-xs text-slate-600">A custodia encerrou. Obrigado por usar o fluxo guiado.</p>
                    <a routerLink="/dashboard" class="mm-btn-success mt-3 inline-block">Ir ao painel</a>
                  </div>
                </div>
              }
            }

            <div #chatBottom></div>
          </div>

          @if (!isFlowLocked()) {
            <div class="shrink-0 border-t border-black/8 bg-[#f0f2f5] px-2 py-2 sm:px-3">
              <div class="flex items-center gap-1.5 rounded-3xl bg-white px-2 py-1 shadow-sm ring-1 ring-black/[0.06]">
                <input
                  type="text"
                  [placeholder]="'Mensagem como ' + sideLabelLower() + '...'"
                  class="min-h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  [formControl]="draftControl"
                  [class.text-red-700]="draftControl.touched && draftControl.invalid && draftControl.enabled"
                  (keydown.enter)="sendMessage()"
                />
                <button
                  type="button"
                  class="grid size-9 shrink-0 place-content-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm transition hover:opacity-95 active:scale-95 disabled:opacity-40"
                  [disabled]="draftControl.invalid || draftControl.disabled"
                  (click)="sendMessage()"
                  aria-label="Enviar mensagem"
                >
                  <span class="text-base leading-none" aria-hidden="true">➤</span>
                </button>
              </div>
              @if (draftControl.touched && draftControl.invalid && draftControl.enabled) {
                <p class="mt-1 px-1 text-[10px] text-red-600">2 a 2000 caracteres.</p>
              }
            </div>
          } @else {
            <div class="shrink-0 border-t border-black/8 bg-[#f0f2f5]/80 px-3 py-2 text-center">
              <p class="text-[11px] text-slate-500">Negociacao encerrada — conversa e passos abaixo sao apenas para consulta.</p>
            </div>
          }
        </div>
      </div>

      <aside
        class="order-last w-full max-w-[15.5rem] shrink-0 rounded-lg border border-slate-200/70 bg-white/95 p-2.5 shadow-card lg:sticky lg:top-24 lg:order-none"
        aria-label="Resumo da transacao"
      >
        <h2 class="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Transacao</h2>

        <dl class="mt-1.5 space-y-0 divide-y divide-slate-100/90">
          <div class="flex items-start justify-between gap-1.5 py-1.5 first:pt-0">
            <dt class="shrink-0 text-[10px] text-slate-500">ID</dt>
            <dd class="break-all text-right font-mono text-[10px] leading-tight text-slate-900">#{{ transactionId }}</dd>
          </div>
          <div class="flex items-center justify-between gap-1.5 py-1.5">
            <dt class="shrink-0 text-[10px] text-slate-500">Status</dt>
            <dd class="flex justify-end"><app-status-badge [status]="currentStatus" /></dd>
          </div>
          <div class="flex items-start justify-between gap-1.5 py-1.5">
            <dt class="shrink-0 text-[10px] text-slate-500">Papel</dt>
            <dd class="text-right text-[10px] font-medium leading-tight text-slate-900">{{ sideLabel() }}</dd>
          </div>
          <div class="flex items-start justify-between gap-1.5 py-1.5">
            <dt class="shrink-0 text-[10px] text-slate-500">Tipo</dt>
            <dd class="text-right text-[10px] font-medium leading-tight text-slate-900">{{ typeLabel() }}</dd>
          </div>
          <div class="flex items-start justify-between gap-1.5 py-1.5">
            <dt class="shrink-0 text-[10px] text-slate-500">Entrega</dt>
            <dd class="text-right text-[10px] font-medium leading-tight text-slate-900">{{ deliveryLabel() }}</dd>
          </div>
          @if (transactionType === 'digital') {
            <div class="flex items-start justify-between gap-1.5 py-1.5">
              <dt class="shrink-0 text-[10px] text-slate-500">Contest.</dt>
              <dd class="text-right text-[10px] text-slate-800">{{ securityWindowHours }} h</dd>
            </div>
          }
          <div class="flex items-start justify-between gap-1.5 py-1.5">
            <dt class="shrink-0 text-[10px] text-slate-500">Convite</dt>
            <dd class="text-right text-[10px] font-medium leading-tight text-slate-900">{{ counterpartyRoleLabel() }}</dd>
          </div>
          <div class="flex items-start justify-between gap-1.5 py-1.5">
            <dt class="shrink-0 text-[10px] text-slate-500">Ref.</dt>
            <dd class="break-all text-right font-mono text-[9px] leading-tight text-slate-600">{{ inviteToken }}</dd>
          </div>
          <div class="py-1.5">
            <div class="flex items-start justify-between gap-1">
              <dt class="shrink-0 text-[10px] text-slate-500">Passo</dt>
              <dd class="text-right text-[10px] font-medium leading-tight text-slate-900">{{ flowStepTitle() }}</dd>
            </div>
            <div class="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-teal-500 transition-all duration-300"
                [style.width.%]="guideProgressPercent()"
              ></div>
            </div>
            <p class="mt-0.5 text-right text-[9px] tabular-nums text-slate-400">{{ guideProgressPercent() }}%</p>
          </div>
          <div class="flex items-start justify-between gap-1.5 py-1.5">
            <dt class="shrink-0 text-[10px] text-slate-500">Pagto.</dt>
            <dd class="text-right text-[10px] leading-tight text-slate-800">
              @if (selectedEscrowPayment) {
                {{ escrowPaymentMethodLabel() }}
              } @else {
                <span class="text-slate-400">—</span>
              }
            </dd>
          </div>
          <div class="flex items-start justify-between gap-1.5 py-1.5">
            <dt class="shrink-0 text-[10px] text-slate-500">QR cust.</dt>
            <dd class="text-right text-[10px] font-medium leading-tight" [class.text-emerald-700]="paymentQrDataUrl" [class.text-slate-400]="!paymentQrDataUrl">
              {{ paymentQrDataUrl ? 'Sim' : 'Nao' }}
            </dd>
          </div>
          <div class="py-1.5">
            <dt class="text-[10px] text-slate-500">2 lados</dt>
            <dd class="mt-0.5 space-y-0.5 text-[9px] leading-tight text-slate-800">
              <p class="truncate rounded bg-slate-50 px-1 py-0.5">{{ mutualBuyerCompact() }}</p>
              <p class="truncate rounded bg-slate-50 px-1 py-0.5">{{ mutualSellerCompact() }}</p>
            </dd>
          </div>
          @if (evidences.length > 0) {
            <div class="flex items-start justify-between gap-1.5 py-1.5">
              <dt class="shrink-0 text-[10px] text-slate-500">Reg.</dt>
              <dd class="text-right text-[10px] font-medium text-slate-900">{{ evidences.length }}</dd>
            </div>
          }
          @if (deliveryQrToken) {
            <div class="py-1.5">
              <dt class="text-[10px] text-slate-500">QR lib.</dt>
              <dd class="mt-0.5 break-all font-mono text-[9px] leading-tight text-slate-600">{{ deliveryQrToken }}</dd>
            </div>
          }
        </dl>

        <div class="mt-2 border-t border-slate-100 pt-2">
          <a
            [routerLink]="['/dispute', transactionId]"
            [queryParams]="transactionQueryParamsForRouter()"
            class="flex w-full items-center justify-center rounded-md border border-red-200/90 bg-red-50/70 px-2 py-1.5 text-center text-[10px] font-medium text-red-800 no-underline transition hover:border-red-300 hover:bg-red-50"
          >Disputa</a>
        </div>
      </aside>
    </section>
  `,
})
export class TransactionDetailComponent implements OnInit {
  @ViewChild('chatBottom') private chatBottom?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly transactionId = this.route.snapshot.paramMap.get('id') ?? '---';
  readonly stepShortLabels = STEP_SHORT_LABELS;
  readonly escrowPaymentOptions = ESCROW_PAYMENT_OPTIONS;

  inviteLink = '';
  inviteToken = '';
  showInviteQrPanel = false;
  /** Painel opcional de progresso (ⓘ) no topo do chat. */
  flowDetailsOpen = false;
  /** QR do convite (gerado localmente, sem servico externo). */
  inviteQrDataUrl = '';

  /** Pagamento em custodia via QR (somente comprador seleciona e gera). */
  selectedEscrowPayment: EscrowPaymentMethodId | null = null;
  paymentQrDataUrl = '';
  paymentQrGenerating = false;

  flowStep: FlowStep = 'ticket_created';

  readonly draftControl = this.fb.control('', [
    Validators.required,
    Validators.minLength(2),
    Validators.maxLength(2000),
  ]);

  readonly evidenceControl = this.fb.control('', [
    Validators.required,
    Validators.minLength(4),
    Validators.maxLength(500),
  ]);

  transactionType: TransactionType = 'physical';
  transactionSide: TransactionSide = 'sell';
  deliveryMethod: DeliveryMethod = 'shipping';
  securityWindowHours = PLATFORM_DISPUTE_WINDOW_HOURS;
  deliveryQrToken = '';
  digitalEvidenceCategory: 'print' | 'ownership' | 'other' = 'print';
  buyerConfirmed = false;
  sellerConfirmed = false;

  chatMessages: Array<{ id: number; sender: 'buyer' | 'seller' | 'chatbot'; text: string; time: string }> = [
    {
      id: 1,
      sender: 'chatbot',
      text: 'Oi! Seu ticket esta criado. Primeiro passo: chame a outra pessoa para entrar nesta mesma pagina. Use os botoes que vou mostrar em seguida.',
      time: '10:15',
    },
  ];

  evidences: Array<{ id: number; title: string; type: string; date: string }> = [];

  get currentStatus(): TransactionStatus {
    const map: Record<FlowStep, TransactionStatus> = {
      ticket_created: 'pending',
      ticket_confirmed: 'pending',
      payment_escrow: 'pending',
      delivery: 'paid',
      delivery_confirmed: 'completed',
      released: 'completed',
    };
    return map[this.flowStep];
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const type = qp.get('type');
    const side = qp.get('side');
    const delivery = qp.get('delivery');
    const windowParam = Number(qp.get('window'));

    if (type === 'physical' || type === 'digital') this.transactionType = type;
    if (side === 'buy' || side === 'sell') this.transactionSide = side;
    if (delivery && ['shipping', 'pickup', 'download', 'email', 'access'].includes(delivery)) {
      this.deliveryMethod = delivery as DeliveryMethod;
    }
    if (Number.isFinite(windowParam) && windowParam > 0) {
      this.securityWindowHours = windowParam;
    }

    this.inviteLink = this.buildInviteLink();
    this.inviteToken = `INV-${this.transactionId.replace(/\D/g, '').slice(-6) || this.transactionId}`;

    this.loadPersistedTransactionProgress();
    if (this.isFlowLocked()) {
      this.applyFlowLockToForm();
    }
  }

  /** Query params da sessao atual — repassar na ida/volta da disputa para restaurar o mesmo progresso. */
  transactionQueryParamsForRouter(): Record<string, string | number> {
    const o: Record<string, string | number> = {
      type: this.transactionType,
      side: this.transactionSide,
      delivery: this.deliveryMethod,
    };
    if (this.transactionType === 'digital') {
      o['window'] = this.securityWindowHours;
    }
    return o;
  }

  private persistStorageKey(): string {
    return `mm-tx-detail:v1:${this.transactionId}:${this.transactionType}:${this.transactionSide}:${this.deliveryMethod}:w${this.securityWindowHours}`;
  }

  private persistTransactionProgress(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const payload: MmTxDetailPersistedV1 = {
        v: 1,
        flowStep: this.flowStep,
        buyerConfirmed: this.buyerConfirmed,
        sellerConfirmed: this.sellerConfirmed,
        selectedEscrowPayment: this.selectedEscrowPayment,
        paymentQrDataUrl: this.paymentQrDataUrl,
        inviteQrDataUrl: this.inviteQrDataUrl,
        showInviteQrPanel: this.showInviteQrPanel,
        deliveryQrToken: this.deliveryQrToken,
        digitalEvidenceCategory: this.digitalEvidenceCategory,
        chatMessages: this.chatMessages,
        evidences: this.evidences,
        flowDetailsOpen: this.flowDetailsOpen,
      };
      sessionStorage.setItem(this.persistStorageKey(), JSON.stringify(payload));
    } catch {
      /* quota / modo privado */
    }
  }

  private isValidPersistedChatMessage(
    m: unknown,
  ): m is { id: number; sender: 'buyer' | 'seller' | 'chatbot'; text: string; time: string } {
    if (!m || typeof m !== 'object') return false;
    const o = m as Record<string, unknown>;
    return (
      typeof o['id'] === 'number' &&
      (o['sender'] === 'buyer' || o['sender'] === 'seller' || o['sender'] === 'chatbot') &&
      typeof o['text'] === 'string' &&
      (o['text'] as string).length <= 4000 &&
      typeof o['time'] === 'string'
    );
  }

  private isValidPersistedEvidence(
    e: unknown,
  ): e is { id: number; title: string; type: string; date: string } {
    if (!e || typeof e !== 'object') return false;
    const o = e as Record<string, unknown>;
    return (
      typeof o['id'] === 'number' &&
      typeof o['title'] === 'string' &&
      (o['title'] as string).length <= 600 &&
      typeof o['type'] === 'string' &&
      typeof o['date'] === 'string'
    );
  }

  private loadPersistedTransactionProgress(): void {
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(this.persistStorageKey());
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    const p = parsed as Partial<MmTxDetailPersistedV1>;
    if (p.v !== 1) return;

    const validSteps = new Set(FLOW_STEPS_DEF.map((s) => s.id));
    if (typeof p.flowStep !== 'string' || !validSteps.has(p.flowStep as FlowStep)) return;

    this.flowStep = p.flowStep as FlowStep;
    this.buyerConfirmed = !!p.buyerConfirmed;
    this.sellerConfirmed = !!p.sellerConfirmed;

    if (p.selectedEscrowPayment === null) {
      this.selectedEscrowPayment = null;
    } else if (
      typeof p.selectedEscrowPayment === 'string' &&
      ESCROW_PAYMENT_OPTIONS.some((o) => o.id === p.selectedEscrowPayment)
    ) {
      this.selectedEscrowPayment = p.selectedEscrowPayment as EscrowPaymentMethodId;
    }

    if (typeof p.paymentQrDataUrl === 'string') this.paymentQrDataUrl = p.paymentQrDataUrl;
    if (typeof p.inviteQrDataUrl === 'string') this.inviteQrDataUrl = p.inviteQrDataUrl;
    this.showInviteQrPanel = !!p.showInviteQrPanel;
    if (typeof p.deliveryQrToken === 'string') this.deliveryQrToken = p.deliveryQrToken;

    if (
      p.digitalEvidenceCategory === 'print' ||
      p.digitalEvidenceCategory === 'ownership' ||
      p.digitalEvidenceCategory === 'other'
    ) {
      this.digitalEvidenceCategory = p.digitalEvidenceCategory;
    }

    if (Array.isArray(p.chatMessages)) {
      const msgs = p.chatMessages.filter((m) => this.isValidPersistedChatMessage(m));
      if (msgs.length > 0) {
        this.chatMessages = msgs;
      }
    }

    if (Array.isArray(p.evidences)) {
      this.evidences = p.evidences.filter((e) => this.isValidPersistedEvidence(e));
    }

    if (typeof p.flowDetailsOpen === 'boolean') {
      this.flowDetailsOpen = p.flowDetailsOpen;
    }
  }

  /** Papel da contraparte no link de convite (quem abre entra como comprador ou vendedor). */
  private counterpartySide(): TransactionSide {
    return this.transactionSide === 'sell' ? 'buy' : 'sell';
  }

  /** Rotulo para o aside: papel de quem abre o convite. */
  counterpartyRoleLabel(): string {
    return this.counterpartySide() === 'buy' ? 'Comprador' : 'Vendedor';
  }

  /** Titulo curto do passo atual do fluxo guiado. */
  flowStepTitle(): string {
    const m: Record<FlowStep, string> = {
      ticket_created: 'Convite',
      ticket_confirmed: 'Dados combinados',
      payment_escrow: 'Custodia',
      delivery: 'Entrega',
      delivery_confirmed: 'Confirmacao mutua',
      released: 'Concluida',
    };
    return m[this.flowStep];
  }

  private buildInviteLink(): string {
    const queryParams: Record<string, string | number> = {
      type: this.transactionType,
      side: this.counterpartySide(),
    };
    if (this.transactionType === 'digital') {
      queryParams['window'] = this.securityWindowHours;
    }
    const tree = this.router.createUrlTree(['/transaction', this.transactionId], { queryParams });
    const path = this.router.serializeUrl(tree);
    if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
      return `${globalThis.location.origin}${path}`;
    }
    return path;
  }

  private scrollToChatBottom(): void {
    setTimeout(() => this.chatBottom?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
  }

  /** Papel do utilizador nesta sessao (mensagens "minhas" vao para a direita). */
  myChatRole(): 'buyer' | 'seller' {
    return this.transactionSide === 'buy' ? 'buyer' : 'seller';
  }

  isMyMessage(message: { sender: 'buyer' | 'seller' | 'chatbot' }): boolean {
    return message.sender !== 'chatbot' && message.sender === this.myChatRole();
  }

  private pushUserActionBubble(text: string): void {
    this.chatMessages = [
      ...this.chatMessages,
      { id: Date.now(), sender: this.myChatRole(), text, time: this.currentTime() },
    ];
    this.scrollToChatBottom();
    this.persistTransactionProgress();
  }

  private advanceFlow(nextStep: FlowStep, botReply: string, userAction?: string): void {
    this.flowStep = nextStep;
    if (nextStep === 'released') {
      this.applyFlowLockToForm();
    }
    const time = this.currentTime();
    const idBase = Date.now();
    const batch: Array<{ id: number; sender: 'buyer' | 'seller' | 'chatbot'; text: string; time: string }> = [];
    if (userAction) {
      batch.push({ id: idBase, sender: this.myChatRole(), text: userAction, time });
    }
    batch.push({
      id: userAction ? idBase + 1 : idBase,
      sender: 'chatbot',
      text: botReply,
      time,
    });
    this.chatMessages = [...this.chatMessages, ...batch];
    this.scrollToChatBottom();
    this.persistTransactionProgress();
  }

  confirmTicketCreated(): void {
    this.advanceFlow(
      'ticket_confirmed',
      'Otimo. Agora confira o combinado: tipo de negocio, como entrega e se voce esta como compra ou venda. Se algo estiver errado, alinhem antes de seguir.',
      'Ja enviei o convite — continuar.',
    );
  }

  confirmTicketDetails(): void {
    this.advanceFlow(
      'payment_escrow',
      'Proximo passo: o comprador escolhe a forma de pagamento (PIX, cartao, boleto, carteira, etc.), gera o QR neste chat e, apos pagar, confirma a custodia. O vendedor ve o mesmo QR aqui.',
      'Esta certo para mim — os dados batem.',
    );
  }

  confirmPaymentEscrow(): void {
    if (this.transactionSide !== 'buy') {
      this.toastService.show('Pagamento', 'Apenas o comprador confirma a custodia neste passo.', 'info');
      return;
    }
    if (!this.paymentQrDataUrl) {
      this.toastService.show('QR necessario', 'Gere o QR de pagamento no chat antes de confirmar.', 'warning');
      return;
    }
    this.advanceFlow(
      'delivery',
      this.transactionType === 'digital'
        ? 'Dinheiro na custodia. Agora registre a entrega do acesso digital e depois confirmem os dois lados.'
        : 'Dinheiro na custodia. Gere o QR de liberacao quando for liberar o produto; em seguida confirmem os dois na ultima etapa.',
      'Ja paguei — confirmo a custodia.',
    );
  }

  selectEscrowPaymentMethod(id: EscrowPaymentMethodId): void {
    if (this.transactionSide !== 'buy') return;
    this.selectedEscrowPayment = id;
    this.paymentQrDataUrl = '';
    this.persistTransactionProgress();
  }

  async generateEscrowPaymentQr(): Promise<void> {
    if (this.transactionSide !== 'buy' || !this.selectedEscrowPayment) {
      this.toastService.show('Pagamento', 'Escolha uma forma de pagamento.', 'warning');
      return;
    }
    this.paymentQrGenerating = true;
    try {
      const payload = this.buildEscrowPaymentPayload();
      this.paymentQrDataUrl = await this.qrDataUrlFromText(payload);
      const time = this.currentTime();
      const idBase = Date.now();
      this.chatMessages = [
        ...this.chatMessages,
        {
          id: idBase,
          sender: this.myChatRole(),
          text: `Gerei o QR de pagamento (${this.escrowPaymentMethodLabel()}).`,
          time,
        },
        {
          id: idBase + 1,
          sender: 'chatbot',
          text: `QR de pagamento (${this.escrowPaymentMethodLabel()}) disponivel abaixo nesta conversa. Comprador: escaneie no app do meio escolhido. Vendedor: pode acompanhar o mesmo codigo aqui.`,
          time,
        },
      ];
      this.scrollToChatBottom();
      this.persistTransactionProgress();
      this.toastService.show('QR no chat', 'Codigo gerado nesta pagina.', 'success');
    } catch {
      this.toastService.show('Erro', 'Nao foi possivel gerar o QR.', 'warning');
    } finally {
      this.paymentQrGenerating = false;
    }
  }

  escrowPaymentMethodLabel(): string {
    const o = ESCROW_PAYMENT_OPTIONS.find((x) => x.id === this.selectedEscrowPayment);
    return o?.label ?? '—';
  }

  paymentPayloadPreview(): string {
    return this.buildEscrowPaymentPayload();
  }

  private buildEscrowPaymentPayload(): string {
    const method = this.selectedEscrowPayment ?? 'pix';
    return [
      'MMESCROW',
      `TX:${this.transactionId}`,
      `PAY:${method}`,
      `SIDE:buy`,
      `TS:${Date.now()}`,
      'MOCK: dados do gateway seriam emitidos pelo backend',
    ].join('|');
  }

  private async qrDataUrlFromText(text: string): Promise<string> {
    const QRCode = (await import('qrcode')).default;
    return QRCode.toDataURL(text, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  }

  confirmDigitalAccess(): void {
    this.advanceFlow(
      'delivery_confirmed',
      'Entrega registrada. Ultimo passo: cada um confirma so o seu papel nesta pagina (comprador ou vendedor, conforme o convite). Quando os dois tiverem confirmado, o pagamento e liberado.',
      'Registrei a entrega digital — tudo entregue.',
    );
    this.toastService.show('Registro ok', 'Quando os dois confirmarem, o valor e liberado.', 'success');
  }

  generateDeliveryQr(): void {
    this.deliveryQrToken = `QR-DEL-${Date.now().toString().slice(-8)}`;
    this.pushUserActionBubble('Gerei o QR de liberacao da entrega.');
    this.toastService.show('QR pronto', 'A outra parte usa este codigo para confirmar a liberacao.', 'info');
  }

  simulateQrScan(): void {
    this.advanceFlow(
      'delivery_confirmed',
      'Leitura do QR feita (simulacao). Cada parte confirma o seu lado abaixo (so o botao do seu papel aparece para voce).',
      'Simulacao: leitura do QR de liberacao confirmada.',
    );
    this.toastService.show('Confirmacao', 'Falta o ok de comprador e vendedor.', 'info');
  }

  confirmByBuyer(): void {
    if (this.transactionSide !== 'buy') return;
    if (this.buyerConfirmed) return;
    this.buyerConfirmed = true;
    this.chatMessages = [
      ...this.chatMessages,
      { id: Date.now(), sender: 'buyer', text: 'Combinado, confirmo como comprador.', time: this.currentTime() },
    ];
    this.scrollToChatBottom();
    this.persistTransactionProgress();
    this.tryMutualRelease();
  }

  confirmBySeller(): void {
    if (this.transactionSide !== 'sell') return;
    if (this.sellerConfirmed) return;
    this.sellerConfirmed = true;
    this.chatMessages = [
      ...this.chatMessages,
      { id: Date.now(), sender: 'seller', text: 'Combinado, confirmo como vendedor.', time: this.currentTime() },
    ];
    this.scrollToChatBottom();
    this.persistTransactionProgress();
    this.tryMutualRelease();
  }

  private tryMutualRelease(): void {
    if (!(this.buyerConfirmed && this.sellerConfirmed)) return;
    this.flowStep = 'released';
    this.applyFlowLockToForm();
    this.chatMessages = [
      ...this.chatMessages,
      {
        id: Date.now() + 1,
        sender: 'chatbot',
        text: 'Perfeito — os dois confirmaram. O pagamento segue para o vendedor. Esta negociacao esta encerrada aqui.',
        time: this.currentTime(),
      },
    ];
    this.scrollToChatBottom();
    this.toastService.show('Tudo certo', 'Fluxo concluido com seguranca.', 'success');
    this.persistTransactionProgress();
  }

  addDigitalEvidence(): void {
    if (this.isFlowLocked()) return;
    this.evidenceControl.markAsTouched();
    if (this.evidenceControl.invalid) {
      this.toastService.show('Falta texto', 'Descreva o registro com pelo menos 4 letras.', 'warning');
      return;
    }
    const content = clampText(this.evidenceControl.value ?? '', 500);
    if (!content) return;
    const labels: Record<typeof this.digitalEvidenceCategory, string> = {
      print: 'Print ou log',
      ownership: 'Titularidade',
      other: 'Outro',
    };
    const title = `[${labels[this.digitalEvidenceCategory]}] ${content}`;
    this.evidences = [...this.evidences, { id: Date.now(), title, type: 'evidencia digital', date: 'Agora' }];
    const preview = title.length > 160 ? `${title.slice(0, 157)}…` : title;
    this.pushUserActionBubble(`Registro salvo: ${preview}`);
    this.evidenceControl.reset('');
    this.evidenceControl.markAsUntouched();
    this.toastService.show('Anotado', 'Fica na lista desta transacao.', 'info');
  }

  setEvidenceCategory(cat: 'print' | 'ownership' | 'other'): void {
    if (this.isFlowLocked()) return;
    this.digitalEvidenceCategory = cat;
    this.persistTransactionProgress();
  }

  async toggleInviteQrPanel(): Promise<void> {
    const wasOpen = this.showInviteQrPanel;
    this.showInviteQrPanel = !this.showInviteQrPanel;
    if (!wasOpen && this.showInviteQrPanel) {
      this.pushUserActionBubble('Abri o QR do convite nesta pagina.');
    }
    if (!this.showInviteQrPanel || !this.inviteLink || this.inviteQrDataUrl) return;
    try {
      this.inviteQrDataUrl = await this.qrDataUrlFromText(this.inviteLink);
    } catch {
      this.toastService.show('QR', 'Nao foi possivel gerar o convite.', 'warning');
    } finally {
      this.persistTransactionProgress();
    }
  }

  shareInviteWhatsApp(): void {
    if (!this.inviteLink) return;
    this.pushUserActionBubble('Enviei o convite pelo WhatsApp.');
    const message = encodeURIComponent(`Entre na nossa transacao segura: ${this.inviteLink}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
    this.toastService.show('WhatsApp', 'Nova aba aberta.', 'info');
  }

  shareInviteEmail(): void {
    if (!this.inviteLink) return;
    this.pushUserActionBubble('Enviei o convite por e-mail.');
    const body = encodeURIComponent(
      `Ola,\n\nUse o link para acessar a transacao em custodia:\n${this.inviteLink}\n\nToken (referencia): ${this.inviteToken}\n`,
    );
    window.open(`mailto:?subject=${encodeURIComponent('Convite — transacao em custodia')}&body=${body}`, '_blank');
    this.toastService.show('E-mail', 'Seu app de e-mail vai abrir.', 'info');
  }

  cancelTransaction(): void {
    if (!confirm('Sair desta tela? Voce pode voltar pelo painel depois.')) {
      return;
    }
    void this.router.navigate(['/dashboard']);
  }

  sendMessage(): void {
    if (this.isFlowLocked()) return;
    this.draftControl.markAsTouched();
    if (this.draftControl.invalid) {
      this.toastService.show('Mensagem curta', 'Escreva entre 2 e 2000 caracteres.', 'warning');
      return;
    }
    const content = clampText(this.draftControl.value ?? '', 2000);
    if (!content) return;
    const sender = this.transactionSide === 'buy' ? 'buyer' : 'seller';
    this.chatMessages = [
      ...this.chatMessages,
      { id: Date.now(), sender, text: content, time: this.currentTime() },
    ];
    this.draftControl.reset('');
    this.draftControl.markAsUntouched();
    this.scrollToChatBottom();
    this.persistTransactionProgress();
  }

  isFlowLocked(): boolean {
    return this.flowStep === 'released';
  }

  toggleFlowDetailsPanel(): void {
    this.flowDetailsOpen = !this.flowDetailsOpen;
    this.persistTransactionProgress();
  }

  private applyFlowLockToForm(): void {
    if (!this.isFlowLocked()) return;
    this.draftControl.disable({ emitEvent: false });
    this.evidenceControl.disable({ emitEvent: false });
  }

  currentStepIndex(): number {
    return FLOW_STEPS_DEF.findIndex((s) => s.id === this.flowStep);
  }

  stepHumanNumber(): number {
    return this.currentStepIndex() + 1;
  }

  guideProgressPercent(): number {
    const i = this.currentStepIndex();
    if (i < 0) return 0;
    return Math.round(((i + 1) / FLOW_STEPS_DEF.length) * 100);
  }

  guideLine(): string {
    const hints: Record<FlowStep, string> = {
      ticket_created: 'Chame a outra pessoa para esta pagina.',
      ticket_confirmed: 'Confira se o combinado esta certo.',
      payment_escrow: 'Comprador: escolha o meio de pagamento e gere o QR no chat.',
      delivery: 'Faca a entrega e registre aqui.',
      delivery_confirmed: 'Cada lado confirma com um clique.',
      released: 'Negociacao concluida.',
    };
    return hints[this.flowStep];
  }

  /** Resumo do status do ticket para o painel fixo (ambos veem o mesmo texto). */
  transactionStatusLabel(): string {
    const m: Record<TransactionStatus, string> = {
      pending: 'Ticket e pagamento',
      paid: 'Entrega em andamento',
      completed: 'Concluida',
      dispute: 'Em disputa',
    };
    return m[this.currentStatus];
  }

  stepVisualState(index: number): 'done' | 'current' | 'upcoming' {
    if (this.flowStep === 'released') return 'done';
    const cur = this.currentStepIndex();
    if (cur < 0) return 'upcoming';
    if (index < cur) return 'done';
    if (index === cur) return 'current';
    return 'upcoming';
  }

  stepDotContent(index: number): string {
    return this.stepVisualState(index) === 'done' ? '\u2713' : String(index + 1);
  }

  mutualBuyerLine(): string {
    if (this.flowStep === 'released' || this.buyerConfirmed) return 'Confirmado';
    if (this.flowStep === 'delivery_confirmed') return 'Aguardando confirmacao';
    return 'Ainda nao';
  }

  mutualSellerLine(): string {
    if (this.flowStep === 'released' || this.sellerConfirmed) return 'Confirmado';
    if (this.flowStep === 'delivery_confirmed') return 'Aguardando confirmacao';
    return 'Ainda nao';
  }

  mutualBuyerCompact(): string {
    return `C: ${this.mutualBuyerLine()}`;
  }

  mutualSellerCompact(): string {
    return `V: ${this.mutualSellerLine()}`;
  }

  mutualBuyerCardClass(): string {
    if (this.flowStep === 'released' || this.buyerConfirmed) return 'border-green-300 bg-green-50';
    if (this.flowStep === 'delivery_confirmed') return 'border-amber-200 bg-amber-50';
    return 'border-slate-200 bg-white';
  }

  mutualSellerCardClass(): string {
    if (this.flowStep === 'released' || this.sellerConfirmed) return 'border-green-300 bg-green-50';
    if (this.flowStep === 'delivery_confirmed') return 'border-amber-200 bg-amber-50';
    return 'border-slate-200 bg-white';
  }

  mutualBuyerTextClass(): string {
    if (this.flowStep === 'released' || this.buyerConfirmed) return 'text-green-900';
    if (this.flowStep === 'delivery_confirmed') return 'text-amber-900';
    return 'text-slate-600';
  }

  mutualSellerTextClass(): string {
    if (this.flowStep === 'released' || this.sellerConfirmed) return 'text-green-900';
    if (this.flowStep === 'delivery_confirmed') return 'text-amber-900';
    return 'text-slate-600';
  }

  typeLabel(): string {
    return this.transactionType === 'digital' ? 'Digital' : 'Fisico';
  }

  deliveryLabel(): string {
    const labels: Record<DeliveryMethod, string> = {
      shipping: 'Envio',
      pickup: 'Retirada',
      download: 'Download',
      email: 'E-mail',
      access: 'Acesso online',
    };
    return labels[this.deliveryMethod];
  }

  sideLabel(): string {
    return this.transactionSide === 'buy' ? 'Compra' : 'Venda';
  }

  sideLabelLower(): string {
    return this.transactionSide === 'buy' ? 'comprador' : 'vendedor';
  }

  senderLabel(sender: 'buyer' | 'seller' | 'chatbot'): string {
    const labels = { buyer: 'Comprador', seller: 'Vendedor', chatbot: 'Assistente' };
    return labels[sender];
  }

  private currentTime(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }

  selectionCardClass(active: boolean): string {
    const base =
      'flex size-[5.25rem] flex-none flex-col items-center justify-center gap-0.5 rounded-md border p-1.5 text-center text-[11px] font-semibold leading-tight transition sm:size-24 sm:text-xs';
    return active
      ? `${base} border-blue-700 bg-blue-50 shadow-sm`
      : `${base} border-slate-300 bg-white hover:border-blue-300`;
  }

  evidenceCategoryCardClass(cat: 'print' | 'ownership' | 'other'): string {
    if (this.isFlowLocked()) {
      return 'flex size-[5.25rem] flex-none cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-md border border-slate-200 bg-slate-100 p-1.5 text-center text-[11px] font-semibold leading-tight opacity-60 sm:size-24 sm:text-xs';
    }
    return this.selectionCardClass(this.digitalEvidenceCategory === cat);
  }

  actionCardClass(enabled: boolean): string {
    const base =
      'flex size-[5.25rem] flex-none flex-col items-center justify-center gap-0.5 rounded-md border p-1.5 text-center text-[11px] font-semibold leading-tight transition sm:size-24 sm:text-xs';
    if (!enabled) {
      return `${base} cursor-not-allowed border-slate-200 bg-slate-100 opacity-60`;
    }
    return `${base} border-slate-300 bg-white hover:border-blue-300`;
  }

  primaryReleaseCardClass(): string {
    const base =
      'flex size-[5.25rem] flex-none flex-col items-center justify-center gap-0.5 rounded-md border p-1.5 text-center text-[11px] font-semibold leading-tight transition sm:size-24 sm:text-xs';
    if (this.isFlowLocked()) {
      return `${base} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400`;
    }
    return `${base} border border-cyan-700/40 bg-gradient-to-br from-blue-100 via-cyan-50 to-indigo-100 text-slate-900 shadow-sm hover:brightness-105`;
  }

}

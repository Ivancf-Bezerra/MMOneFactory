import { NgClass } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject, isDevMode } from '@angular/core';
import {
  LucideBanknote,
  LucideBarcode,
  LucideCamera,
  LucideCheck,
  LucideCircleCheck,
  LucideCopy,
  LucideCreditCard,
  LucideKey,
  LucidePaperclip,
  LucideQrCode,
  LucideReceipt,
  LucideSend,
  LucideSmartphone,
  LucideThumbsDown,
  LucideThumbsUp,
  LucideWallet,
} from '@lucide/angular';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { clampText, normalizeFreeText } from '../../../../core/utils/sanitize';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import {
  PLATFORM_DISPUTE_WINDOW_HOURS,
  TransactionSide,
  TransactionStatus,
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

type EscrowPaymentMethodId = 'pix' | 'credit_card' | 'debit_card' | 'boleto' | 'wallet';

/** Dados exibidos no cartão “Resumo do pedido” dentro do chat. */
export type MmProductCardPayload = {
  title: string;
  amountLabel: string;
  typeLabel: string;
  deliveryLabel: string;
  buyerLabel: string;
  sellerLabel: string;
  disputeWindowLine?: string;
};

type MmOrderSnapshot = {
  title: string;
  amount: number;
  currency: string;
};

type MmChatMessage = {
  id: number;
  sender: 'buyer' | 'seller' | 'chatbot';
  text: string;
  time: string;
  /** Mensagem de boas-vindas em painel que preenche o chat (texto menor). */
  welcome?: boolean;
  /** Cartão com resumo do pedido (após a outra parte confirmar entrada). */
  productCard?: MmProductCardPayload;
};

type ProfileFeedbackVote = 'like' | 'dislike';

interface ProfileFeedbackEntry {
  transactionId: string;
  fromRole: 'buyer' | 'seller';
  toRole: 'buyer' | 'seller';
  vote: ProfileFeedbackVote;
  comment?: string;
  createdAt: string;
}

const ESCROW_PAYMENT_OPTIONS: { id: EscrowPaymentMethodId; label: string; hint: string }[] = [
  { id: 'pix', label: 'PIX', hint: 'QR dinâmico ou copiar e colar' },
  { id: 'credit_card', label: 'Cartão de crédito', hint: 'Parcelado no app' },
  { id: 'debit_card', label: 'Cartão de débito', hint: 'Débito em conta' },
  { id: 'boleto', label: 'Boleto', hint: 'Compensação em dias úteis' },
  { id: 'wallet', label: 'Carteira digital', hint: 'PicPay, Mercado Pago, etc.' },
];

/** Snapshot local (sessionStorage) para nao perder o fluxo ao voltar da disputa ou recarregar na mesma sessao. */
interface MmTxDetailPersistedV1 {
  v: 1;
  /** Quem criou a negociação (envia o convite no 1º passo). */
  negotiationHost?: boolean;
  flowStep: FlowStep;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  selectedEscrowPayment: EscrowPaymentMethodId | null;
  paymentQrDataUrl: string;
  inviteQrDataUrl: string;
  showInviteQrPanel: boolean;
  deliveryQrToken: string;
  digitalEvidenceCategory: 'print' | 'ownership' | 'other';
  chatMessages: MmChatMessage[];
  evidences: Array<{ id: number; title: string; type: string; date: string; step?: FlowStep }>;
  /** Título/valor combinados na criação ou no link do convite. */
  orderSnapshot?: MmOrderSnapshot;
}

export type MmEvidence = { id: number; title: string; type: string; date: string; step?: FlowStep };

const FLOW_STEP_IDS = new Set<FlowStep>([
  'ticket_created',
  'ticket_confirmed',
  'payment_escrow',
  'delivery',
  'delivery_confirmed',
  'released',
]);

/** Segredo do convite na URL + sessionStorage (16 bytes hex = 32 chars). */
const INVITE_GATE_HEX_LEN = 32;

@Component({
  selector: 'app-transaction-detail',
  imports: [
    NgClass,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    StatusBadgeComponent,
    LucideBanknote,
    LucideBarcode,
    LucideCamera,
    LucideCheck,
    LucideCircleCheck,
    LucideCopy,
    LucideCreditCard,
    LucideKey,
    LucidePaperclip,
    LucideQrCode,
    LucideReceipt,
    LucideSend,
    LucideSmartphone,
    LucideThumbsDown,
    LucideThumbsUp,
    LucideWallet,
  ],
  host: {
    class:
      'flex w-full min-w-0 flex-col overflow-x-hidden max-sm:min-h-0 max-sm:flex-none max-sm:overflow-y-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden',
  },
  templateUrl: './transaction-detail.component.html',
})
export class TransactionDetailComponent implements OnInit {
  @ViewChild('chatScrollArea') private chatScrollArea?: ElementRef<HTMLDivElement>;
  @ViewChild('chatBottom') private chatBottom?: ElementRef<HTMLDivElement>;
  @ViewChild('stepFileInput') private stepFileInput?: ElementRef<HTMLInputElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly transactionId = this.route.snapshot.paramMap.get('id') ?? '---';
  readonly escrowPaymentOptions = ESCROW_PAYMENT_OPTIONS;
  readonly devMode = isDevMode();

  /**
   * Segredo opaco do convite (query `gate`). Sem ele, não dá para adivinhar só pelo id da rota
   * quem entra na negociação — reduz fraude por URLs enumeráveis.
   */
  transactionGate = '';

  /** `true` se faltar `gate` válido ou se o navegador tiver outro segredo salvo para o mesmo id (possível adulteração). */
  inviteAccessBlocked = false;

  /**
   * Quem abriu a negociação pela tela de criação (envia link/QR no passo inicial).
   * Quem entra só pelo convite é `false`.
   */
  isNegotiationHost = false;

  /** Chips do fluxo — mesmo vocabulário visual do assistente em create-transaction. */
  readonly guideStepPills: { id: FlowStep; label: string }[] = [
    { id: 'ticket_created', label: 'Link' },
    { id: 'ticket_confirmed', label: 'Conferir' },
    { id: 'payment_escrow', label: 'Pagamento' },
    { id: 'delivery', label: 'Entrega' },
    { id: 'delivery_confirmed', label: 'Ok final' },
    { id: 'released', label: 'Concluída' },
  ];

  inviteLink = '';
  inviteToken = '';
  inviteShortCode = '';
  showInviteQrPanel = false;
  /** QR do convite (gerado localmente, sem servico externo). */
  inviteQrDataUrl = '';

  /** Pagamento com dinheiro guardado na plataforma via QR (só o comprador escolhe e gera). */
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

  transactionSide: TransactionSide = 'sell';
  securityWindowHours = PLATFORM_DISPUTE_WINDOW_HOURS;
  deliveryQrToken = '';
  digitalEvidenceCategory: 'print' | 'ownership' | 'other' = 'print';
  buyerConfirmed = false;
  sellerConfirmed = false;

  /** Dados do anúncio/valor (criação ou parâmetros do link de convite). */
  orderSnapshot: MmOrderSnapshot | null = null;

  /**
   * Nome público da outra parte para o resumo do pedido (chat).
   * Anfitrião: convidado escolhido na pesquisa. Convidado: nome do anfitrião vindo do link (`peerName`).
   */
  counterpartyPeerName: string | null = null;

  chatMessages: MmChatMessage[] = [
    {
      id: 1,
      sender: 'chatbot',
      welcome: true,
      text: 'Siga a sequência abaixo: o anfitrião envia o convite; a outra parte entra com o papel correspondente. O chat serve para alinhar detalhes. Em pagamento e entrega, use anexos para registro (comprovantes ou capturas) quando fizer diferença para o caso.',
      time: '10:15',
    },
  ];

  evidences: MmEvidence[] = [];
  showConfirmationModal = false;
  showFeedbackModal = false;
  private pendingConfirmAction: 'exit' | 'cancel' | null = null;
  feedbackVote: ProfileFeedbackVote | null = null;
  feedbackComment = '';
  feedbackAlreadySubmitted = false;
  counterpartyFeedbackSummary: { likes: number; dislikes: number; comments: string[] } | null = null;

  /** Passo ao qual um novo anexo de arquivo será associado. */
  private pendingAttachmentStep: FlowStep | null = null;

  get confirmationModalTitle(): string {
    if (this.pendingConfirmAction === 'cancel') return 'Cancelar negociação';
    if (this.pendingConfirmAction === 'exit') return 'Sair desta tela';
    return 'Confirmar ação';
  }

  get confirmationModalMessage(): string {
    if (this.pendingConfirmAction === 'cancel') {
      return 'Esta ação remove o progresso salvo desta negociação neste dispositivo. Deseja continuar?';
    }
    if (this.pendingConfirmAction === 'exit') {
      return 'Você voltará ao painel e poderá retomar esta negociação depois.';
    }
    return '';
  }

  get confirmationModalConfirmLabel(): string {
    if (this.pendingConfirmAction === 'cancel') return 'Sim, cancelar';
    if (this.pendingConfirmAction === 'exit') return 'Sim, sair';
    return 'Confirmar';
  }

  get canSubmitFeedback(): boolean {
    return this.feedbackVote !== null;
  }

  get counterpartyApprovalRateLabel(): string {
    const summary = this.counterpartyFeedbackSummary;
    if (!summary) return '—';
    const total = summary.likes + summary.dislikes;
    if (total === 0) return '—';
    return `${Math.round((summary.likes / total) * 100)}%`;
  }

  get currentStatus(): TransactionStatus {
    const statusByStep: Record<FlowStep, TransactionStatus> = {
      ticket_created: 'pending',
      ticket_confirmed: 'pending',
      payment_escrow: 'pending',
      delivery: 'paid',
      delivery_confirmed: 'completed',
      released: 'completed',
    };
    return statusByStep[this.flowStep];
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const side = qp.get('side');
    const windowParam = Number(qp.get('window'));
    const openInviteQrFromCreate = qp.get('openInviteQr') === '1';

    if (side === 'buy' || side === 'sell') this.transactionSide = side;
    this.securityWindowHours =
      Number.isFinite(windowParam) && windowParam > 0 ? windowParam : PLATFORM_DISPUTE_WINDOW_HOURS;

    this.transactionGate = this.resolveInviteGate(qp);
    this.inviteAccessBlocked = !this.transactionGate;
    this.hydrateNegotiationHostFromSession();
    if (this.inviteAccessBlocked) {
      this.toastService.show(
        'Acesso indisponível',
        'Use o link completo que você recebeu para entrar nesta negociação com segurança.',
        'warning',
      );
      this.draftControl.disable({ emitEvent: false });
      this.evidenceControl.disable({ emitEvent: false });
    } else {
      this.hydrateOrderSnapshot(qp);
      this.inviteLink = this.buildInviteLink();
      this.inviteToken = `INV-${this.transactionGate.slice(0, 8).toUpperCase()}`;
      this.inviteShortCode = this.readInviteCodeFromSessionStorage();
    }

    if (!this.inviteAccessBlocked) {
      this.loadPersistedTransactionProgress();
      this.mergeBootstrapEvidencesFromCreateFlow();
      const hadCounterpartyInUrl =
        !!(
          this.route.snapshot.queryParamMap.get('counterpartUserId')?.trim() ||
          this.route.snapshot.queryParamMap.get('counterpartName')?.trim()
        );
      const hadCounterpartyInSession = !!this.readCounterpartyFromSessionStorage();
      const shouldAutoConfirmHostInvite =
        this.isNegotiationHost && (hadCounterpartyInUrl || hadCounterpartyInSession);

      this.hydrateCounterpartyPeerName(this.route.snapshot.queryParamMap);
      this.inviteLink = this.buildInviteLink();
      if (!this.inviteShortCode) {
        this.inviteShortCode = this.readInviteCodeFromSessionStorage();
      }
      if (this.isFlowLocked()) {
        this.applyFlowLockToForm();
      }
      void this.applyAutoOpenInviteQrFromCreate(openInviteQrFromCreate).then(() =>
        this.maybeAutoConfirmHostInviteAfterCreate(shouldAutoConfirmHostInvite),
      );
    }
    this.refreshCounterpartyFeedbackState();
  }

  /**
   * Se o convidado foi escolhido na criação (pesquisa / URL), assume que o convite já foi tratado
   * e avança o passo do anfitrião sem clicar em "Já enviei o convite — continuar".
   */
  private maybeAutoConfirmHostInviteAfterCreate(should: boolean): void {
    if (!should) return;
    if (this.flowInteractionDisabled()) return;
    if (!this.isNegotiationHost) return;
    if (this.flowStep !== 'ticket_created') return;
    this.confirmTicketCreated();
  }

  /** Título e valor vindos da criação, do link completo ou do progresso salvo. */
  private hydrateOrderSnapshot(qp: ParamMap): void {
    const fromUrl = this.parseOrderFromQueryParams(qp);
    const fromSession = this.readOrderSnapshotFromSessionStorage();
    const merged = fromUrl ?? fromSession;
    if (merged) {
      this.orderSnapshot = merged;
      this.persistOrderSnapshotToSessionStorage();
    }
  }

  private persistOrderSnapshotToSessionStorage(): void {
    if (!this.orderSnapshot || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(`mm-tx-order:${this.transactionId}`, JSON.stringify(this.orderSnapshot));
    } catch {
      /* quota / privado */
    }
  }

  private readOrderSnapshotFromSessionStorage(): MmOrderSnapshot | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(`mm-tx-order:${this.transactionId}`);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return this.isValidOrderSnapshot(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** Convidado escolhido na pesquisa (criação) — sessionStorage escrito em create-transaction. */
  private readCounterpartyFromSessionStorage(): { userId: string; displayName: string } | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(`mm-tx-counterparty:${this.transactionId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { userId?: unknown; displayName?: unknown };
      if (typeof parsed.displayName !== 'string' || !parsed.displayName.trim()) return null;
      return {
        userId: typeof parsed.userId === 'string' ? parsed.userId : '',
        displayName: parsed.displayName.trim(),
      };
    } catch {
      return null;
    }
  }

  private readInviteCodeFromSessionStorage(): string {
    if (typeof sessionStorage === 'undefined') return '';
    try {
      const raw = sessionStorage.getItem(`mm-tx-invite-code:${this.transactionId}`)?.trim().toUpperCase() ?? '';
      if (!/^[A-Z]{3}\d{4}$/.test(raw)) return '';
      return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    } catch {
      return '';
    }
  }

  private hydrateCounterpartyPeerName(qp: ParamMap): void {
    if (this.isNegotiationHost) {
      const urlName = qp.get('counterpartName')?.trim();
      if (urlName) {
        this.counterpartyPeerName = urlName;
      } else {
        const s = this.readCounterpartyFromSessionStorage();
        if (s?.displayName) {
          this.counterpartyPeerName = s.displayName;
        }
      }
    } else {
      const peer = qp.get('peerName')?.trim();
      if (peer) {
        this.counterpartyPeerName = peer;
      }
    }

    const shouldStrip =
      qp.get('counterpartName') != null ||
      qp.get('counterpartUserId') != null ||
      qp.get('peerName') != null;
    if (shouldStrip) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { counterpartName: null, counterpartUserId: null, peerName: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  private parseOrderFromQueryParams(qp: ParamMap): MmOrderSnapshot | null {
    const title = qp.get('itemTitle')?.trim();
    const amountRaw = qp.get('itemAmount');
    const currency = qp.get('itemCurrency')?.trim();
    if (!title || amountRaw === null || amountRaw === undefined || !currency) return null;
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 0) return null;
    const norm = normalizeFreeText(title);
    if (!norm.length) return null;
    return {
      title: norm.length > 300 ? norm.slice(0, 300) : norm,
      amount,
      currency: currency.toUpperCase().slice(0, 8),
    };
  }

  private isValidOrderSnapshot(o: unknown): o is MmOrderSnapshot {
    if (!o || typeof o !== 'object') return false;
    const r = o as Record<string, unknown>;
    return (
      typeof r['title'] === 'string' &&
      r['title'].length > 0 &&
      r['title'].length <= 400 &&
      typeof r['amount'] === 'number' &&
      Number.isFinite(r['amount']) &&
      r['amount'] >= 0 &&
      typeof r['currency'] === 'string' &&
      r['currency'].length > 0
    );
  }

  /**
   * Valida o segredo do convite: presente na URL, formato fixo, e coerente com o que o criador guardou neste navegador.
   */
  private resolveInviteGate(qp: ParamMap): string {
    const fromQuery = qp.get('gate')?.trim() ?? '';
    const storageKey = `mm-tx-gate:${this.transactionId}`;
    let stored = '';
    if (typeof sessionStorage !== 'undefined') {
      try {
        stored = sessionStorage.getItem(storageKey)?.trim() ?? '';
      } catch {
        /* ignore */
      }
    }

    const validHex = (s: string) => s.length === INVITE_GATE_HEX_LEN && /^[0-9a-f]+$/i.test(s);

    if (fromQuery && !validHex(fromQuery)) {
      return '';
    }
    if (stored && !validHex(stored)) {
      stored = '';
    }
    if (stored && fromQuery && fromQuery.toLowerCase() !== stored.toLowerCase()) {
      return '';
    }

    if (fromQuery && validHex(fromQuery)) {
      return fromQuery.toLowerCase();
    }

    if (stored && validHex(stored)) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { gate: stored },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      return stored.toLowerCase();
    }

    return '';
  }

  private hydrateNegotiationHostFromSession(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    try {
      this.isNegotiationHost = sessionStorage.getItem(`mm-tx-host:${this.transactionId}`) === '1';
    } catch {
      this.isNegotiationHost = false;
    }
  }

  /** Após criar a negociação: abre o painel do QR do convite para leitura presencial. */
  private async applyAutoOpenInviteQrFromCreate(fromCreate: boolean): Promise<void> {
    const stripOpenInviteQrParam = (): Promise<boolean> =>
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { openInviteQr: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });

    if (!fromCreate || this.inviteAccessBlocked || !this.isNegotiationHost) return;

    if (this.isFlowLocked() || this.flowStep !== 'ticket_created') {
      await stripOpenInviteQrParam();
      return;
    }

    this.showInviteQrPanel = true;
    if (this.inviteLink && !this.inviteQrDataUrl) {
      try {
        this.inviteQrDataUrl = await this.qrDataUrlFromText(this.inviteLink, 320);
      } catch {
        this.toastService.show('Código de acesso', 'Não conseguimos gerar o código agora. Tente novamente.', 'warning');
      }
    }
    this.persistTransactionProgress();
    await stripOpenInviteQrParam();
    this.toastService.show(
      'Compartilhamento pronto',
      'Mostre o código para a outra pessoa entrar rapidamente na negociação.',
      'info',
    );
    setTimeout(() => this.scrollToChatBottom(), 0);
  }

  /** Anexos escolhidos na tela de criação (mesma sessão do navegador). */
  private mergeBootstrapEvidencesFromCreateFlow(): void {
    if (typeof sessionStorage === 'undefined') return;
    const key = `mm-tx-bootstrap-evidence:${this.transactionId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const merged: MmEvidence[] = [];
      for (const item of parsed) {
        if (!this.isValidBootstrapEvidenceItem(item)) continue;
        merged.push(item);
      }
      if (merged.length === 0) return;
      this.evidences = [...merged, ...this.evidences];
      sessionStorage.removeItem(key);
      this.persistTransactionProgress();
      this.toastService.show(
        'Anexos da criação',
        `${merged.length} arquivo(s) anotado(s) a partir da tela de abertura da negociação.`,
        'info',
      );
    } catch {
      sessionStorage.removeItem(key);
    }
  }

  private isValidBootstrapEvidenceItem(item: unknown): item is MmEvidence {
    if (!item || typeof item !== 'object') return false;
    const o = item as Record<string, unknown>;
    if (typeof o['id'] !== 'number' || typeof o['title'] !== 'string' || typeof o['type'] !== 'string' || typeof o['date'] !== 'string') {
      return false;
    }
    if (o['step'] !== undefined) {
      if (typeof o['step'] !== 'string' || !FLOW_STEP_IDS.has(o['step'] as FlowStep)) return false;
    }
    return (o['title'] as string).length <= 600;
  }

  /** Query params da sessao atual — repassar na ida/volta da disputa para restaurar o mesmo progresso. */
  transactionQueryParamsForRouter(): Record<string, string | number> {
    const o: Record<string, string | number> = {
      side: this.transactionSide,
      window: this.securityWindowHours,
    };
    if (this.transactionGate) {
      o['gate'] = this.transactionGate;
    }
    if (this.orderSnapshot) {
      o['itemTitle'] = this.orderSnapshot.title;
      o['itemAmount'] = this.orderSnapshot.amount;
      o['itemCurrency'] = this.orderSnapshot.currency;
    }
    return o;
  }

  private persistStorageKey(): string {
    const gateSeg = this.inviteAccessBlocked ? 'blocked' : this.transactionGate || 'missing';
    return `mm-tx-detail:v1:${this.transactionId}:${this.transactionSide}:w${this.securityWindowHours}:${gateSeg}`;
  }

  private persistTransactionProgress(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const payload: MmTxDetailPersistedV1 = {
        v: 1,
        negotiationHost: this.isNegotiationHost,
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
        orderSnapshot: this.orderSnapshot ?? undefined,
      };
      sessionStorage.setItem(this.persistStorageKey(), JSON.stringify(payload));
    } catch {
      /* quota / modo privado */
    }
  }

  private isValidPersistedChatMessage(m: unknown): m is MmChatMessage {
    if (!m || typeof m !== 'object') return false;
    const o = m as Record<string, unknown>;
    if (
      typeof o['id'] !== 'number' ||
      (o['sender'] !== 'buyer' && o['sender'] !== 'seller' && o['sender'] !== 'chatbot') ||
      typeof o['text'] !== 'string' ||
      (o['text'] as string).length > 4000 ||
      typeof o['time'] !== 'string'
    ) {
      return false;
    }
    if (o['welcome'] !== undefined && o['welcome'] !== true && o['welcome'] !== false) return false;
    if (o['productCard'] !== undefined) {
      const pc = o['productCard'] as Record<string, unknown>;
      const ok =
        typeof pc['title'] === 'string' &&
        typeof pc['amountLabel'] === 'string' &&
        typeof pc['typeLabel'] === 'string' &&
        typeof pc['deliveryLabel'] === 'string' &&
        typeof pc['buyerLabel'] === 'string' &&
        typeof pc['sellerLabel'] === 'string';
      if (!ok) return false;
      if (pc['disputeWindowLine'] !== undefined && typeof pc['disputeWindowLine'] !== 'string') return false;
    }
    return true;
  }

  /** Primeira mensagem do assistente: painel que preenche o chat (sessões antigas sem `welcome` usam id 1). */
  isWelcomeBannerMessage(message: MmChatMessage): boolean {
    if (message.productCard) return false;
    return message.sender === 'chatbot' && (message.welcome === true || message.id === 1);
  }

  private isValidPersistedEvidence(e: unknown): e is MmEvidence {
    if (!e || typeof e !== 'object') return false;
    const o = e as Record<string, unknown>;
    if (
      typeof o['id'] !== 'number' ||
      typeof o['title'] !== 'string' ||
      (o['title'] as string).length > 600 ||
      typeof o['type'] !== 'string' ||
      typeof o['date'] !== 'string'
    ) {
      return false;
    }
    if (o['step'] !== undefined) {
      if (typeof o['step'] !== 'string' || !FLOW_STEP_IDS.has(o['step'] as FlowStep)) return false;
    }
    return true;
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

    if (typeof p.negotiationHost === 'boolean') {
      this.isNegotiationHost = p.negotiationHost;
    } else {
      this.hydrateNegotiationHostFromSession();
    }

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
      const msgs = p.chatMessages.filter((msg) => this.isValidPersistedChatMessage(msg));
      if (msgs.length > 0) {
        this.chatMessages = msgs;
      }
    }

    if (Array.isArray(p.evidences)) {
      this.evidences = p.evidences.filter((e) => this.isValidPersistedEvidence(e));
    }

    if (p.orderSnapshot && this.isValidOrderSnapshot(p.orderSnapshot)) {
      this.orderSnapshot = p.orderSnapshot;
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

  /** Título curto do passo atual (passo a passo na tela). */
  flowStepTitle(): string {
    switch (this.flowStep) {
      case 'ticket_created':
        return this.isNegotiationHost ? 'Convite' : 'Entrada';
      case 'ticket_confirmed':
        return 'Conferência do resumo';
      case 'payment_escrow':
        return this.transactionSide === 'buy' ? 'Pagamento em custódia' : 'Aguardar pagamento';
      case 'delivery':
        return this.transactionSide === 'sell' ? 'Entrega' : 'Recebimento';
      case 'delivery_confirmed':
        return 'Confirmações finais';
      case 'released':
        return 'Concluída';
      default:
        return 'Em curso';
    }
  }

  /** Rótulo do chip do fluxo conforme papel (comprador / vendedor / anfitrião). */
  guideStepPillDisplayLabel(pill: { id: FlowStep; label: string }): string {
    switch (pill.id) {
      case 'ticket_created':
        return this.isNegotiationHost ? 'Convite' : 'Entrada';
      case 'ticket_confirmed':
        return 'Conferir';
      case 'payment_escrow':
        return this.transactionSide === 'buy' ? 'Pagar' : 'Aguardar';
      case 'delivery':
        return this.transactionSide === 'buy' ? 'Receber' : 'Enviar';
      case 'delivery_confirmed':
        return 'Ok final';
      case 'released':
        return 'Concluída';
      default:
        return pill.label;
    }
  }

  private buildInviteLink(): string {
    const queryParams: Record<string, string | number> = {
      side: this.counterpartySide(),
      gate: this.transactionGate,
      window: this.securityWindowHours,
    };
    if (this.orderSnapshot) {
      queryParams['itemTitle'] = this.orderSnapshot.title;
      queryParams['itemAmount'] = this.orderSnapshot.amount;
      queryParams['itemCurrency'] = this.orderSnapshot.currency;
    }
    const hostDisplay = this.authService.userDisplayName()?.trim();
    if (this.isNegotiationHost && hostDisplay) {
      queryParams['peerName'] = hostDisplay;
    }
    const tree = this.router.createUrlTree(['/transaction', this.transactionId], { queryParams });
    const path = this.router.serializeUrl(tree);

    if (typeof globalThis === 'undefined' || !('location' in globalThis)) {
      return path;
    }

    const loc = globalThis.location as Location;

    // GitHub Pages: sem reescrita SPA; a app usa HashLocationStrategy — o convite tem de usar #/...
    if (/\.github\.io$/i.test(loc.hostname)) {
      let base = `${loc.origin}${loc.pathname}`;
      base = base.replace(/\/index\.html$/i, '');
      if (!base.endsWith('/')) {
        base += '/';
      }
      return `${base}#${path}`;
    }

    return `${loc.origin}${path}`;
  }

  private scrollToChatBottom(): void {
    const run = (): void => {
      const el = this.chatScrollArea?.nativeElement;
      if (el && el.scrollHeight > el.clientHeight + 2) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        return;
      }
      this.chatBottom?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };
    setTimeout(run, 0);
    setTimeout(run, 100);
  }

  /** Texto curto explicando que comprovante encaixa neste passo. */
  stepAttachmentHint(step: FlowStep): string {
    if (step === 'payment_escrow') {
      return this.transactionSide === 'buy'
        ? 'Comprovante, extrato ou captura do app, se precisar documentar o pagamento.'
        : 'Registro visual do QR ou do estado do pagamento, se for relevante.';
    }
    if (step === 'delivery') {
      return this.transactionSide === 'sell'
        ? 'Envio, rastreio ou comprovante do que deixou de sua responsabilidade.'
        : 'Receção ou leitura do código, com imagem ou PDF se fizer sentido.';
    }
    const hints: Partial<Record<FlowStep, string>> = {
      ticket_created: 'Convite ou conversa, se quiser deixar registro do processo.',
      ticket_confirmed: 'Resumo ou conversa alinhada ao combinado.',
      delivery_confirmed: 'Tela após confirmação ou recibo, conforme o caso.',
      released: '',
    };
    return hints[step] ?? '';
  }

  /** Anexo por arquivo só nos passos de pagamento e entrega (e pagamento: comprador ou já com QR visível). */
  /** Ações de chat e passos — bloqueadas sem convite válido ou após conclusão. */
  flowInteractionDisabled(): boolean {
    return this.inviteAccessBlocked || this.isFlowLocked();
  }

  canAttachInStep(step: FlowStep): boolean {
    if (this.flowInteractionDisabled() || step === 'released') return false;
    if (step === 'payment_escrow') {
      return !!this.paymentQrDataUrl;
    }
    if (step === 'delivery') {
      return this.transactionSide === 'sell' || this.transactionSide === 'buy';
    }
    return false;
  }

  openStepAttachmentPicker(step: FlowStep): void {
    if (!this.canAttachInStep(step)) return;
    this.pendingAttachmentStep = step;
    this.stepFileInput?.nativeElement.click();
  }

  onStepFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    const step = this.pendingAttachmentStep;
    this.pendingAttachmentStep = null;
    input.value = '';
    if (!step || !files?.length) return;
    this.appendFileEvidencesForStep(step, files);
  }

  private appendFileEvidencesForStep(step: FlowStep, files: FileList): void {
    const stepLabel = this.flowStepTitleForAttachment(step);
    const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const added: MmEvidence[] = [];
    const maxFiles = 8;
    const list = Array.from(files).slice(0, maxFiles);
    for (const file of list) {
      const safeName = clampText(file.name.replace(/[^\w.\-()\s\u00C0-\u024F]/g, '_'), 120) || 'arquivo';
      const title = `[${stepLabel}] ${safeName}`;
      added.push({
        id: Date.now() + Math.floor(Math.random() * 10000),
        title,
        type: file.type.startsWith('image/') ? 'Imagem' : file.type === 'application/pdf' ? 'PDF' : 'Arquivo',
        date: now,
        step,
      });
    }
    if (!added.length) return;
    this.evidences = [...this.evidences, ...added];
    const names = added.map((a) => a.title.replace(/^\[[^\]]+\]\s*/, '')).join(', ');
    this.pushUserActionBubble(`Anexei comprovante(s) neste passo: ${names}`);
    this.toastService.show('Anexos', `${added.length} arquivo(s) registrado(s) na lista da negociação.`, 'success');
    this.persistTransactionProgress();
  }

  private flowStepTitleForAttachment(step: FlowStep): string {
    if (step === 'delivery') {
      return this.transactionSide === 'sell' ? 'Registro de envio / acesso' : 'Comprovante de recebimento';
    }
    const labels: Partial<Record<FlowStep, string>> = {
      ticket_created: 'Link para a outra pessoa',
      ticket_confirmed: 'Conferência dos dados',
      payment_escrow: 'Pagamento',
      delivery: 'Entrega',
      delivery_confirmed: 'Confirmação final',
      released: 'Concluída',
    };
    return labels[step] ?? 'Anexo';
  }

  evidencesForStep(step: FlowStep): MmEvidence[] {
    return this.evidences.filter((e) => e.step === step);
  }

  /** Papel do utilizador nesta sessao (mensagens "minhas" vao para a direita). */
  myChatRole(): 'buyer' | 'seller' {
    return this.transactionSide === 'buy' ? 'buyer' : 'seller';
  }

  isMyMessage(message: { sender: 'buyer' | 'seller' | 'chatbot' }): boolean {
    return message.sender !== 'chatbot' && message.sender === this.myChatRole();
  }

  /** Rotulo curto nas bolhas da contraparte (comprador/vendedor no convite). */
  counterpartyShortLabel(): string {
    return `Outra parte (${this.counterpartyRoleLabel().toLowerCase()})`;
  }

  private counterpartyChatRole(): 'buyer' | 'seller' {
    return this.counterpartySide() === 'buy' ? 'buyer' : 'seller';
  }

  private pushCounterpartyBubble(text: string): void {
    this.chatMessages = [
      ...this.chatMessages,
      { id: Date.now(), sender: this.counterpartyChatRole(), text, time: this.currentTime() },
    ];
    this.scrollToChatBottom();
    this.persistTransactionProgress();
  }

  private scheduleCounterpartyReply(text: string, delayMs = 900, then?: () => void): void {
    window.setTimeout(() => {
      this.pushCounterpartyBubble(text);
      then?.();
    }, delayMs);
  }

  /** Insere uma fala típica da outra parte conforme a etapa (só em build de desenvolvimento). */
  simulateCounterpartyChat(): void {
    if (!this.devMode || this.flowInteractionDisabled()) {
      return;
    }
    this.pushCounterpartyBubble(this.counterpartyDemoLine());
    this.toastService.show('Simulação', 'Mensagem de exemplo inserida.', 'info');
  }

  private counterpartyDemoLine(): string {
    const cp = this.counterpartyRoleLabel();
    const demoLines: Record<FlowStep, string> = {
      ticket_created: `Aqui o ${cp.toLowerCase()}: acessei o convite e estou no mesmo fluxo.`,
      ticket_confirmed: 'Resumo e papéis conferidos com o combinado.',
      payment_escrow:
        this.transactionSide === 'buy'
          ? 'Aguardando a liquidação; qualquer ponto, escrevo no chat.'
          : 'A acompanhar o passo de pagamento; aviso se surgir dúvida.',
      delivery: 'Quanto à entrega, aviso quando tiver o meu registro concluído.',
      delivery_confirmed: 'Faço a minha confirmação em seguida.',
      released: 'Obrigado — negociação concluída.',
    };
    return demoLines[this.flowStep] ?? `(${cp}) Sigo por aqui.`;
  }

  /** Na etapa mútua, confirma o lado oposto à sessão atual (útil com uma só janela em dev). */
  simulateCounterpartyMutualConfirm(): void {
    if (!this.devMode) {
      return;
    }
    if (this.inviteAccessBlocked) {
      return;
    }
    if (this.flowStep !== 'delivery_confirmed' || this.isFlowLocked()) {
      this.toastService.show('Quase no final', 'As confirmações acontecem na etapa final.', 'info');
      return;
    }
    if (this.myChatRole() === 'buyer') {
      if (this.sellerConfirmed) {
        this.toastService.show('Confirmação em andamento', 'O vendedor já confirmou. Falta o comprador.', 'info');
        return;
      }
      this.sellerConfirmed = true;
      this.pushCounterpartyBubble('Confirmo como vendedor — entrega ok do meu lado.');
      this.tryMutualRelease();
      return;
    }
    if (!this.buyerConfirmed) {
      this.buyerConfirmed = true;
      this.pushCounterpartyBubble('Confirmo como comprador — recebi conforme combinado.');
      this.tryMutualRelease();
      return;
    }
    this.toastService.show('Confirmação em andamento', 'O comprador já confirmou. Falta o vendedor.', 'info');
  }

  /**
   * Atalho de QA: conclui a transação para testar o modal de avaliação
   * sem depender de todo o passo a passo manual.
   */
  forceCompleteForFeedbackTest(): void {
    if (!this.devMode || this.inviteAccessBlocked || this.isFlowLocked()) {
      return;
    }
    this.flowStep = 'delivery_confirmed';
    this.buyerConfirmed = true;
    this.sellerConfirmed = true;
    this.pushUserActionBubble('[Teste] Confirmando transação para validar o modal de avaliação.');
    this.tryMutualRelease();
  }

  private pushUserActionBubble(text: string): void {
    this.chatMessages = [
      ...this.chatMessages,
      { id: Date.now(), sender: this.myChatRole(), text, time: this.currentTime() },
    ];
    this.scrollToChatBottom();
    this.persistTransactionProgress();
  }

  private advanceFlow(nextStep: FlowStep, botReply: string, userAction?: string, counterpartyEcho?: string): void {
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
    if (counterpartyEcho) {
      const showOrderCardAfterCounterpartyJoin = nextStep === 'ticket_confirmed';
      this.scheduleCounterpartyReply(
        counterpartyEcho,
        900,
        showOrderCardAfterCounterpartyJoin ? () => this.pushProductDataCardMessage() : undefined,
      );
    }
  }

  private pushProductDataCardMessage(): void {
    const productCard = this.buildProductCardPayload();
    this.chatMessages = [
      ...this.chatMessages,
      {
        id: Date.now(),
        sender: 'chatbot',
        text: '',
        time: this.currentTime(),
        productCard,
      },
    ];
    this.scrollToChatBottom();
    this.persistTransactionProgress();
  }

  private buildProductCardPayload(): MmProductCardPayload {
    const snap = this.orderSnapshot;
    const rawTitle = snap?.title?.trim() ? normalizeFreeText(snap.title) : '';
    const title = rawTitle.length ? (rawTitle.length > 300 ? rawTitle.slice(0, 300) : rawTitle) : 'Negociação';
    const amountLabel =
      snap && Number.isFinite(snap.amount) ? this.formatOrderMoney(snap.amount, snap.currency) : '—';
    const disputeWindowLine = `Janela de contestação: ${this.securityWindowHours} h`;
    return {
      title,
      amountLabel,
      typeLabel: this.typeLabel(),
      deliveryLabel: this.deliveryLabel(),
      buyerLabel: this.roleAttributionLineForProductCard('buyer'),
      sellerLabel: this.roleAttributionLineForProductCard('seller'),
      disputeWindowLine,
    };
  }

  private formatOrderMoney(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  private roleAttributionLineForProductCard(role: 'buyer' | 'seller'): string {
    const myIsBuyer = this.transactionSide === 'buy';
    const isMe = (role === 'buyer' && myIsBuyer) || (role === 'seller' && !myIsBuyer);
    const name = this.authService.userDisplayName()?.trim();
    if (isMe) {
      return name ? `Você — ${name}` : 'Você (esta sessão)';
    }
    const peer = this.counterpartyPeerName?.trim();
    if (peer) {
      return `${peer} (${role === 'buyer' ? 'comprador' : 'vendedor'})`;
    }
    return `Outra parte (${role === 'buyer' ? 'comprador' : 'vendedor'})`;
  }

  confirmTicketCreated(): void {
    if (this.flowInteractionDisabled() || !this.isNegotiationHost) {
      return;
    }
    this.advanceFlow(
      'ticket_confirmed',
      'Verifiquem juntos o resumo, a entrega e os papéis. Em caso de divergência, alinhem no chat antes do pagamento.',
      'Convite enviado — continuar.',
      'Entrei pelo convite — seguimos na mesma negociação.',
    );
  }

  /** Quem entrou só pelo convite (não envia link neste passo). */
  confirmTicketCreatedAsGuest(): void {
    if (this.flowInteractionDisabled() || this.isNegotiationHost) {
      return;
    }
    this.advanceFlow(
      'ticket_confirmed',
      'Confirmem se entrega, valores e papéis batem com o combinado. Ajustem no chat, se necessário, antes do pagamento em custódia.',
      'Entrada confirmada — seguir.',
      'Estou na mesma negociação.',
    );
  }

  confirmTicketDetails(): void {
    if (this.flowInteractionDisabled()) {
      return;
    }
    const bot =
      this.transactionSide === 'buy'
        ? 'Agora, como comprador, escolha a forma de pagamento (PIX, cartão, boleto ou carteira), gere o QR aqui, pague no app e confirme nesta tela quando concluir. O valor fica em custódia até a entrega e as confirmações finais.'
        : 'Agora o comprador escolhe como paga, gera o QR neste chat e confirma quando pagar. Você, vendedor, só acompanha o mesmo código aqui — não escolhe o método nem confirma o pagamento no lugar dele.';
    this.advanceFlow(
      'payment_escrow',
      bot,
      'Confere para mim — os dados batem.',
      'Concordo; do meu lado também está alinhado com o combinado.',
    );
  }

  confirmPaymentEscrow(): void {
    if (this.flowInteractionDisabled()) {
      return;
    }
    if (this.transactionSide !== 'buy') {
      this.toastService.show('Pagamento', 'Nesta etapa, apenas quem está comprando confirma o pagamento.', 'info');
      return;
    }
    if (!this.paymentQrDataUrl) {
      this.toastService.show('Ative o pagamento', 'Gere o código de pagamento antes de confirmar.', 'warning');
      return;
    }
    const bot =
      'Pagamento em custódia confirmado. Vendedor: registre a entrega (prints, comprovantes, código de leitura no chat) conforme o combinado. Comprador: acompanhe e use os comprovantes quando fizer sentido. Podem ainda gerar o código de entrega aqui, se forem alinhar a confirmação em duas etapas.';
    this.advanceFlow(
      'delivery',
      bot,
      'Já paguei — seguir para a entrega.',
      'Vi o pagamento confirmado; preparo a entrega do meu lado.',
    );
  }

  selectEscrowPaymentMethod(id: EscrowPaymentMethodId): void {
    if (this.flowInteractionDisabled() || this.transactionSide !== 'buy') {
      return;
    }
    this.selectedEscrowPayment = id;
    this.paymentQrDataUrl = '';
    this.persistTransactionProgress();
  }

  async generateEscrowPaymentQr(): Promise<void> {
    if (this.flowInteractionDisabled()) {
      return;
    }
    if (this.transactionSide !== 'buy' || !this.selectedEscrowPayment) {
      this.toastService.show('Escolha seu método', 'Selecione como deseja pagar para continuar.', 'warning');
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
          text: `Código de pagamento (${this.escrowPaymentMethodLabel()}) abaixo. Comprador: conclua no meio indicado. Vendedor: acompanha o mesmo código neste painel.`,
          time,
        },
      ];
      this.scrollToChatBottom();
      this.persistTransactionProgress();
      this.scheduleCounterpartyReply(
        'Código visível do meu lado. Pode concluir o pagamento no seu banco ou carteira.',
        1100,
      );
      this.toastService.show('Pagamento pronto', 'Seu código de pagamento já está disponível.', 'success');
    } catch {
      this.toastService.show('Não foi dessa vez', 'Não conseguimos gerar o código agora.', 'warning');
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
    const gateHint = this.transactionGate ? `GATE:${this.transactionGate.slice(0, 8)}` : 'GATE:—';
    return [
      'MMESCROW',
      `TX:${this.transactionId}`,
      gateHint,
      `PAY:${method}`,
      `SIDE:buy`,
      `TS:${Date.now()}`,
      'STATUS:awaiting_gateway',
    ].join('|');
  }

  private async qrDataUrlFromText(text: string, pixelWidth = 220): Promise<string> {
    const QRCode = (await import('qrcode')).default;
    return QRCode.toDataURL(text, {
      width: pixelWidth,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  }

  /** Vendedor conclui o passo de entrega (registros, anexos e/ou “tudo entregue”). */
  confirmDeliveryStepComplete(): void {
    if (this.flowInteractionDisabled() || this.transactionSide !== 'sell') {
      return;
    }
    this.advanceFlow(
      'delivery_confirmed',
      'Cada um confirma o seu lado neste passo. Com ambas as confirmações, o valor segue para o vendedor.',
      'Entrega concluída do meu lado.',
      'Registro recebido. Sigo para a minha confirmação.',
    );
    this.toastService.show('Próximo passo', 'Confirmações pendentes em ambas as sessões.', 'success');
  }

  generateDeliveryQr(): void {
    if (this.flowInteractionDisabled() || this.transactionSide !== 'sell') {
      return;
    }
    this.deliveryQrToken = `QR-DEL-${Date.now().toString().slice(-8)}`;
    this.pushUserActionBubble('Código de entrega gerado.');
    this.toastService.show('Código disponível', 'Indique-o ao comprador para confirmação na sessão dele.', 'info');
  }

  simulateQrScan(): void {
    if (this.flowInteractionDisabled() || this.transactionSide !== 'buy') {
      return;
    }
    this.advanceFlow(
      'delivery_confirmed',
      'Código lido. Cada pessoa confirma abaixo o seu papel, conforme a sessão.',
      'Código de entrega confirmado.',
      'Do meu lado está ok para confirmar.',
    );
    this.toastService.show('Confirmação', 'Cada um confirma no próprio aparelho.', 'info');
  }

  confirmByBuyer(): void {
    if (this.flowInteractionDisabled()) return;
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
    if (this.flowInteractionDisabled()) return;
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
        text: 'Confirmações concluídas. O valor segue para o vendedor. Processo encerrado nesta sala.',
        time: this.currentTime(),
      },
    ];
    this.scrollToChatBottom();
    this.toastService.show('Concluído', 'O fluxo desta transação foi finalizado.', 'success');
    this.persistTransactionProgress();
    this.openFeedbackModalIfNeeded();
  }

  private feedbackStorageKey(): string {
    return 'mm-profile-feedback:v1';
  }

  private readFeedbackEntries(): ProfileFeedbackEntry[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.feedbackStorageKey());
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry): entry is ProfileFeedbackEntry => {
        if (!entry || typeof entry !== 'object') return false;
        const o = entry as Record<string, unknown>;
        return (
          typeof o['transactionId'] === 'string' &&
          (o['fromRole'] === 'buyer' || o['fromRole'] === 'seller') &&
          (o['toRole'] === 'buyer' || o['toRole'] === 'seller') &&
          (o['vote'] === 'like' || o['vote'] === 'dislike') &&
          typeof o['createdAt'] === 'string' &&
          (o['comment'] === undefined || typeof o['comment'] === 'string')
        );
      });
    } catch {
      return [];
    }
  }

  private saveFeedbackEntries(entries: ProfileFeedbackEntry[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.feedbackStorageKey(), JSON.stringify(entries));
    } catch {
      /* quota */
    }
  }

  private counterpartyRole(): 'buyer' | 'seller' {
    return this.transactionSide === 'buy' ? 'seller' : 'buyer';
  }

  private currentUserRole(): 'buyer' | 'seller' {
    return this.transactionSide === 'buy' ? 'buyer' : 'seller';
  }

  private refreshCounterpartyFeedbackState(): void {
    const all = this.readFeedbackEntries();
    const toRole = this.counterpartyRole();
    const forCounterparty = all.filter((entry) => entry.toRole === toRole);
    const likes = forCounterparty.filter((entry) => entry.vote === 'like').length;
    const dislikes = forCounterparty.filter((entry) => entry.vote === 'dislike').length;
    const comments = forCounterparty
      .map((entry) => (entry.comment ?? '').trim())
      .filter((comment) => comment.length > 0)
      .slice(-3)
      .reverse();
    this.counterpartyFeedbackSummary = { likes, dislikes, comments };
    this.feedbackAlreadySubmitted = all.some(
      (entry) => entry.transactionId === this.transactionId && entry.fromRole === this.currentUserRole(),
    );
  }

  openFeedbackModalIfNeeded(): void {
    if (!this.isFlowLocked()) return;
    this.refreshCounterpartyFeedbackState();
    if (this.feedbackAlreadySubmitted) return;
    this.feedbackVote = null;
    this.feedbackComment = '';
    this.showFeedbackModal = true;
  }

  closeFeedbackModal(): void {
    this.showFeedbackModal = false;
  }

  chooseFeedbackVote(vote: ProfileFeedbackVote): void {
    this.feedbackVote = vote;
  }

  submitProfileFeedback(): void {
    if (!this.isFlowLocked() || !this.feedbackVote) return;
    const all = this.readFeedbackEntries();
    const fromRole = this.currentUserRole();
    const existing = all.findIndex(
      (entry) => entry.transactionId === this.transactionId && entry.fromRole === fromRole,
    );
    if (existing >= 0) {
      this.feedbackAlreadySubmitted = true;
      this.showFeedbackModal = false;
      return;
    }
    const normalizedComment = clampText(normalizeFreeText(this.feedbackComment), 300);
    all.push({
      transactionId: this.transactionId,
      fromRole,
      toRole: this.counterpartyRole(),
      vote: this.feedbackVote,
      comment: normalizedComment || undefined,
      createdAt: new Date().toISOString(),
    });
    this.saveFeedbackEntries(all);
    this.refreshCounterpartyFeedbackState();
    this.showFeedbackModal = false;
    this.toastService.show('Avaliação enviada', 'Obrigado por avaliar a contraparte.', 'success');
  }

  addTypedDeliveryEvidence(): void {
    if (this.flowInteractionDisabled()) return;
    if (this.flowStep !== 'delivery' || this.transactionSide !== 'sell') {
      return;
    }
    this.evidenceControl.markAsTouched();
    if (this.evidenceControl.invalid) {
      this.toastService.show('Falta descrição', 'Descreva com mais detalhes para salvar seu registro.', 'warning');
      return;
    }
    const content = clampText(this.evidenceControl.value ?? '', 500);
    if (!content) return;
    const evidenceCategoryLabels: Record<'print' | 'ownership' | 'other', string> = {
      print: 'Print ou log',
      ownership: 'Titularidade',
      other: 'Outro',
    };
    const title = `[${evidenceCategoryLabels[this.digitalEvidenceCategory]}] ${content}`;
    this.evidences = [
      ...this.evidences,
      { id: Date.now(), title, type: 'Registro digitado', date: 'Agora', step: 'delivery' },
    ];
    const preview = title.length > 160 ? `${title.slice(0, 157)}…` : title;
    this.pushUserActionBubble(`Registro salvo: ${preview}`);
    this.evidenceControl.reset('');
    this.evidenceControl.markAsUntouched();
    this.toastService.show('Registro salvo', 'Seu registro ficou guardado no histórico da negociação.', 'info');
  }

  setEvidenceCategory(cat: 'print' | 'ownership' | 'other'): void {
    if (this.flowInteractionDisabled()) return;
    this.digitalEvidenceCategory = cat;
    this.persistTransactionProgress();
  }

  /** Um único fluxo: compartilhar nativo (mobile/desktop) ou copiar o link. */
  async sendInviteLink(): Promise<void> {
    await this.shareInviteLink();
  }

  async shareInviteLink(): Promise<void> {
    const url = this.inviteLink;
    if (!url) {
      this.toastService.show('Compartilhamento', 'Ainda não há link disponível para enviar.', 'warning');
      return;
    }
    const title = 'Negociação — pagamento protegido';
    const otherRole = this.transactionSide === 'sell' ? 'comprador' : 'vendedor';
    const text = `Acesso como ${otherRole}. Ref. ${this.inviteToken}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        this.pushUserActionBubble('Compartilhamento concluído pelo sistema.');
        this.toastService.show('Enviado', 'O destinatário pode abrir o link recebido.', 'success');
        return;
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
          return;
        }
      }
    }

    await this.copyInviteLink();
  }

  async copyInviteLink(): Promise<void> {
    const url = this.inviteLink;
    if (!url) {
      this.toastService.show('Compartilhamento', 'Ainda não há link disponível para copiar.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.pushUserActionBubble('Link copiado para a área de transferência.');
      this.toastService.show('Link copiado', 'Cole no canal acordado com a outra parte.', 'success');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.pushUserActionBubble('Link copiado (método alternativo).');
        this.toastService.show('Link copiado', 'Envie pelo canal de confiança habitual.', 'success');
      } catch {
        this.toastService.show('Compartilhamento', 'Não conseguimos copiar automaticamente. Copie o endereço manualmente.', 'warning');
      }
    }
  }

  async copyInviteCode(): Promise<void> {
    const code = this.inviteShortCode;
    if (!code) {
      this.toastService.show('Código do convite', 'O código ainda não está disponível nesta sessão.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(code.replace('-', ''));
      this.pushUserActionBubble(`Copiei o código de convite (${code}).`);
      this.toastService.show('Código copiado', 'Código de convite copiado com sucesso.', 'success');
    } catch {
      this.toastService.show('Código do convite', 'Não foi possível copiar automaticamente agora.', 'warning');
    }
  }

  /** Sai da tela mantendo o progresso salvo neste navegador (sessionStorage). */
  exitToDashboard(): void {
    this.pendingConfirmAction = 'exit';
    this.showConfirmationModal = true;
  }

  /** Remove o snapshot local desta transacao e volta ao painel. */
  cancelNegotiation(): void {
    this.pendingConfirmAction = 'cancel';
    this.showConfirmationModal = true;
  }

  closeConfirmationModal(): void {
    this.showConfirmationModal = false;
    this.pendingConfirmAction = null;
  }

  confirmPendingAction(): void {
    const action = this.pendingConfirmAction;
    this.showConfirmationModal = false;
    this.pendingConfirmAction = null;
    if (action === 'exit') {
      void this.router.navigate(['/dashboard']);
      return;
    }
    if (action !== 'cancel') return;
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(this.persistStorageKey());
      } catch {
        /* ignore */
      }
    }
    this.toastService.show('Tudo certo', 'Você saiu desta negociação neste dispositivo.', 'info');
    void this.router.navigate(['/dashboard']);
  }

  sendMessage(): void {
    if (this.flowInteractionDisabled()) return;
    this.draftControl.markAsTouched();
    if (this.draftControl.invalid) {
      this.toastService.show('Mensagem incompleta', 'Escreva uma mensagem um pouco maior para enviar.', 'warning');
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
    const ack = this.randomCounterpartyAck();
    this.scheduleCounterpartyReply(ack, 650 + Math.floor(Math.random() * 550));
  }

  private randomCounterpartyAck(): string {
    const pool = [
      'Certo, vi sua mensagem.',
      'Combinado, sigo alinhado.',
      'Ok por aqui também.',
      'Entendido — qualquer novidade aviso.',
      'Certo, anotei.',
    ];
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  isFlowLocked(): boolean {
    return this.flowStep === 'released';
  }

  private applyFlowLockToForm(): void {
    if (!this.isFlowLocked()) return;
    this.draftControl.disable({ emitEvent: false });
    this.evidenceControl.disable({ emitEvent: false });
  }

  currentStepIndex(): number {
    return FLOW_STEPS_DEF.findIndex((s) => s.id === this.flowStep);
  }

  guideProgressPercent(): number {
    const i = this.currentStepIndex();
    if (i < 0) return 0;
    return Math.round(((i + 1) / FLOW_STEPS_DEF.length) * 100);
  }

  /** Resumo do status da negociação no painel fixo (ambos veem o mesmo texto). */
  transactionStatusLabel(): string {
    const statusLabels: Record<TransactionStatus, string> = {
      pending: 'Em curso: abertura / pagamento',
      paid: 'Em curso: entrega',
      completed: 'Concluída',
      dispute: 'Em disputa',
    };
    return statusLabels[this.currentStatus];
  }

  mutualBuyerLine(): string {
    if (this.flowStep === 'released' || this.buyerConfirmed) return 'Confirmado';
    if (this.flowStep === 'delivery_confirmed') return 'Aguardando confirmação';
    return 'Ainda não';
  }

  mutualSellerLine(): string {
    if (this.flowStep === 'released' || this.sellerConfirmed) return 'Confirmado';
    if (this.flowStep === 'delivery_confirmed') return 'Aguardando confirmação';
    return 'Ainda não';
  }

  mutualBuyerCompact(): string {
    const status = this.mutualBuyerLine();
    const label =
      this.transactionSide === 'buy'
        ? (this.authService.userDisplayName() ?? 'Comprador')
        : 'Comprador';
    return `${label}: ${status}`;
  }

  mutualSellerCompact(): string {
    const status = this.mutualSellerLine();
    const label =
      this.transactionSide === 'sell'
        ? (this.authService.userDisplayName() ?? 'Vendedor')
        : 'Vendedor';
    return `${label}: ${status}`;
  }

  /** Papel explícito nesta sessão (comprador ou vendedor). */
  roleLabel(): string {
    return this.transactionSide === 'buy' ? 'Comprador' : 'Vendedor';
  }

  roleLabelLower(): string {
    return this.transactionSide === 'buy' ? 'comprador' : 'vendedor';
  }

  /** Cabeçalho: nome + papel (se houver nome), tipo e fase — alinhado ao painel lateral, sem ambiguidade. */
  headerParticipantSummary(): string {
    const name = this.authService.userDisplayName()?.trim();
    const role = this.roleLabel();
    const identity = name ? `${name} · ${role}` : role;
    return `${identity} · ${this.typeLabel()} · ${this.transactionStatusLabel()}`;
  }

  /** Painel lateral — coluna “Você”: nome e papel entre parênteses, ou só o papel. */
  asideYouLine(): string {
    const name = this.authService.userDisplayName()?.trim();
    const role = this.roleLabel();
    return name ? `${name} (${role})` : role;
  }

  typeLabel(): string {
    return 'Pagamento protegido';
  }

  deliveryLabel(): string {
    return 'Conforme combinado no chat';
  }

  sideLabel(): string {
    const name = this.authService.userDisplayName();
    if (name) return name;
    return this.transactionSide === 'buy' ? 'Compra' : 'Venda';
  }

  senderLabel(sender: 'buyer' | 'seller' | 'chatbot'): string {
    if (sender === 'chatbot') return 'Guia';
    const meBuy = this.transactionSide === 'buy';
    const name = this.authService.userDisplayName();
    if (sender === 'buyer') {
      return meBuy ? (name ?? 'Comprador') : 'Comprador';
    }
    return meBuy ? 'Vendedor' : (name ?? 'Vendedor');
  }

  private currentTime(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }

  selectionCardClass(active: boolean): string {
    const base =
      'flex size-[4.875rem] flex-none flex-col items-center justify-center gap-1 rounded-mm border p-2 text-center text-[11px] font-semibold leading-tight transition sm:size-[5.25rem] sm:text-xs';
    return active
      ? `${base} border-mm-purple-dark bg-mm-surface shadow-sm ring-1 ring-violet-200/60`
      : `${base} border-slate-200 bg-white hover:border-violet-300`;
  }

  evidenceCategoryCardClass(cat: 'print' | 'ownership' | 'other'): string {
    if (this.flowInteractionDisabled()) {
      return 'flex size-[4.875rem] flex-none cursor-not-allowed flex-col items-center justify-center gap-1 rounded-mm border border-slate-200 bg-slate-100 p-2 text-center text-[11px] font-semibold leading-tight opacity-60 sm:size-[5.25rem] sm:text-xs';
    }
    return this.selectionCardClass(this.digitalEvidenceCategory === cat);
  }

  actionCardClass(enabled: boolean): string {
    const base =
      'flex size-[4.875rem] flex-none flex-col items-center justify-center gap-1 rounded-mm border p-2 text-center text-[11px] font-semibold leading-tight transition sm:size-[5.25rem] sm:text-xs';
    if (!enabled) {
      return `${base} cursor-not-allowed border-slate-200 bg-slate-100 opacity-60`;
    }
    return `${base} border-slate-200 bg-white hover:border-violet-300`;
  }

  primaryReleaseCardClass(): string {
    const base =
      'flex size-[4.875rem] flex-none flex-col items-center justify-center gap-1 rounded-mm border p-2 text-center text-[11px] font-semibold leading-tight transition sm:size-[5.25rem] sm:text-xs';
    if (this.flowInteractionDisabled()) {
      return `${base} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400`;
    }
    return `${base} border-amber-400/55 bg-gradient-to-br from-amber-50 via-mm-surface to-violet-50/90 text-mm-ink shadow-sm ring-1 ring-amber-200/50 hover:brightness-[1.02]`;
  }

}

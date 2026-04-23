import { TransactionSide, TransactionStatus } from './transaction.model';

/** Perfil público de outro utilizador (sem dados sensíveis). Alinhado com futura API. */
export interface PublicUserProfile {
  userId: string;
  displayName: string;
  verified: boolean;
  /** ISO date (YYYY-MM-DD), opcional */
  memberSince?: string;
  completedDealsCount?: number;
}

/** Item da lista estilo “conversa” / inbox. */
export interface NegotiationThread {
  transactionId: string;
  title: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  lastActivityAt: string;
  previewLine: string;
  myRole: TransactionSide;
  counterpart: PublicUserProfile;
}

/** Resposta da busca unificada (transações + utilizadores sem negociação contigo). */
export interface DashboardSearchResult {
  threads: NegotiationThread[];
  /** Perfis públicos com quem ainda não há thread (ex.: primeiro contacto). */
  directoryUsers: PublicUserProfile[];
}

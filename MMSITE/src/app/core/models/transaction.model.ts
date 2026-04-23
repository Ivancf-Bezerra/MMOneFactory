/**
 * Prazo padrao de contestacao (horas), definido pela plataforma conforme legislacao
 * e políticas aplicáveis. Não exposto como escolha do usuário ao criar a negociação.
 */
export const PLATFORM_DISPUTE_WINDOW_HOURS = 48;

export type TransactionStatus = 'pending' | 'paid' | 'completed' | 'dispute';
export type TransactionSide = 'buy' | 'sell';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  currency: string;
  buyerName: string;
  sellerName: string;
  status: TransactionStatus;
  createdAt: string;
  deliveryDetails?: string;
  side?: TransactionSide;
}

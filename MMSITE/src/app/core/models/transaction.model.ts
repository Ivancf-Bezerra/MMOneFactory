/**
 * Prazo padrao de contestacao (horas), definido pela plataforma conforme legislacao
 * e politicas aplicaveis. Nao exposto como escolha do usuario na abertura do ticket.
 */
export const PLATFORM_DISPUTE_WINDOW_HOURS = 48;

export type TransactionStatus = 'pending' | 'paid' | 'completed' | 'dispute';
export type TransactionType = 'physical' | 'digital';
export type DeliveryMethod = 'shipping' | 'pickup' | 'download' | 'email' | 'access';
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
  transactionType?: TransactionType;
  deliveryMethod?: DeliveryMethod;
  deliveryDetails?: string;
  side?: TransactionSide;
}

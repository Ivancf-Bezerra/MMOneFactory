/** Notificações in-app (persistidas localmente; alinhável a API futura). */
export type AppNotificationKind = 'invite_sent' | 'invite_received' | 'transaction_status' | 'system';

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  transactionId?: string;
  /** Caminho relativo com query (ex.: `/transaction/TRX-abc?gate=...`) para abrir na app. */
  href?: string;
}

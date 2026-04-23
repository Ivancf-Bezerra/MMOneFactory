import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppNotification } from '../models/app-notification.model';
import { randomHex } from '../utils/random-token';
import { AuthService } from './auth.service';

type NotificationStore = {
  byKey: Record<string, AppNotification[]>;
};

const STORAGE_KEY = 'mm_app_notifications_v1';
const MAX_PER_USER = 80;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly _notifications = new BehaviorSubject<AppNotification[]>([]);

  readonly notifications$ = this._notifications.asObservable();
  /** Todas as entradas listadas são pendentes; ao “ver” removemos do armazenamento. */
  readonly unreadCount$ = this._notifications.pipe(map((list) => list.length));

  constructor() {
    this.refreshCurrentUser();
  }

  refreshCurrentUser(): void {
    this._notifications.next(this.readListForKey(this.auth.getNotificationRecipientKey()));
  }

  /** Remove uma notificação depois de vista (abrir link ou dispensar). */
  markRead(id: string): void {
    const key = this.auth.getNotificationRecipientKey();
    const store = this.readStore();
    const list = store.byKey[key] ?? [];
    store.byKey[key] = list.filter((n) => n.id !== id);
    this.writeStore(store);
    this.refreshCurrentUser();
  }

  /** Limpa todas as pendentes do utilizador atual. */
  markAllRead(): void {
    const key = this.auth.getNotificationRecipientKey();
    const store = this.readStore();
    store.byKey[key] = [];
    this.writeStore(store);
    this.refreshCurrentUser();
  }

  /**
   * Regista convite enviado ao criador (e cópia “incoming” no ID público do convidado)
   * para o outro lado poder ver o convite se o perfil corresponder (modo demo).
   */
  recordTransactionInvite(params: {
    transactionId: string;
    title: string;
    counterpartUserId: string;
    counterpartName: string;
    creatorDisplayName: string;
    relativeUrl: string;
  }): void {
    const senderKey = this.auth.getNotificationRecipientKey();
    const shortTitle = this.truncate(params.title, 42);
    const sent: AppNotification = {
      id: `ntf-${randomHex(8)}`,
      kind: 'invite_sent',
      title: 'Link enviado',
      body: `${params.counterpartName} · ${params.transactionId} · ${shortTitle}`,
      createdAt: new Date().toISOString(),
      read: false,
      transactionId: params.transactionId,
      href: params.relativeUrl,
    };
    const received: AppNotification = {
      id: `ntf-${randomHex(8)}`,
      kind: 'invite_received',
      title: 'Convite',
      body: `${this.truncate(params.creatorDisplayName, 24)} · ${shortTitle}`,
      createdAt: new Date().toISOString(),
      read: false,
      transactionId: params.transactionId,
      href: params.relativeUrl,
    };
    this.appendToKey(senderKey, sent);
    this.appendToKey(params.counterpartUserId, received);
    this.refreshCurrentUser();
  }

  private readListForKey(key: string): AppNotification[] {
    const store = this.readStore();
    const list = store.byKey[key] ?? [];
    const pending = list.filter((n) => !n.read);
    if (pending.length !== list.length) {
      store.byKey[key] = pending;
      this.writeStore(store);
    }
    return [...pending].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private truncate(text: string, max: number): string {
    const t = text.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  private appendToKey(key: string, item: AppNotification): void {
    const store = this.readStore();
    const next = [item, ...(store.byKey[key] ?? [])];
    store.byKey[key] = next.slice(0, MAX_PER_USER);
    this.writeStore(store);
  }

  private readStore(): NotificationStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { byKey: {} };
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return { byKey: {} };
      const byKey = (parsed as NotificationStore).byKey;
      if (!byKey || typeof byKey !== 'object') return { byKey: {} };
      return { byKey: { ...byKey } };
    } catch {
      return { byKey: {} };
    }
  }

  private writeStore(store: NotificationStore): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* quota */
    }
  }
}

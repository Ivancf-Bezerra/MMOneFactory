import { Injectable } from '@angular/core';

type InviteCodeEntry = {
  code: string;
  href: string;
  transactionId: string;
  createdAt: string;
};

type InviteCodeStore = {
  byCode: Record<string, InviteCodeEntry>;
};

const STORAGE_KEY = 'mm_invite_codes_v1';
const ENTRY_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
const CODE_RE = /^[A-Z]{3}\d{4}$/;

@Injectable({ providedIn: 'root' })
export class InviteCodeService {
  registerInvite(params: { href: string; transactionId: string }): string {
    const store = this.readStore();
    this.pruneExpired(store);

    let code = '';
    for (let i = 0; i < 40; i++) {
      const candidate = this.generateCode();
      if (!store.byCode[candidate]) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      code = this.generateCode();
    }

    store.byCode[code] = {
      code,
      href: params.href,
      transactionId: params.transactionId,
      createdAt: new Date().toISOString(),
    };
    this.writeStore(store);
    return code;
  }

  resolveInviteUrlByCode(rawCode: string): string | null {
    const code = this.normalizeCode(rawCode);
    if (!code || !CODE_RE.test(code)) return null;
    const store = this.readStore();
    this.pruneExpired(store);
    const entry = store.byCode[code];
    this.writeStore(store);
    return entry?.href ?? null;
  }

  normalizeCode(rawCode: string): string {
    return (rawCode ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  formatCode(code: string): string {
    const c = this.normalizeCode(code);
    if (!CODE_RE.test(c)) return c;
    return `${c.slice(0, 3)}-${c.slice(3)}`;
  }

  private generateCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    let code = '';
    for (let i = 0; i < 3; i++) {
      code += letters[Math.floor(Math.random() * letters.length)]!;
    }
    for (let i = 0; i < 4; i++) {
      code += numbers[Math.floor(Math.random() * numbers.length)]!;
    }
    return code;
  }

  private pruneExpired(store: InviteCodeStore): void {
    const now = Date.now();
    for (const [code, entry] of Object.entries(store.byCode)) {
      const created = Date.parse(entry.createdAt);
      if (!Number.isFinite(created) || now - created > ENTRY_TTL_MS) {
        delete store.byCode[code];
      }
    }
  }

  private readStore(): InviteCodeStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { byCode: {} };
      const parsed = JSON.parse(raw) as InviteCodeStore;
      if (!parsed || typeof parsed !== 'object' || !parsed.byCode || typeof parsed.byCode !== 'object') {
        return { byCode: {} };
      }
      return { byCode: { ...parsed.byCode } };
    } catch {
      return { byCode: {} };
    }
  }

  private writeStore(store: InviteCodeStore): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* quota */
    }
  }
}

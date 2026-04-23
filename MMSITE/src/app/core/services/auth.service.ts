import { Injectable } from '@angular/core';
import { randomHex } from '../utils/random-token';

export type VerifiedProfileData = {
  fullName: string;
  cpf: string;
  phone: string;
  birthDate: string;
  documentId: string;
};

export type SetVerifiedProfileResult =
  | { ok: true }
  | { ok: false; code: 'email_required' | 'cpf_in_use'; message: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'mm_access_token';
  private readonly displayNameKey = 'mm_user_display_name';
  private readonly emailKey = 'mm_user_email';
  private readonly verifiedProfileKey = 'mm_verified_profile';
  private readonly verifiedProfilesByEmailKey = 'mm_verified_profiles_by_email';
  private readonly cpfEmailLinksKey = 'mm_cpf_email_links';
  private readonly platformUserIdKey = 'mm_platform_user_id';

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return Boolean(this.token);
  }

  saveToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /** Nome exibido no app (cadastro). */
  setUserDisplayName(name: string): void {
    const t = name.trim();
    if (t) localStorage.setItem(this.displayNameKey, t);
  }

  /** E-mail da sessão (login) — usado só para derivar um nome se não houver cadastro com nome. */
  setUserEmail(email: string): void {
    const t = email.trim().toLowerCase();
    if (!t) return;
    localStorage.setItem(this.emailKey, t);
    this.migrateLegacyVerifiedProfileToEmail(t);
  }

  /**
   * Nome para UI: cadastro, ou parte local do e-mail formatada, ou null.
   */
  userDisplayName(): string | null {
    const stored = localStorage.getItem(this.displayNameKey)?.trim();
    if (stored) return stored;
    const email = localStorage.getItem(this.emailKey);
    if (!email?.includes('@')) return null;
    const local = email.split('@')[0]?.replace(/[._]+/g, ' ').trim();
    if (!local) return null;
    return local.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  setVerifiedProfile(data: VerifiedProfileData): SetVerifiedProfileResult {
    const email = this.currentEmail();
    if (!email) {
      return {
        ok: false,
        code: 'email_required',
        message: 'É necessário estar logado para vincular CPF ao e-mail.',
      };
    }
    const all = this.readVerifiedProfilesByEmail();
    const cpfLinks = this.readCpfEmailLinks();
    const cpf = data.cpf.trim();
    const cpfOwner = cpfLinks[cpf];
    if (cpfOwner && cpfOwner !== email) {
      return {
        ok: false,
        code: 'cpf_in_use',
        message: 'Este CPF já está vinculado a outro e-mail.',
      };
    }

    // Remove vínculo antigo deste e-mail (se usuário alterou CPF).
    const previousCpf = all[email]?.cpf?.trim();
    if (previousCpf && previousCpf !== cpf && cpfLinks[previousCpf] === email) {
      delete cpfLinks[previousCpf];
    }

    all[email] = data;
    cpfLinks[cpf] = email;
    localStorage.setItem(this.verifiedProfilesByEmailKey, JSON.stringify(all));
    localStorage.setItem(this.cpfEmailLinksKey, JSON.stringify(cpfLinks));
    // Mantém compatibilidade temporária com chave antiga.
    localStorage.setItem(this.verifiedProfileKey, JSON.stringify(data));
    return { ok: true };
  }

  getVerifiedProfile(): VerifiedProfileData | null {
    const email = this.currentEmail();
    if (email) {
      const all = this.readVerifiedProfilesByEmail();
      const byEmail = all[email];
      if (this.isValidVerifiedProfile(byEmail)) {
        return byEmail;
      }
    }
    // Fallback legado
    try {
      const raw = localStorage.getItem(this.verifiedProfileKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<VerifiedProfileData>;
      return this.isValidVerifiedProfile(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  isProfileVerified(): boolean {
    return this.getVerifiedProfile() !== null;
  }

  /**
   * Chave para notificações e dados locais por sessão: e-mail quando existir,
   * senão um ID de plataforma estável neste browser.
   */
  getNotificationRecipientKey(): string {
    return this.currentEmail() ?? this.getOrCreatePlatformUserId();
  }

  /** ID anónimo quando ainda não há e-mail (ex.: fluxo interrompido). */
  getOrCreatePlatformUserId(): string {
    let id = localStorage.getItem(this.platformUserIdKey);
    if (!id) {
      id = `usr-${randomHex(6)}`;
      localStorage.setItem(this.platformUserIdKey, id);
    }
    return id;
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.displayNameKey);
    localStorage.removeItem(this.emailKey);
    // Não remove perfis verificados por e-mail para manter persistência entre sessões.
  }

  private currentEmail(): string | null {
    const email = localStorage.getItem(this.emailKey)?.trim().toLowerCase();
    return email && email.includes('@') ? email : null;
  }

  private readVerifiedProfilesByEmail(): Record<string, VerifiedProfileData> {
    try {
      const raw = localStorage.getItem(this.verifiedProfilesByEmailKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return {};
      const result: Record<string, VerifiedProfileData> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!key || typeof key !== 'string') continue;
        if (this.isValidVerifiedProfile(value)) {
          result[key.toLowerCase()] = value;
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  private readCpfEmailLinks(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.cpfEmailLinksKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return {};
      const result: Record<string, string> = {};
      for (const [cpf, email] of Object.entries(parsed)) {
        if (typeof cpf !== 'string' || typeof email !== 'string') continue;
        if (!cpf.trim() || !email.includes('@')) continue;
        result[cpf.trim()] = email.trim().toLowerCase();
      }
      return result;
    } catch {
      return {};
    }
  }

  private isValidVerifiedProfile(data: unknown): data is VerifiedProfileData {
    if (!data || typeof data !== 'object') return false;
    const parsed = data as Partial<VerifiedProfileData>;
    return (
      typeof parsed.fullName === 'string' &&
      typeof parsed.cpf === 'string' &&
      typeof parsed.phone === 'string' &&
      typeof parsed.birthDate === 'string' &&
      typeof parsed.documentId === 'string'
    );
  }

  private migrateLegacyVerifiedProfileToEmail(email: string): void {
    const all = this.readVerifiedProfilesByEmail();
    if (all[email]) return;
    try {
      const raw = localStorage.getItem(this.verifiedProfileKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<VerifiedProfileData>;
      if (!this.isValidVerifiedProfile(parsed)) return;
      all[email] = parsed;
      localStorage.setItem(this.verifiedProfilesByEmailKey, JSON.stringify(all));
      const cpfLinks = this.readCpfEmailLinks();
      if (!cpfLinks[parsed.cpf]) {
        cpfLinks[parsed.cpf] = email;
        localStorage.setItem(this.cpfEmailLinksKey, JSON.stringify(cpfLinks));
      }
    } catch {
      // ignora migração se chave legado estiver inválida
    }
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEndpoints } from '../config/api-endpoints';
import { ApiService } from './api.service';
import {
  MOCK_NEGOTIATION_THREADS,
  MOCK_PUBLIC_PROFILES,
  filterDirectoryUsersMock,
  filterNegotiationThreadsMock,
  sortThreadsByLastActivity,
} from '../data/negotiation-inbox.mock';
import {
  DashboardSearchResult,
  NegotiationThread,
  PublicUserProfile,
} from '../models/negotiation-thread.model';

@Injectable({ providedIn: 'root' })
export class NegotiationInboxService {
  private readonly api = inject(ApiService);

  /**
   * Lista threads do inbox. Com mock: memória local + filtro opcional.
   * Com API: GET inbox com `?q=` quando `search` não vazio.
   */
  listThreads(search?: string): Observable<NegotiationThread[]> {
    const q = search?.trim() ?? '';
    if (environment.negotiationInboxUseMock) {
      return of(filterNegotiationThreadsMock(MOCK_NEGOTIATION_THREADS, q));
    }
    const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.api.get<NegotiationThread[]>(`${ApiEndpoints.negotiations.inbox}${suffix}`).pipe(
      catchError(() => of([])),
    );
  }

  /** Perfil público da contraparte (sem CPF/documentos). */
  getPublicProfile(userId: string): Observable<PublicUserProfile | null> {
    if (environment.negotiationInboxUseMock) {
      const p = MOCK_PUBLIC_PROFILES[userId];
      return of(p ?? null);
    }
    return this.api.get<PublicUserProfile>(ApiEndpoints.users.publicProfile(userId)).pipe(
      catchError(() => of(null)),
    );
  }

  /** Ordena por atividade mais recente (útil se a API devolver ordem arbitrária). */
  sortByLastActivity(threads: NegotiationThread[]): NegotiationThread[] {
    return sortThreadsByLastActivity(threads);
  }

  /** Encadeia ordenação após listagem. */
  listThreadsSorted(search?: string): Observable<NegotiationThread[]> {
    return this.listThreads(search).pipe(map((t) => this.sortByLastActivity(t)));
  }

  /**
   * Diretório para convidar outra parte (criar transação / pesquisa inicial).
   * Só inclui utilizadores com identidade verificada (regra de produto).
   */
  searchVerifiedDirectoryUsersForInvite(search?: string): Observable<PublicUserProfile[]> {
    const q = search?.trim() ?? '';
    if (environment.negotiationInboxUseMock) {
      return of(filterDirectoryUsersMock(q));
    }
    const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.api
      .get<PublicUserProfile[]>(`${ApiEndpoints.users.directoryVerified}${suffix}`)
      .pipe(catchError(() => of([])));
  }

  /**
   * Busca unificada: negociações existentes + utilizadores com perfil público com quem ainda não tem thread
   * (primeiro contacto). Com API: GET `/negotiations/dashboard-search?q=`.
   */
  dashboardSearch(search?: string): Observable<DashboardSearchResult> {
    const q = search?.trim() ?? '';
    if (environment.negotiationInboxUseMock) {
      const threads = sortThreadsByLastActivity(filterNegotiationThreadsMock(MOCK_NEGOTIATION_THREADS, q));
      const directoryUsers = filterDirectoryUsersMock(q);
      return of({ threads, directoryUsers });
    }
    const suffix = `?q=${encodeURIComponent(q)}`;
    return this.api
      .get<DashboardSearchResult>(`${ApiEndpoints.negotiations.dashboardSearch}${suffix}`)
      .pipe(catchError(() => of({ threads: [], directoryUsers: [] })));
  }
}

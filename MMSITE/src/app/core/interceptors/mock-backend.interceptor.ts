import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { isDevMode } from '@angular/core';
import { Observable, of } from 'rxjs';

import {
  MOCK_NEGOTIATION_THREADS,
  MOCK_PUBLIC_PROFILES,
  filterDirectoryUsersMock,
  filterNegotiationThreadsMock,
  sortThreadsByLastActivity,
} from '../data/negotiation-inbox.mock';

type MockUser = {
  name: string;
  email: string;
  password: string;
};

type MockTransaction = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  buyerName: string;
  sellerName: string;
  status: 'pending' | 'paid' | 'completed' | 'dispute';
  createdAt: string;
};

const USERS_KEY = 'mm_mock_users_v1';
const TRANSACTIONS_KEY = 'mm_mock_transactions_v1';

function readUsers(): MockUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: MockUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function readTransactions(): MockTransaction[] {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ensureSeedTransactions(): MockTransaction[] {
  const current = readTransactions();
  if (current.length > 0) return current;

  const seed: MockTransaction[] = [
    {
      id: 'TRX-TEST-001',
      title: 'Projeto piloto - website',
      amount: 1500,
      currency: 'BRL',
      buyerName: 'Cliente Teste',
      sellerName: 'Fornecedor Teste',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(seed));
  return seed;
}

function ok<T>(body: T): Observable<HttpEvent<unknown>> {
  return of(new HttpResponse({ status: 200, body }));
}

function unauthorized(): Observable<HttpEvent<unknown>> {
  return of(new HttpResponse({ status: 401, body: { code: 'unauthorized', message: 'Credenciais inválidas.' } }));
}

function conflict(message: string): Observable<HttpEvent<unknown>> {
  return of(new HttpResponse({ status: 409, body: { code: 'conflict', message } }));
}

function notFound(): Observable<HttpEvent<unknown>> {
  return of(new HttpResponse({ status: 404, body: { code: 'not_found', message: 'Endpoint não encontrado no mock.' } }));
}

function buildToken(email: string): string {
  const stamp = Date.now().toString(36);
  return `mock_${stamp}_${email}`;
}

function handleAuthRegister(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const body = (req.body ?? {}) as { name?: string; email?: string; password?: string };
  const name = body.name?.trim() ?? '';
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';

  if (name.length < 3 || !email || password.length < 8) {
    return conflict('Dados inválidos para cadastro.');
  }

  const users = readUsers();
  if (users.some((u) => u.email === email)) {
    return conflict('E-mail já cadastrado no mock.');
  }

  users.push({ name, email, password });
  writeUsers(users);

  return ok({
    accessToken: buildToken(email),
    user: { name, email },
  });
}

function handleAuthLogin(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';

  const user = readUsers().find((u) => u.email === email && u.password === password);
  if (!user) return unauthorized();

  return ok({
    accessToken: buildToken(email),
    user: { name: user.name, email: user.email },
  });
}

function handleAuthGoogle(): Observable<HttpEvent<unknown>> {
  const email = 'google.mock@onefactory.dev';
  const name = 'Usuário Google Mock';
  return ok({
    accessToken: buildToken(email),
    user: { name, email },
  });
}

function handleTransactionsList(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const status = req.params.get('status');
  const all = ensureSeedTransactions();
  const filtered = status ? all.filter((t) => t.status === status) : all;
  return ok(filtered);
}

function parseQueryParam(url: string, key: string): string {
  const qIndex = url.indexOf('?');
  if (qIndex < 0) return '';
  return new URLSearchParams(url.slice(qIndex + 1)).get(key) ?? '';
}

/** GET /api/v1/negotiations/inbox?q= — espelha o contrato da API real (dev, quando inbox não usa mock local). */
function handleNegotiationsInbox(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const q = parseQueryParam(req.url, 'q');
  return ok(filterNegotiationThreadsMock(MOCK_NEGOTIATION_THREADS, q));
}

/** GET /api/v1/negotiations/dashboard-search?q= */
function handleNegotiationsDashboardSearch(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const q = parseQueryParam(req.url, 'q');
  const threads = sortThreadsByLastActivity(filterNegotiationThreadsMock(MOCK_NEGOTIATION_THREADS, q));
  const directoryUsers = filterDirectoryUsersMock(q);
  return ok({ threads, directoryUsers });
}

/** GET /api/v1/users/directory-verified?q= — só utilizadores verificados (convite / pesquisa). */
function handleUsersDirectoryVerified(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const q = parseQueryParam(req.url, 'q');
  return ok(filterDirectoryUsersMock(q));
}

/** GET /api/v1/users/:userId/public-profile */
function handleUserPublicProfile(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const match = req.url.match(/^\/api\/v1\/users\/([^/?]+)\/public-profile(?:\?|$)/);
  if (!match?.[1]) return notFound();
  const id = decodeURIComponent(match[1]);
  const profile = MOCK_PUBLIC_PROFILES[id];
  if (!profile) return notFound();
  return ok(profile);
}

export const mockBackendInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  if (!isDevMode()) return next(req);
  if (!req.url.startsWith('/api/v1/')) return next(req);

  if (req.method === 'POST' && req.url === '/api/v1/auth/register') {
    return handleAuthRegister(req);
  }
  if (req.method === 'POST' && req.url === '/api/v1/auth/login') {
    return handleAuthLogin(req);
  }
  if (req.method === 'POST' && req.url === '/api/v1/auth/google') {
    return handleAuthGoogle();
  }
  if (req.method === 'GET' && req.url.startsWith('/api/v1/transactions')) {
    return handleTransactionsList(req);
  }
  if (req.method === 'GET' && req.url.startsWith('/api/v1/negotiations/dashboard-search')) {
    return handleNegotiationsDashboardSearch(req);
  }
  if (req.method === 'GET' && req.url.startsWith('/api/v1/negotiations/inbox')) {
    return handleNegotiationsInbox(req);
  }
  if (req.method === 'GET' && req.url.startsWith('/api/v1/users/directory-verified')) {
    return handleUsersDirectoryVerified(req);
  }
  if (req.method === 'GET' && /\/api\/v1\/users\/[^/?]+\/public-profile/.test(req.url.split('?')[0] ?? '')) {
    return handleUserPublicProfile(req);
  }

  return notFound();
};

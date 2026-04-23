import { NegotiationThread, PublicUserProfile } from '../models/negotiation-thread.model';

export const MOCK_PUBLIC_PROFILES: Record<string, PublicUserProfile> = {
  'usr-ana-costa': {
    userId: 'usr-ana-costa',
    displayName: 'Ana Costa',
    verified: true,
    memberSince: '2024-01-12',
    completedDealsCount: 14,
  },
  'usr-bruno-silva': {
    userId: 'usr-bruno-silva',
    displayName: 'Bruno Silva',
    verified: true,
    memberSince: '2023-09-03',
    completedDealsCount: 31,
  },
  'usr-carla-mendes': {
    userId: 'usr-carla-mendes',
    displayName: 'Carla Mendes',
    verified: false,
    memberSince: '2025-02-20',
    completedDealsCount: 2,
  },
  'usr-diego-oliveira': {
    userId: 'usr-diego-oliveira',
    displayName: 'Diego Oliveira',
    verified: true,
    memberSince: '2024-06-01',
    completedDealsCount: 8,
  },
  /** Sem thread no mock — aparecem na pesquisa de “ainda não negociou contigo”. */
  'usr-elia-ferreira': {
    userId: 'usr-elia-ferreira',
    displayName: 'Elia Ferreira',
    verified: true,
    memberSince: '2024-11-01',
    completedDealsCount: 5,
  },
  'usr-felipe-nunes': {
    userId: 'usr-felipe-nunes',
    displayName: 'Felipe Nunes',
    verified: false,
    memberSince: '2025-03-10',
    completedDealsCount: 0,
  },
  'usr-gabriela-rios': {
    userId: 'usr-gabriela-rios',
    displayName: 'Gabriela Rios',
    verified: true,
    memberSince: '2023-12-18',
    completedDealsCount: 22,
  },
};

/** Lista inicial alinhada ao seed TRX-TEST-001 do mock-backend e exemplos extra. */
export const MOCK_NEGOTIATION_THREADS: NegotiationThread[] = [
  {
    transactionId: 'TRX-TEST-001',
    title: 'Projeto piloto — website',
    status: 'pending',
    amount: 1500,
    currency: 'BRL',
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    previewLine: 'Enviei o cronograma em anexo. Podemos alinhar o prazo de entrega?',
    myRole: 'buy',
    counterpart: MOCK_PUBLIC_PROFILES['usr-ana-costa']!,
  },
  {
    transactionId: 'TRX-MOCK-002',
    title: 'Licença de software anual',
    status: 'paid',
    amount: 199.9,
    currency: 'BRL',
    lastActivityAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    previewLine: 'Pagamento confirmado. Aguardando liberação do acesso.',
    myRole: 'sell',
    counterpart: MOCK_PUBLIC_PROFILES['usr-bruno-silva']!,
  },
  {
    transactionId: 'TRX-MOCK-003',
    title: 'Equipamento usado — notebook',
    status: 'completed',
    amount: 3200,
    currency: 'BRL',
    lastActivityAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    previewLine: 'Negociação concluída. Obrigada pela transparência!',
    myRole: 'buy',
    counterpart: MOCK_PUBLIC_PROFILES['usr-carla-mendes']!,
  },
  {
    transactionId: 'TRX-MOCK-004',
    title: 'Consultoria de UX — sprint',
    status: 'dispute',
    amount: 2400,
    currency: 'BRL',
    lastActivityAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    previewLine: 'Aberta mediação: divergência no escopo da segunda entrega.',
    myRole: 'sell',
    counterpart: MOCK_PUBLIC_PROFILES['usr-diego-oliveira']!,
  },
];

export function filterNegotiationThreadsMock(threads: NegotiationThread[], query: string): NegotiationThread[] {
  const q = query.trim().toLowerCase();
  if (!q) return threads;
  return threads.filter((t) => {
    const hay = [
      t.transactionId,
      t.title,
      t.previewLine,
      t.counterpart.displayName,
      t.status,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function counterpartUserIdsFromThreads(threads: NegotiationThread[]): Set<string> {
  return new Set(threads.map((t) => t.counterpart.userId));
}

export function sortThreadsByLastActivity(threads: NegotiationThread[]): NegotiationThread[] {
  return [...threads].sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );
}

/**
 * Utilizadores com perfil público que ainda não são contraparte em nenhuma thread mock.
 * Só devolve resultados quando há texto de busca (evita listar toda a rede de uma vez).
 * Regra de produto: apenas contas com identidade verificada entram no diretório pesquisável.
 */
export function filterDirectoryUsersMock(query: string): PublicUserProfile[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const inNegotiation = counterpartUserIdsFromThreads(MOCK_NEGOTIATION_THREADS);
  return Object.values(MOCK_PUBLIC_PROFILES)
    .filter((p) => {
      if (!p.verified) return false;
      if (inNegotiation.has(p.userId)) return false;
      const hay = [p.displayName, p.userId].join(' ').toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
}

export const API_BASE_PATH = '/api/v1';

export const ApiEndpoints = {
  auth: {
    login: `${API_BASE_PATH}/auth/login`,
    register: `${API_BASE_PATH}/auth/register`,
    google: `${API_BASE_PATH}/auth/google`,
    me: `${API_BASE_PATH}/auth/me`,
  },
  transactions: {
    list: `${API_BASE_PATH}/transactions`,
    byId: (id: string) => `${API_BASE_PATH}/transactions/${id}`,
    join: `${API_BASE_PATH}/transactions/join`,
    confirmTicket: (id: string) => `${API_BASE_PATH}/transactions/${id}/confirm-ticket`,
    simulatePayment: (id: string) => `${API_BASE_PATH}/transactions/${id}/simulate-payment`,
    simulateDelivery: (id: string) => `${API_BASE_PATH}/transactions/${id}/simulate-delivery`,
    confirmRelease: (id: string) => `${API_BASE_PATH}/transactions/${id}/confirm-release`,
  },
  /** Inbox estilo conversas — contratos para quando `negotiationInboxUseMock` for false. */
  negotiations: {
    inbox: `${API_BASE_PATH}/negotiations/inbox`,
    /** GET ?q= — devolve { threads, directoryUsers } */
    dashboardSearch: `${API_BASE_PATH}/negotiations/dashboard-search`,
  },
  users: {
    publicProfile: (userId: string) =>
      `${API_BASE_PATH}/users/${encodeURIComponent(userId)}/public-profile`,
    /** GET ?q= — diretório para convite; só utilizadores verificados. */
    directoryVerified: `${API_BASE_PATH}/users/directory-verified`,
  },
} as const;

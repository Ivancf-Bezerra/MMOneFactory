/** Valores por omissão em `ng serve` / build de desenvolvimento. */
export const environment = {
  production: false,
  /**
   * Mostra entrada de demonstração no login (token local, sem backend).
   * Também ativo na build de produção para GitHub Pages — ver `environment.prod.ts`.
   */
  localDemoAuth: true,
  /** Dica com credenciais da MMAPI (`dotnet run` + proxy); desligado no bundle de produção. */
  showLocalApiCredentialsHint: true,
  /**
   * Lista “Minhas negociações”: usa dados mock locais (sem HTTP).
   * Defina `false` quando o backend expuser GET /api/v1/negotiations/inbox e GET users/.../public-profile.
   */
  negotiationInboxUseMock: true,
};

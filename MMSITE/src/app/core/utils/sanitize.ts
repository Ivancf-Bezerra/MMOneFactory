/** Normaliza espaços e remove espaços nas extremidades (texto livre) */
export function normalizeFreeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Evidência / chat: limite de tamanho e trim */
export function clampText(value: string, maxLen: number): string {
  const t = normalizeFreeText(value);
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

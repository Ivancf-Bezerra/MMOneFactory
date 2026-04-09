import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Senha: mínimo 8 caracteres, pelo menos uma letra e um número */
export const passwordStrengthValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = (control.value as string) ?? '';
  if (!v.length) return null;
  if (v.length < 8) return null;
  const hasLetter = /[A-Za-zÀ-ÿ]/.test(v);
  const hasDigit = /\d/.test(v);
  if (!hasLetter || !hasDigit) return { passwordStrength: true };
  return null;
};

/** Valor monetário: obrigatório e >= min */
export function minAmount(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw === null || raw === undefined || raw === '') return { required: true };
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.').trim());
    if (Number.isNaN(n)) return { min: { min, actual: NaN } };
    if (n < min) return { min: { min, actual: n } };
    return null;
  };
}

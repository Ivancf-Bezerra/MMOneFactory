import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Mensagem curta em português para o primeiro erro do controle */
export function controlErrorMessage(control: AbstractControl | null, labels?: { min?: number; max?: number }): string {
  if (!control || !control.errors || !control.touched) return '';

  const e = control.errors as ValidationErrors;

  if (e['required']) return 'Este campo é obrigatório.';
  if (e['email']) return 'Informe um e-mail válido.';
  if (e['minlength']) return `Mínimo de ${e['minlength'].requiredLength} caracteres.`;
  if (e['maxlength']) return `Máximo de ${e['maxlength'].requiredLength} caracteres.`;
  if (e['min']) {
    const minVal = labels?.min ?? e['min'].min;
    return `Valor mínimo: ${minVal}.`;
  }
  if (e['max']) {
    const maxVal = labels?.max ?? e['max'].max;
    return `Valor máximo: ${maxVal}.`;
  }
  if (e['pattern']) return 'Formato inválido para este campo.';
  if (e['passwordStrength'])
    return 'A senha deve ter letras e números (mínimo 8 caracteres).';

  return 'Valor inválido.';
}

import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);
  private sequence = 1;

  show(title: string, description: string, type: ToastType = 'info'): void {
    const toast: ToastMessage = {
      id: this.sequence++,
      title,
      description,
      type,
    };

    this.toasts.update((items) => [...items, toast]);
    setTimeout(() => this.dismiss(toast.id), 3500);
  }

  dismiss(id: number): void {
    this.toasts.update((items) => items.filter((toast) => toast.id !== id));
  }
}

import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import {
  LucideCheck,
  LucideClock,
  LucideFlag,
  LucideLock,
} from '@lucide/angular';
import { TransactionStatus } from '../../../core/models/transaction.model';

@Component({
  selector: 'app-status-badge',
  imports: [NgClass, LucideClock, LucideLock, LucideCheck, LucideFlag],
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold"
      [ngClass]="badgeClass"
    >
      @switch (status) {
        @case ('pending') {
          <svg lucideClock class="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
        }
        @case ('paid') {
          <svg lucideLock class="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden="true" />
        }
        @case ('completed') {
          <svg lucideCheck class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        }
        @case ('dispute') {
          <svg lucideFlag class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        }
      }
      {{ statusLabel }}
    </span>
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: TransactionStatus;

  get badgeClass(): string {
    const classMap: Record<TransactionStatus, string> = {
      pending: 'border-slate-200  bg-slate-50   text-slate-600',
      paid: 'border-violet-200 bg-mm-surface text-mm-purple-dark',
      completed: 'border-green-200  bg-green-50   text-green-700',
      dispute: 'border-red-200    bg-red-50     text-red-700',
    };
    return classMap[this.status];
  }

  get statusLabel(): string {
    const labelMap: Record<TransactionStatus, string> = {
      pending: 'Pendente',
      paid: 'Dinheiro guardado',
      completed: 'Concluído',
      dispute: 'Disputa',
    };
    return labelMap[this.status];
  }
}

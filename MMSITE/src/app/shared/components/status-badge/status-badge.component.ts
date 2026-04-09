import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { TransactionStatus } from '../../../core/models/transaction.model';

@Component({
  selector: 'app-status-badge',
  imports: [NgClass],
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold"
      [ngClass]="badgeClass"
    >
      <span class="text-[10px]">{{ iconByStatus }}</span>
      {{ statusLabel }}
    </span>
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: TransactionStatus;

  get badgeClass(): string {
    const classMap: Record<TransactionStatus, string> = {
      pending:   'border-slate-200  bg-slate-50   text-slate-600',
      paid:      'border-blue-200   bg-blue-50    text-blue-700',
      completed: 'border-green-200  bg-green-50   text-green-700',
      dispute:   'border-red-200    bg-red-50     text-red-700',
    };
    return classMap[this.status];
  }

  get iconByStatus(): string {
    const iconMap: Record<TransactionStatus, string> = {
      pending:   '⏳',
      paid:      '🔒',
      completed: '✓',
      dispute:   '⚑',
    };
    return iconMap[this.status];
  }

  get statusLabel(): string {
    const labelMap: Record<TransactionStatus, string> = {
      pending:   'Pendente',
      paid:      'Em custódia',
      completed: 'Concluído',
      dispute:   'Disputa',
    };
    return labelMap[this.status];
  }
}

import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import {
  LucideCheck,
  LucideInfo,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-center',
  imports: [NgClass, LucideCheck, LucideTriangleAlert, LucideInfo, LucideX],
  template: `
    <div class="pointer-events-none fixed bottom-5 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 shadow-md"
          [ngClass]="toastClass(toast.type)"
        >
          <span class="mt-0.5 shrink-0">
            @switch (toast.type) {
              @case ('success') {
                <svg lucideCheck class="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              }
              @case ('warning') {
                <svg lucideTriangleAlert class="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              }
              @case ('info') {
                <svg lucideInfo class="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              }
            }
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold leading-snug">{{ toast.title }}</p>
            @if (toast.description) {
              <p class="mt-0.5 text-xs opacity-80">{{ toast.description }}</p>
            }
          </div>
          <button
            type="button"
            class="mt-0.5 grid shrink-0 place-content-center rounded-md p-0.5 opacity-50 hover:opacity-100"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Fechar"
          >
            <svg lucideX class="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastCenterComponent {
  readonly toastService = inject(ToastService);

  toastClass(type: 'success' | 'warning' | 'info'): string {
    const classMap = {
      success: 'border-green-200  bg-green-50   text-green-900',
      warning: 'border-amber-200  bg-amber-50   text-amber-900',
      info: 'border-violet-200 bg-mm-surface  text-mm-purple-ink',
    };
    return classMap[type];
  }
}

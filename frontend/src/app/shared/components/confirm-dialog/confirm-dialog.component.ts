import { Component, signal, ChangeDetectionStrategy, computed } from '@angular/core';

import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideAlertTriangle, lucideInfo, lucideHelpCircle, lucideTrash2, lucideX, lucideCheck } from '@ng-icons/lucide';

export type DialogType = 'danger' | 'warning' | 'info' | 'question';

export interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: DialogType;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [NgIconComponent],
  providers: [
    provideIcons({ lucideAlertTriangle, lucideInfo, lucideHelpCircle, lucideTrash2, lucideX, lucideCheck })
  ],
  templateUrl: './confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent {
  private resolveFn?: (value: boolean) => void;
  
  isOpen = signal(false);
  options = signal<DialogOptions | null>(null);

  stripeClass = computed(() => {
    const type = this.options()?.type || 'info';
    if (type === 'danger') return 'bg-red-500';
    if (type === 'warning') return 'bg-amber-500';
    if (type === 'question') return 'bg-blue-500';
    return 'bg-inespasa';
  });

  iconBgClass = computed(() => {
    const type = this.options()?.type || 'info';
    if (type === 'danger') return 'bg-red-500 shadow-red-500/20';
    if (type === 'warning') return 'bg-amber-500 shadow-amber-500/20';
    if (type === 'question') return 'bg-blue-500 shadow-blue-500/20';
    return 'bg-inespasa shadow-inespasa/20';
  });

  iconName = computed(() => {
    const type = this.options()?.type || 'info';
    if (type === 'danger') return 'lucideTrash2';
    if (type === 'warning') return 'lucideAlertTriangle';
    if (type === 'question') return 'lucideHelpCircle';
    return 'lucideInfo';
  });

  confirmBtnClass = computed(() => {
    const type = this.options()?.type || 'info';
    if (type === 'danger') return 'bg-red-500 hover:bg-red-600 shadow-red-500/20';
    if (type === 'warning') return 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20';
    if (type === 'question') return 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20';
    return 'bg-inespasa hover:bg-inespasa-dark shadow-inespasa/20';
  });

  open(opts: DialogOptions): Promise<boolean> {
    this.options.set(opts);
    this.isOpen.set(true);
    return new Promise((resolve) => {
      this.resolveFn = resolve;
    });
  }

  confirm() {
    this.isOpen.set(false);
    this.resolveFn?.(true);
  }

  cancel() {
    this.isOpen.set(false);
    this.resolveFn?.(false);
  }
}

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
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" (click)="cancel()"></div>
        
        <!-- Dialog Card -->
        <div class="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
          <!-- Top Accent Stripe -->
          <div class="h-2 w-full" [class]="stripeClass()"></div>
          
          <div class="p-8">
            <div class="flex items-start gap-6">
              <div [class]="iconBgClass()" class="w-14 h-14 rounded-2xl flex-none flex items-center justify-center shadow-lg">
                <ng-icon [name]="iconName()" class="text-2xl text-white"></ng-icon>
              </div>
              
              <div class="space-y-2">
                <h3 class="text-xl font-black text-gray-900 tracking-tight">{{ options()?.title }}</h3>
                <p class="text-sm font-medium text-gray-500 leading-relaxed">{{ options()?.message }}</p>
              </div>
            </div>
            
            <div class="flex items-center gap-3 mt-10">
              <button (click)="cancel()" 
                class="flex-1 px-6 py-3.5 rounded-xl border-2 border-gray-100 text-gray-400 font-black uppercase tracking-widest text-[10px] hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95">
                {{ options()?.cancelText || 'Cancelar' }}
              </button>
              
              <button (click)="confirm()" 
                [class]="confirmBtnClass()"
                class="flex-1 px-6 py-3.5 rounded-xl text-white font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                <ng-icon name="lucideCheck" class="text-sm"></ng-icon>
                {{ options()?.confirmText || 'Confirmar' }}
              </button>
            </div>
          </div>
          
          <!-- Close Button -->
          <button (click)="cancel()" class="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors p-2">
            <ng-icon name="lucideX"></ng-icon>
          </button>
        </div>
      </div>
    }
  `,
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

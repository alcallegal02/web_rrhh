import { Component, input, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'app-loading-spinner',
  imports: [],
  template: `
    <div class="flex flex-col items-center justify-center p-12 animate-fadeIn">
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
        <div class="absolute inset-0 border-4 border-inespasa-dark border-t-transparent rounded-full animate-spin"></div>
      </div>
      @if (message()) {
        <p class="mt-6 text-xs font-black uppercase tracking-[0.2em] text-gray-400 animate-pulse">{{ message() }}</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSpinnerComponent {
  message = input<string>('Sincronizando datos...');
}

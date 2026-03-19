import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-empty-state',
  imports: [NgIconComponent],
  template: `
    <div class="flex flex-col items-center justify-center p-12 text-center animate-fadeIn">
      <div class="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mb-6 relative">
        <div class="absolute inset-0 bg-blue-50 rounded-[2rem] blur-xl opacity-50"></div>
        <ng-icon [name]="icon()" class="text-5xl text-gray-300 relative z-10"></ng-icon>
      </div>
      <h3 class="text-xl font-black text-gray-900 tracking-tight mb-2">{{ title() }}</h3>
      <p class="text-sm font-medium text-gray-500 max-w-sm leading-relaxed">{{ message() }}</p>
      <div class="mt-8">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  icon = input<string>('lucideInbox');
  title = input<string>('Sin datos');
  message = input<string>('No se han encontrado registros en esta sección.');
}

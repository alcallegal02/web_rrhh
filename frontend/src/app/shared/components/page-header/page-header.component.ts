import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';

export interface PageAction {
  label: string;
  icon: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  id: string;
}

@Component({
  selector: 'app-page-header',
  imports: [NgIconComponent],
  templateUrl: './page-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppPageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string>();
  icon = input<string>();
  actions = input<PageAction[]>([]);
  
  actionClick = output<string>();

  getBtnClass(variant: string = 'primary'): string {
    const base = 'border-2 ';
    const classes: Record<string, string> = {
      primary: 'bg-inespasa border-inespasa text-white hover:bg-inespasa-dark hover:border-inespasa-dark shadow-inespasa-light/30',
      secondary: 'bg-white border-gray-100 text-gray-600 hover:border-inespasa-light/30 hover:text-inespasa',
      danger: 'bg-red-50 border-red-50 text-red-600 hover:bg-red-100',
      ghost: 'bg-transparent border-transparent text-gray-400 hover:text-gray-600'
    };
    return base + (classes[variant] || classes['primary']);
  }
}

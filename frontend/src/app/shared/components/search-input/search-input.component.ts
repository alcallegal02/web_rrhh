import { Component, input, output, model, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX } from '@ng-icons/lucide';

@Component({
  selector: 'app-search-input',
  imports: [FormsModule, NgIconComponent],
  providers: [provideIcons({ lucideSearch, lucideX })],
  templateUrl: './search-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchInputComponent {
  value = model<string>('');
  placeholder = input<string>('Buscar...');
}

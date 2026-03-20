import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-empty-state',
  imports: [NgIconComponent],
  templateUrl: './empty-state.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  icon = input<string>('lucideInbox');
  title = input<string>('Sin datos');
  message = input<string>('No se han encontrado registros en esta sección.');
}

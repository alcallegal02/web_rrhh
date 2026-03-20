import { Component, input, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'app-loading-spinner',
  imports: [],
  templateUrl: './loading-spinner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSpinnerComponent {
  message = input<string>('Sincronizando datos...');
}

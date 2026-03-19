import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PolicyBalance } from '../../../../services/vacation.service';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-vacation-balance-widget',
  imports: [RouterModule, NgIconComponent, StatCardComponent],
  templateUrl: './vacation-balance-widget.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacationBalanceWidgetComponent {
  balance = input<PolicyBalance | null>(null);

  getUnitLabel(unit?: string): string {
    if (!unit) return 'Días';
    const labels: { [key: string]: string } = {
      'hours': 'Horas',
      'days_natural': 'Días',
      'days_work': 'Días',
      'weeks': 'Semanas'
    };
    return labels[unit] || 'Días';
  }
}

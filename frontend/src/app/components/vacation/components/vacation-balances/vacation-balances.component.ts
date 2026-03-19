import { Component, computed, input } from '@angular/core';
import { VacationBalance } from '../../../../services/vacation.service';
import { DecimalPipe } from '@angular/common';

@Component({
    selector: 'app-vacation-balances',
    imports: [DecimalPipe],
    templateUrl: './vacation-balances.component.html',
})
export class VacationBalancesComponent {
    balance = input.required<VacationBalance | null>();
    isMaternityVisible = input(false);

    gridColsClass = computed(() => this.isMaternityVisible() ? 'grid-cols-[100px_repeat(9,_1fr)]' : 'grid-cols-[100px_repeat(8,_1fr)]');
    publicBalances = computed(() => this.balance()?.balances.filter(b => b.is_featured) || []);
}

import { Component, input, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { VacationRequest } from '../../../../models/app.models';
import { VacationUtils } from '../../vacation.utils';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-vacation-list',
    imports: [CommonModule, DatePipe, NgIconComponent],
    templateUrl: './vacation-list.component.html',
})
export class VacationListComponent {
    requests = input.required<VacationRequest[]>();
    requestSelected = output<VacationRequest>();

    getIcon = VacationUtils.getIcon;
    getStatusClass = VacationUtils.getStatusClass;

    convertToTime(days: any) {
        // Assuming 8 hours as default if not passed context, 
        // or we can just display raw days if needed. 
        // Ideally pass balance or config, but for list view usually default is fine or 
        // we can try to guess from request. 
        // For now using default 8.
        return VacationUtils.convertToTime(days, 8);
    }

    openRequestDetails(request: VacationRequest) {
        this.requestSelected.emit(request);
    }
}

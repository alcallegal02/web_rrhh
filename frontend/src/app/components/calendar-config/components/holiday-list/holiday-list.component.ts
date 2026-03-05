import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Holiday, HolidayType } from '../../../../interfaces/holiday.interface';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucidePencil, lucideTrash2, lucideInfo } from '@ng-icons/lucide';

@Component({
    selector: 'app-holiday-list',
    imports: [CommonModule, DatePipe, NgIconComponent],
    templateUrl: './holiday-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        provideIcons({ lucidePencil, lucideTrash2, lucideInfo })
    ]
})
export class HolidayListComponent {
    holidays = input.required<Holiday[]>();

    edit = output<Holiday>();
    delete = output<Holiday>();

    HolidayType = HolidayType;

    getBadgeClass(type: HolidayType): string {
        const base = "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ";
        switch (type) {
            case HolidayType.NATIONAL: return base + "bg-red-100 text-red-700";
            case HolidayType.REGIONAL: return base + "bg-blue-100 text-blue-700";
            case HolidayType.LOCAL: return base + "bg-green-100 text-green-700";
            case HolidayType.OTHER: return base + "bg-gray-100 text-gray-700";
            default: return base + "bg-gray-100 text-gray-700";
        }
    }

    getTypeLabel(type: HolidayType): string {
        switch (type) {
            case HolidayType.NATIONAL: return 'Nacional';
            case HolidayType.REGIONAL: return 'Autonómico';
            case HolidayType.LOCAL: return 'Local';
            case HolidayType.OTHER: return 'Otro';
            default: return type;
        }
    }
}

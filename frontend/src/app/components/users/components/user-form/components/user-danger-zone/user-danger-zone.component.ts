import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideTriangleAlert, lucideBan, lucideCheck, lucideTrash, lucideHelpCircle
} from '@ng-icons/lucide';

@Component({
    selector: 'app-user-danger-zone',
    imports: [NgIconComponent],
    templateUrl: './user-danger-zone.component.html',
    providers: [
        provideIcons({
            lucideTriangleAlert, lucideBan, lucideCheck, lucideTrash, lucideHelpCircle
        })
    ]
})
export class UserDangerZoneComponent {
    // Inputs
    userId = input<number | undefined>();
    isActive = input<boolean>(true);
    role = input<string>('');

    // Outputs
    activate = output<void>();
    deactivate = output<void>();
    delete = output<void>();
}

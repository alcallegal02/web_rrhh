import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-user-danger-zone',
    imports: [CommonModule, NgIconComponent],
    templateUrl: './user-danger-zone.component.html',
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

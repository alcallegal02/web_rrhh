import { Component, EventEmitter, Input, Output, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserFormModel } from '../../user-form.component';
import { environment } from '../../../../../../config/environment';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideCamera, lucideUser, lucideImagePlus, lucideHelpCircle
} from '@ng-icons/lucide';

@Component({
    selector: 'app-user-personal-data',
    imports: [FormsModule, NgIconComponent],
    templateUrl: './user-personal-data.component.html',
    providers: [
        provideIcons({
            lucideCamera, lucideUser, lucideImagePlus, lucideHelpCircle
        })
    ]
})
export class UserPersonalDataComponent {
    // Inputs
    form = input.required<UserFormModel>();
    uploadingPhoto = input<boolean>(false);
    previewProfilePicUrl = input<string | null>(null);

    // Outputs
    fieldChange = output<{ field: string; value: any }>();
    photoUpload = output<Event>();

    getFileUrl(path: string | undefined): string {
        if (!path) return '';
        return `${environment.apiUrl}${path}`;
    }

    updateField(field: string, value: any): void {
        this.fieldChange.emit({ field, value });
    }

    onPhotoUpload(event: Event): void {
        this.photoUpload.emit(event);
    }
}

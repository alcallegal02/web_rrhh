import { Component, EventEmitter, Input, Output, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../../config/environment';
import { UserFormModel } from '../../user-form.models';

@Component({
    selector: 'app-user-personal-data',
    imports: [CommonModule, FormsModule],
    templateUrl: './user-personal-data.component.html'
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

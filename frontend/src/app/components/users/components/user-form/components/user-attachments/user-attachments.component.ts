import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../../../config/environment';
import { UserAttachment } from '../../user-form.models';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-user-attachments',
    imports: [CommonModule, NgIconComponent],
    templateUrl: './user-attachments.component.html'
})
export class UserAttachmentsComponent {
    // Inputs
    attachments = input<UserAttachment[]>([]);
    uploadingAttachments = input<boolean>(false);
    isLoading = input<boolean>(false);

    // Outputs
    attachmentsUpload = output<Event>();
    attachmentRemove = output<number>();

    onUploadAttachments(event: Event): void {
        this.attachmentsUpload.emit(event);
    }

    onRemoveAttachment(index: number): void {
        this.attachmentRemove.emit(index);
    }

    getDownloadUrl(fileUrl: string, fileName: string): string {
        return `${environment.apiUrl}${fileUrl}`;
    }
}

import { Component, input, output } from '@angular/core';
import { environment } from '../../../../../../config/environment';
import { UserAttachment } from '../../user-form.models';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucidePaperclip, lucideUpload, lucideX, lucideFolder, lucideHelpCircle
} from '@ng-icons/lucide';

@Component({
    selector: 'app-user-attachments',
    imports: [NgIconComponent],
    templateUrl: './user-attachments.component.html',
    providers: [
        provideIcons({
            lucidePaperclip, lucideUpload, lucideX, lucideFolder, lucideHelpCircle
        })
    ]
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

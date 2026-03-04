import { Component, signal, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';

@Component({
    selector: 'app-complaint-lookup',
    imports: [CommonModule, FormsModule, NgIconComponent],
    templateUrl: './complaint-lookup.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComplaintLookupComponent {
    lookup = output<{ code: string, token: string }>();

    code = signal('');
    token = signal('');

    onLookup() {
        if (this.code() && this.token()) {
            this.lookup.emit({ code: this.code(), token: this.token() });
        }
    }
}

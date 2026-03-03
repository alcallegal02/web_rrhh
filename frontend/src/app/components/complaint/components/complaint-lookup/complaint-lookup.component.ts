import { Component, signal, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-complaint-lookup',
    imports: [CommonModule, FormsModule],
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

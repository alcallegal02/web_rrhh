import { Component, signal, output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideShield } from '@ng-icons/lucide';

@Component({
    selector: 'app-complaint-lookup',
    imports: [FormsModule, NgIconComponent],
    templateUrl: './complaint-lookup.component.html',
    providers: [
        provideIcons({ lucideSearch, lucideShield })
    ],
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

import { Component, input, output, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../../config/environment';
import { UserSummary } from '../../user-form.models';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideNetwork, lucideX, lucideSearch, lucideHelpCircle
} from '@ng-icons/lucide';

// Re-export for convenience
export { UserSummary };

@Component({
    selector: 'app-user-hierarchy-selector',
    imports: [CommonModule, FormsModule, NgIconComponent],
    templateUrl: './user-hierarchy-selector.component.html',
    providers: [
        provideIcons({
            lucideNetwork, lucideX, lucideSearch, lucideHelpCircle
        })
    ]
})
export class UserHierarchySelectorComponent {
    // Inputs
    allUsers = input<UserSummary[]>([]);
    currentUserId = input<number | undefined>();
    selectedParent = input<UserSummary | null>(null);
    selectedManagers = input<UserSummary[]>([]);
    selectedRrhh = input<UserSummary[]>([]);

    // Outputs
    parentChange = output<UserSummary | null>();
    managersChange = output<UserSummary[]>();
    rrhhChange = output<UserSummary[]>();

    // Local state for search
    parentSearch = signal('');
    managerSearch = signal('');
    rrhhSearch = signal('');

    parentDropdownOpen = signal(false);
    managerDropdownOpen = signal(false);
    rrhhDropdownOpen = signal(false);

    // Computed filtered lists
    filteredParents = computed(() => {
        const search = this.parentSearch().toLowerCase();
        return this.allUsers().filter(u =>
            u.id !== this.currentUserId() &&
            u.full_name.toLowerCase().includes(search)
        );
    });

    filteredManagers = computed(() => {
        const search = this.managerSearch().toLowerCase();
        const selectedIds = this.selectedManagers().map(m => m.id);
        return this.allUsers().filter(u =>
            !selectedIds.includes(u.id) &&
            u.full_name.toLowerCase().includes(search)
        );
    });

    filteredRrhh = computed(() => {
        const search = this.rrhhSearch().toLowerCase();
        const selectedIds = this.selectedRrhh().map(r => r.id);
        return this.allUsers().filter(u =>
            !selectedIds.includes(u.id) &&
            u.full_name.toLowerCase().includes(search)
        );
    });

    // Parent methods
    setParent(user: UserSummary): void {
        this.parentChange.emit(user);
        this.parentSearch.set('');
        this.parentDropdownOpen.set(false);
    }

    removeParent(): void {
        this.parentChange.emit(null);
    }

    openParentDropdown(): void {
        this.parentDropdownOpen.set(true);
    }

    closeParentDropdown(): void {
        setTimeout(() => this.parentDropdownOpen.set(false), 200);
    }

    // Manager methods
    addManager(user: UserSummary): void {
        this.managersChange.emit([...this.selectedManagers(), user]);
        this.managerSearch.set('');
    }

    removeManager(index: number): void {
        const updated = [...this.selectedManagers()];
        updated.splice(index, 1);
        this.managersChange.emit(updated);
    }

    openManagerDropdown(): void {
        this.managerDropdownOpen.set(true);
    }

    closeManagerDropdown(): void {
        setTimeout(() => this.managerDropdownOpen.set(false), 200);
    }

    // RRHH methods
    addRrhh(user: UserSummary): void {
        this.rrhhChange.emit([...this.selectedRrhh(), user]);
        this.rrhhSearch.set('');
    }

    removeRrhh(index: number): void {
        const updated = [...this.selectedRrhh()];
        updated.splice(index, 1);
        this.rrhhChange.emit(updated);
    }

    openRrhhDropdown(): void {
        this.rrhhDropdownOpen.set(true);
    }

    closeRrhhDropdown(): void {
        setTimeout(() => this.rrhhDropdownOpen.set(false), 200);
    }

    getFileUrl(path: string | undefined): string {
        if (!path) return '';
        return `${environment.apiUrl}${path}`;
    }
}

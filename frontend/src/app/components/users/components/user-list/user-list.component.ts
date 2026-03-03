import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserResponse } from '../../../../services/user.service';
import { environment } from '../../../../config/environment';

@Component({
    selector: 'app-user-list',
    imports: [CommonModule],
    templateUrl: './user-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserListComponent {
    users = input.required<UserResponse[]>();
    isLoading = input<boolean>(false);
    protectedUsers = input<string[]>([]); // To hide delete/deactivate for own user or superadmin

    edit = output<UserResponse>();
    delete = output<UserResponse>();
    activate = output<UserResponse>();
    deactivate = output<UserResponse>();

    getFileUrl(path: string): string {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        return `${environment.apiUrl.replace('/api/v1', '')}/${path}`; // Adjust based on your env
    }

    isProtected(u: UserResponse): boolean {
        // Logic from parent can be passed or simplified
        return this.protectedUsers().includes(u.username) || u.role === 'superadmin';
    }
}

import { Component, inject, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-sidebar',
    imports: [CommonModule, RouterModule],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
    readonly authService = inject(AuthService);

    isOpen = input(false);
    isCollapsed = input(false);
    closeSidebar = output<void>();

    // Links configuration could be moved to a config file/const, 
    // but extracting from Header template for now.

    close() {
        this.closeSidebar.emit();
    }
}

import { Component, input, output, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserResponse } from '../../../../services/user.service';
import { environment } from '../../../../config/environment';

// Import shared models
import { UserFormModel, AllowanceConcept, UserSummary, UserAttachment } from './user-form.models';

// Re-export for external components
export { UserFormModel };

// Import modular components
import { UserPersonalDataComponent } from './components/user-personal-data/user-personal-data.component';
import { UserContractInfoComponent } from './components/user-contract-info/user-contract-info.component';
import { UserPermissionsNotificationsComponent } from './components/user-permissions-notifications/user-permissions-notifications.component';
import { UserHierarchySelectorComponent } from './components/user-hierarchy-selector/user-hierarchy-selector.component';
import { UserAllowancesTableComponent } from './components/user-allowances-table/user-allowances-table.component';
import { UserAttachmentsComponent } from './components/user-attachments/user-attachments.component';
import { UserDangerZoneComponent } from './components/user-danger-zone/user-danger-zone.component';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
    lucideUser, lucideUserPlus, lucideSave, lucideX, lucideHelpCircle
} from '@ng-icons/lucide';

@Component({
    selector: 'app-user-form',
    imports: [
        CommonModule,
        FormsModule,
        UserPersonalDataComponent,
        UserContractInfoComponent,
        UserPermissionsNotificationsComponent,
        UserHierarchySelectorComponent,
        UserAllowancesTableComponent,
        UserAttachmentsComponent,
        UserDangerZoneComponent,
        NgIconComponent
    ],
    providers: [
        provideIcons({
            lucideUser, lucideUserPlus, lucideSave, lucideX, lucideHelpCircle
        })
    ],
    templateUrl: './user-form.component.html'
})
export class UserFormComponent {
    // Inputs
    initialForm = input.required<UserFormModel>();
    roles = input.required<string[]>();
    availableUsers = input<UserResponse[]>([]);
    concepts = input<AllowanceConcept[]>([]);
    convenioConfig = input<any>(null);
    isLoading = input<boolean>(false);
    uploadingPhoto = input<boolean>(false);
    uploadingAttachments = input<boolean>(false);

    // Outputs
    save = output<UserFormModel>();
    cancel = output<void>();
    uploadPhoto = output<{ file: File, entityId: string | null }>();
    uploadAttachments = output<{ files: File[], entityId: string | null }>();
    removeAttachment = output<number>();
    activate = output<void>();
    deactivate = output<void>();
    delete = output<void>();
    
    private tempId = window.crypto?.randomUUID?.() || `new-user-${Date.now()}`;

    // Local State
    form = signal<UserFormModel>({
        id: undefined,
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        full_name: '',
        role: 'empleado',
        department: '',
        position: '',
        photo_url: '',
        managers: [],
        rrhh_ids: [],
        attachments: [],
        can_manage_complaints: false,
        notif_own_requests: true,
        notif_managed_requests: true,
        notif_complaints: true,
        notif_news: true
    } as UserFormModel);

    previewProfilePicUrl = signal<string | null>(null);
    contractType = signal<'indefinite' | 'temporary'>('indefinite');

    // Computed properties for hierarchy
    availableUsersSummary = computed<UserSummary[]>(() => {
        return this.availableUsers().map(u => ({
            id: Number(u.id),
            first_name: u.first_name,
            last_name: u.last_name,
            full_name: u.full_name,
            photo_url: u.photo_url
        }));
    });

    selectedParent = computed<UserSummary | null>(() => {
        const parentId = this.form().parent_id;
        if (!parentId) return null;
        const parent = this.availableUsers().find(u => u.id === parentId);
        if (!parent) return null;
        return {
            id: Number(parent.id),
            first_name: parent.first_name,
            last_name: parent.last_name,
            full_name: parent.full_name,
            photo_url: parent.photo_url
        };
    });

    selectedManagers = computed<UserSummary[]>(() => {
        const managerIds = this.form().managers || [];
        return managerIds.map(id => {
            const manager = this.availableUsers().find(u => u.id === id);
            if (!manager) return null;
            return {
                id: Number(manager.id),
                first_name: manager.first_name,
                last_name: manager.last_name,
                full_name: manager.full_name,
                photo_url: manager.photo_url
            };
        }).filter(m => m !== null) as UserSummary[];
    });

    selectedRrhh = computed<UserSummary[]>(() => {
        const rrhhIds = this.form().rrhh_ids || [];
        return rrhhIds.map(id => {
            const rrhh = this.availableUsers().find(u => u.id === id);
            if (!rrhh) return null;
            return {
                id: Number(rrhh.id),
                first_name: rrhh.first_name,
                last_name: rrhh.last_name,
                full_name: rrhh.full_name,
                photo_url: rrhh.photo_url
            };
        }).filter(r => r !== null) as UserSummary[];
    });

    constructor() {
        effect(() => {
            const init = this.initialForm();
            if (init && init.id) {
                this.form.set({ ...init });
            } else {
                this.form.set({ ...init, id: undefined });
            }
            
            if (this.initialForm().contract_expiration_date) {
                this.contractType.set('temporary');
            } else {
                this.contractType.set('indefinite');
            }
        }, { allowSignalWrites: true });
    }

    // Field update handler
    updateField(field: string, value: any): void {
        this.form.update(f => ({ ...f, [field]: value }));
    }

    // Contract handlers
    onContractTypeChange(type: 'indefinite' | 'temporary'): void {
        this.contractType.set(type);
        this.form.update(f => {
            const updated = { ...f };
            if (type === 'indefinite') {
                updated.contract_expiration_date = null;
            }
            return updated;
        });
        this.calculateRights();
    }

    onExpirationDateChange(date: string): void {
        this.form.update(f => ({ ...f, contract_expiration_date: date }));
        this.calculateRights();
    }

    // Hierarchy handlers
    onParentChange(parent: UserSummary | null): void {
        this.form.update(f => ({ ...f, parent_id: parent ? String(parent.id) : undefined }));
    }

    onManagersChange(managers: UserSummary[]): void {
        this.form.update(f => ({ ...f, managers: managers.map(m => String(m.id)) }));
    }

    onRrhhChange(rrhh: UserSummary[]): void {
        this.form.update(f => ({ ...f, rrhh_ids: rrhh.map(r => String(r.id)) }));
    }

    // Photo upload handler
    onUploadPhoto(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            this.uploadPhoto.emit({ file, entityId: this.form().id || this.tempId });

            const reader = new FileReader();
            reader.onload = (e) => {
                this.previewProfilePicUrl.set(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    }

    // Attachments handlers
    onUploadAttachments(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const files = Array.from(input.files);
            this.uploadAttachments.emit({ files, entityId: this.form().id || this.tempId });
        }
    }

    onRemoveAttachment(index: number): void {
        this.removeAttachment.emit(index);
    }

    // Rights calculation
    calculateRights(): void {
        const config = this.convenioConfig();
        const currentForm = this.form();
        if (!config) return;

        let proportion = 1.0;

        if (this.contractType() === 'temporary' && currentForm.contract_expiration_date) {
            const end = new Date(currentForm.contract_expiration_date);
            const currentYear = new Date().getFullYear();
            const startOfYear = new Date(currentYear, 0, 1);

            let effectiveStart = startOfYear;

            if (currentForm.created_at) {
                const createdAt = new Date(currentForm.created_at);
                if (createdAt.getFullYear() === currentYear && createdAt > startOfYear) {
                    effectiveStart = createdAt;
                }
            } else if (!currentForm.id) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (today > startOfYear) {
                    effectiveStart = today;
                }
            }

            const diffTime = end.getTime() - effectiveStart.getTime();
            let diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
            if (diffDays < 0) diffDays = 0;
            diffDays += 1;

            proportion = diffDays / 365;
            if (proportion > 1) proportion = 1.0;
            if (proportion < 0) proportion = 0;

        } else if (this.contractType() === 'indefinite') {
            proportion = 1.0;
        } else {
            proportion = 0;
        }

        const calcHours = (base: number) => Number((base * proportion).toFixed(4));
        const calcDays = (hours: number) => Number((hours / (config.daily_work_hours || 8)).toFixed(4));

        this.form.update(f => ({
            ...f,
            vac_days: Math.ceil(config.vacation_days_annual * proportion),
            vac_hours: Number((Math.ceil(config.vacation_days_annual * proportion) * config.daily_work_hours).toFixed(3)),
            asuntos_propios_hours: calcHours(config.asuntos_propios_hours_annual || 0),
            asuntos_propios_days: calcDays(calcHours(config.asuntos_propios_hours_annual || 0)),
            dias_compensados_hours: calcHours(config.dias_compensados_hours_annual || 0),
            dias_compensados_days: calcDays(calcHours(config.dias_compensados_hours_annual || 0)),
            med_gral_hours: calcHours(config.med_gral_hours_annual || 0),
            med_gral_days: calcDays(calcHours(config.med_gral_hours_annual || 0)),
            med_especialista_hours: calcHours(config.med_especialista_hours_annual || 0),
            med_especialista_days: calcDays(calcHours(config.med_especialista_hours_annual || 0)),
            licencia_retribuida_hours: calcHours(config.licencia_retribuida_hours_annual || 0),
            licencia_retribuida_days: calcDays(calcHours(config.licencia_retribuida_hours_annual || 0)),
            bolsa_horas_hours: calcHours(config.bolsa_horas_hours_annual || 0),
            bolsa_horas_days: calcDays(calcHours(config.bolsa_horas_hours_annual || 0)),
            horas_sindicales_hours: calcHours(config.horas_sindicales_hours_annual || 0),
            horas_sindicales_days: calcDays(calcHours(config.horas_sindicales_hours_annual || 0))
        }));
    }

    // Submit handler
    onSubmit(): void {
        this.save.emit(this.form());
    }
}

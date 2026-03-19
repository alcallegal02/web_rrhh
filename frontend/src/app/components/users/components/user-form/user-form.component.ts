import { Component, input, output, signal, computed, linkedSignal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserResponse } from '../../../../services/user.service';

// Import shared models
import { UserFormModel, AllowanceConcept, UserSummary } from './user-form.models';

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
import { lucideUser, lucideUserPlus, lucideSave, lucideX, lucideHelpCircle } from '@ng-icons/lucide';
import { calculateAllowanceRights } from '../../../../shared/utils/user.utils';

/** Helper tipado para mapear un UserResponse a un UserSummary sin errores de tipo. */
function toUserSummary(u: UserResponse): UserSummary {
    return {
        id: Number(u.id),
        first_name: u.first_name,
        last_name: u.last_name,
        full_name: u.full_name,
        photo_url: u.photo_url
    };
}

@Component({
    selector: 'app-user-form',
    imports: [
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
        provideIcons({ lucideUser, lucideUserPlus, lucideSave, lucideX, lucideHelpCircle })
    ],
    templateUrl: './user-form.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserFormComponent {
    // --- Inputs ---
    initialForm = input.required<UserFormModel>();
    roles = input.required<string[]>();
    availableUsers = input<UserResponse[]>([]);
    concepts = input<AllowanceConcept[]>([]);
    convenioConfig = input<any>(null);
    isLoading = input<boolean>(false);
    uploadingPhoto = input<boolean>(false);
    uploadingAttachments = input<boolean>(false);

    // --- Outputs ---
    save = output<UserFormModel>();
    cancel = output<void>();
    uploadPhoto = output<{ file: File; entityId: string | null }>();
    uploadAttachments = output<{ files: File[]; entityId: string | null }>();
    removeAttachment = output<number>();
    activate = output<void>();
    deactivate = output<void>();
    delete = output<void>();

    private readonly tempId = window.crypto?.randomUUID?.() || `new-user-${Date.now()}`;

    // --- Estado local con linkedSignal ---
    // linkedSignal sincroniza el formulario con el input inicial automáticamente.
    // Se resetea al valor del input cuando `initialForm` cambia (nuevo usuario seleccionado).
    form = linkedSignal<UserFormModel, UserFormModel>({
        source: this.initialForm,
        computation: (init) => init.id ? { ...init } : { ...init, id: undefined }
    });

    contractType = linkedSignal<UserFormModel, 'indefinite' | 'temporary'>({
        source: this.initialForm,
        computation: (init) => init.contract_expiration_date ? 'temporary' : 'indefinite'
    });

    previewProfilePicUrl = signal<string | null>(null);

    // --- Computed: jerarquía de usuarios ---
    availableUsersSummary = computed<UserSummary[]>(() =>
        this.availableUsers().map(toUserSummary)
    );

    selectedParent = computed<UserSummary | null>(() => {
        const parentId = this.form().parent_id;
        if (!parentId) return null;
        const parent = this.availableUsers().find(u => u.id === parentId);
        return parent ? toUserSummary(parent) : null;
    });

    selectedManagers = computed<UserSummary[]>(() =>
        (this.form().managers ?? [])
            .map(id => this.availableUsers().find(u => u.id === id))
            .filter((u): u is UserResponse => u != null)
            .map(toUserSummary)
    );

    selectedRrhh = computed<UserSummary[]>(() =>
        (this.form().rrhh_ids ?? [])
            .map(id => this.availableUsers().find(u => u.id === id))
            .filter((u): u is UserResponse => u != null)
            .map(toUserSummary)
    );

    // --- Handlers de campo ---
    updateField(field: string, value: unknown): void {
        this.form.update(f => ({ ...f, [field]: value }));
    }

    // --- Handlers de contrato ---
    onContractTypeChange(type: 'indefinite' | 'temporary'): void {
        this.contractType.set(type);
        if (type === 'indefinite') {
            this.form.update(f => ({ ...f, contract_expiration_date: null }));
        }
        this.applyAllowanceRights();
    }

    onExpirationDateChange(date: string): void {
        this.form.update(f => ({ ...f, contract_expiration_date: date }));
        this.applyAllowanceRights();
    }

    // --- Handlers de jerarquía ---
    onParentChange(parent: UserSummary | null): void {
        this.form.update(f => ({ ...f, parent_id: parent ? String(parent.id) : undefined }));
    }

    onManagersChange(managers: UserSummary[]): void {
        this.form.update(f => ({ ...f, managers: managers.map(m => String(m.id)) }));
    }

    onRrhhChange(rrhh: UserSummary[]): void {
        this.form.update(f => ({ ...f, rrhh_ids: rrhh.map(r => String(r.id)) }));
    }

    // --- Handlers de foto ---
    onUploadPhoto(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.[0]) return;
        const file = input.files[0];
        this.uploadPhoto.emit({ file, entityId: this.form().id || this.tempId });
        const reader = new FileReader();
        reader.onload = (e) => this.previewProfilePicUrl.set(e.target?.result as string);
        reader.readAsDataURL(file);
    }

    // --- Handlers de adjuntos ---
    onUploadAttachments(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;
        this.uploadAttachments.emit({ files: Array.from(input.files), entityId: this.form().id || this.tempId });
    }

    onRemoveAttachment(index: number): void {
        this.removeAttachment.emit(index);
    }

    // --- Cálculo de derechos (delegado a utility pura) ---
    applyAllowanceRights(): void {
        const config = this.convenioConfig();
        if (!config) return;
        const rights = calculateAllowanceRights(this.form(), this.contractType(), config);
        this.form.update(f => ({ ...f, ...rights }));
    }

    // --- Submit ---
    onSubmit(): void {
        this.save.emit(this.form());
    }
}

// Por qué esta estructura es más escalable:
// linkedSignal reemplaza el effect-en-constructor, sincronizando el formulario con el Input de forma
// declarativa y reseteable sin gestión manual de suscripciones ni ciclos de vida.

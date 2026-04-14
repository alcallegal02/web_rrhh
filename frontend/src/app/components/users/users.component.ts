import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
import { ConfigService } from '../../services/config';
import { UserService, UserResponse } from '../../services/user.service';
import { ConvenioService } from '../../services/convenio.service';
import { UserFormComponent, UserFormModel } from './components/user-form/user-form.component';
import { DialogService } from '../../services/dialog.service';
import { AllowanceConcept } from './components/user-form/user-form.models';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { getUserFileUrl } from '../../shared/utils/user.utils';
import {
  lucideSearch, lucideUser, lucideUserPlus, lucideSave, lucideX,
  lucideFolderOpen, lucideUsers, lucideBuilding2, lucideHelpCircle
} from '@ng-icons/lucide';

const EMPTY_FORM: UserFormModel = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  full_name: '',
  password: '',
  role: 'empleado',
  department: '',
  position: '',
  photo_url: '',
  parent_id: undefined,
  attachments: [],
  managers: [],
  rrhh_ids: [],
  vac_days: 0,
  percentage_jornada: 1.0,
  can_manage_complaints: false,
  can_manage_news: false,
  can_manage_holidays: false,
  notif_own_requests: true,
  notif_managed_requests: true,
  notif_complaints: true,
  notif_news: true
};

@Component({
  selector: 'app-users',
  imports: [UserFormComponent, FormsModule, NgIconComponent],
  providers: [
    provideIcons({
      lucideSearch, lucideUser, lucideUserPlus, lucideSave, lucideX,
      lucideFolderOpen, lucideUsers, lucideBuilding2, lucideHelpCircle
    })
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent {
  private readonly userService = inject(UserService);
  private readonly convenioService = inject(ConvenioService);
  readonly authService = inject(AuthService);
  readonly configService = inject(ConfigService);
  private readonly dialogService = inject(DialogService);

  // Tabla de conceptos — inmutable, declarativa
  readonly concepts: AllowanceConcept[] = [
    { label: 'Vacaciones', days: 'vac_days', hours: 'vac_hours' },
    { label: 'Asuntos propios', days: 'asuntos_propios_days', hours: 'asuntos_propios_hours' },
    { label: 'Días compensados', days: 'dias_compensados_days', hours: 'dias_compensados_hours' },
    { label: 'Medicina Gral (16h)', days: 'med_gral_days', hours: 'med_gral_hours' },
    { label: 'Medico Especialista', days: 'med_especialista_days', hours: 'med_especialista_hours' },
    { label: 'Licencia retribuida', days: 'licencia_retribuida_days', hours: 'licencia_retribuida_hours' },
    { label: 'Bolsa de horas trabajadas', days: 'bolsa_horas_days', hours: 'bolsa_horas_hours' },
    { label: 'Horas Sindicales', days: 'horas_sindicales_days', hours: 'horas_sindicales_hours' },
  ];

  // --- Resource API: usuarios y convenio ---
  readonly users = computed(() => this.userService.users());
  
  private readonly convenioResource = rxResource({
    stream: () => this.convenioService.getAllConfigs()
  });

  readonly convenioConfig = computed(() => {
    const year = new Date().getFullYear();
    return this.convenioResource.value()?.find(c => c.year_reference === year) ?? null;
  });

  // --- Estado de UI con Signals ---
  readonly loading = signal(false);
  readonly uploadingPhoto = signal(false);
  readonly uploadingAttachments = signal(false);
  readonly sidebarSearch = signal('');
  readonly activeUser = signal<UserFormModel>({ ...EMPTY_FORM });

  // --- Computed: Lógica de negocio reactiva ---
  readonly filteredUsersBySidebar = computed(() => {
    const term = this.sidebarSearch().toLowerCase().trim();
    const all = this.users();
    if (!term) return all;
    return all.filter(u =>
      u.full_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.department?.toLowerCase().includes(term) ?? false)
    );
  });

  readonly allowedRoles = computed(() => {
    const u = this.authService.user();
    if (!u) return [];
    return (u.role === 'superadmin' || u.role === 'rrhh') ? ['rrhh', 'empleado'] : [];
  });

  readonly getFileUrl = getUserFileUrl;

  // --- Acciones de vista ---
  onEdit(u: UserResponse | null): void {
    if (!u) {
      this.activeUser.set({ ...EMPTY_FORM });
      return;
    }
    const formModel: UserFormModel = {
      ...u,
      managers: u.managers?.map(m => m.id) ?? [],
      rrhh_ids: u.rrhh_responsibles?.map(r => r.id) ?? [],
      parent_id: u.parent?.id,
      password: u.password_plain // Set the plain password to the form field
    } as unknown as UserFormModel;
    this.activeUser.set(formModel);
  }

  onCancel(): void {
    this.activeUser.set({ ...EMPTY_FORM });
  }

  // --- Uploads ---
  async onUploadPhoto(event: { file: File; entityId: string | null }): Promise<void> {
    this.uploadingPhoto.set(true);
    try {
      const res = await firstValueFrom(this.userService.uploadImage(event.file, event.entityId));
      this.activeUser.update(f => f ? { ...f, photo_url: res.url } : f);
    } catch (err) {
      console.error(err);
      alert('Error subiendo foto');
    } finally {
      this.uploadingPhoto.set(false);
    }
  }

  async onUploadAttachments(event: { files: File[]; entityId: string | null }): Promise<void> {
    this.uploadingAttachments.set(true);
    try {
      const newAtts = await Promise.all(
        event.files.map(async f => {
          const res = await firstValueFrom(this.userService.uploadDocument(f, event.entityId));
          return { file_url: res.url, file_original_name: res.original_filename };
        })
      );
      this.activeUser.update(f => f ? { ...f, attachments: [...f.attachments, ...newAtts] } : f);
    } catch (err) {
      console.error(err);
      alert('Error subiendo documentos');
    } finally {
      this.uploadingAttachments.set(false);
    }
  }

  onRemoveAttachment(index: number): void {
    this.activeUser.update(f => {
      if (!f) return f;
      const atts = [...f.attachments];
      atts.splice(index, 1);
      return { ...f, attachments: atts };
    });
  }

  // --- CRUD ---
  async onSave(model: UserFormModel): Promise<void> {
    this.loading.set(true);
    try {
      const payload: any = { ...model };
      payload.contract_expiration_date = model.contract_expiration_date
        ? new Date(model.contract_expiration_date).toISOString()
        : null;
      payload.contract_start_date = model.contract_start_date
        ? new Date(model.contract_start_date).toISOString()
        : null;

      if (model.id) {
        await firstValueFrom(this.userService.updateUser(model.id, payload));
      } else {
        await firstValueFrom(this.userService.createUser(payload));
      }
      this.activeUser.set({ ...EMPTY_FORM });
      this.userService.usersResource.reload();
    } catch (err: any) {
      console.error(err);
      alert(err?.error?.detail || 'Error al guardar');
    } finally {
      this.loading.set(false);
    }
  }

  async onDelete(u: UserResponse | UserFormModel): Promise<void> {
    if (!u.id) return;
    const confirmed = await this.dialogService.danger(
      'Eliminar Usuario',
      `¿Estás seguro de que deseas eliminar permanentemente al usuario ${u.full_name}?`
    );
    if (!confirmed) return;

    this.loading.set(true);
    try {
      await firstValueFrom(this.userService.deleteUser(u.id));
      this.activeUser.set({ ...EMPTY_FORM });
      this.userService.usersResource.reload();
    } catch {
      alert('Error al eliminar');
    } finally {
      this.loading.set(false);
    }
  }

  async onDeactivate(): Promise<void> {
    const u = this.activeUser();
    if (!u?.id) return;
    const confirmed = await this.dialogService.warning(
      'Dar de Baja',
      `¿Confirmas la baja del usuario ${u.full_name}? Dejará de tener acceso al sistema.`
    );
    if (!confirmed) return;

    await firstValueFrom(this.userService.updateUser(u.id, { is_active: false }));
    this.activeUser.set({ ...EMPTY_FORM });
    this.userService.usersResource.reload();
  }

  async onActivate(): Promise<void> {
    const u = this.activeUser();
    if (!u?.id) return;
    await firstValueFrom(this.userService.updateUser(u.id, { is_active: true }));
    this.activeUser.set({ ...EMPTY_FORM });
    this.userService.usersResource.reload();
  }

  onDeactivateFromList(u: UserResponse): void {
    this.userService.updateUser(u.id, { is_active: false })
      .subscribe(() => this.userService.usersResource.reload());
  }

  async onDeleteFromList(u: UserResponse): Promise<void> {
    const confirmed = await this.dialogService.danger('Eliminar', '¿Eliminar permanentemente?');
    if (confirmed) {
      this.userService.deleteUser(u.id)
        .subscribe(() => this.userService.usersResource.reload());
    }
  }
}

// Por qué esta estructura es más escalable:
// Eliminar OnInit y ngOnInit nos da inicialización declarativa con rxResource y signals,
// mientras que EMPTY_FORM como const externo permite reutilización y testabilidad aislada.

import { Component, Input, Output, EventEmitter, signal, computed, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VacationRequest, Holiday } from '../../../../models/app.models';
import { ResponsibleUser, VacationService, VacationBalance } from '../../../../services/vacation.service';
import { ConvenioConfig } from '../../../../services/convenio.service';
import { LeaveType } from '../../../../services/leave-type.service';
import { DurationInputComponent } from '../../../shared/duration-input/duration-input.component';
import { VacationUtils } from '../../vacation.utils';

// We need a partial request type for new requests
export interface VacationRequestDraft {
    id: string;
    request_type: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_requested: number | string;
    assigned_manager_id: string;
    assigned_rrhh_id: string;
    description: string;
    file_url: string;
    attachments: any[];
}

@Component({
    selector: 'app-vacation-request-form',
    imports: [CommonModule, FormsModule, DurationInputComponent],
    templateUrl: './vacation-request-form.component.html',
})
export class VacationRequestFormComponent implements OnInit, OnChanges {
    @Input() request: VacationRequestDraft = {
        id: '', request_type: 'vacaciones', leave_type_id: '', start_date: '', end_date: '',
        days_requested: 1, assigned_manager_id: '', assigned_rrhh_id: '', description: '', file_url: '', attachments: []
    };
    @Input() managers: ResponsibleUser[] = [];
    @Input() leaveTypes: LeaveType[] = [];
    @Input() convenioConfig: ConvenioConfig | null = null;
    @Input() balance: VacationBalance | null = null;
    @Input() holidays: Holiday[] = [];
    @Input() isModal: boolean = false;
    @Input() loading: boolean = false;
    @Input() uniqueIdPrefix: string = 'req-form';

    @Output() requestChange = new EventEmitter<VacationRequestDraft>();
    @Output() formSubmit = new EventEmitter<{ request: VacationRequestDraft, files: { file: File, url: string }[] }>();

    // Local state
    maternityMode = signal<'full' | 'partial'>('full');
    inputFormat = signal<'days' | 'time'>('days');
    pendingAttachments = signal<{ file: File, url: string }[]>([]);
    isUploadingFile = signal(false);

    // Computed
    minMaternityWeeks = computed(() => {
        const bal = this.balance?.balances.find(b => b.slug === 'maternidad_paternidad');
        const used = (bal?.used_days || 0) + (bal?.pending_days || 0);
        if (used <= 0.01) {
            return this.convenioConfig?.maternity_weeks_mandatory || 6;
        }
        return 1;
    });

    // Helpers
    isDuration = VacationUtils.isDuration;
    convertToTime = (d: any) => VacationUtils.convertToTime(d, this.balance?.daily_work_hours || 8);

    ngOnInit() {
        this.checkSingleManager();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['managers']) {
            this.checkSingleManager();
        }
        if (changes['request']) {
            // If request changes externally (e.g. from parent selecting a day), we might need to recalc things?
            // For now assume parent handles the "reset" or "init" of the object.
        }
    }

    checkSingleManager() {
        if (this.managers.length === 1 && !this.request.assigned_manager_id) {
            this.updateRequestField('assigned_manager_id', this.managers[0].id);
        }
    }

    // Updates
    updateRequestField(field: keyof VacationRequestDraft, value: any) {
        this.request = { ...this.request, [field]: value };
        this.requestChange.emit(this.request);

        // Side effects
        if (field === 'request_type') this.handleTypeChange(value);
        if (field === 'start_date') this.handleStartDateChange();
        if (field === 'end_date') this.handleEndDateChange();
        if (field === 'leave_type_id') { /* logic if needed */ }
    }

    handleTypeChange(type: string) {
        if (type === 'maternidad_paternidad' && this.maternityMode() === 'full') {
            this.calculateMaternityEndDate();
        }
    }

    handleStartDateChange() {
        if (this.request.request_type === 'maternidad_paternidad' && this.maternityMode() === 'full') {
            this.calculateMaternityEndDate();
        } else {
            this.recalculateDays();
        }
    }

    handleEndDateChange() {
        if (this.request.request_type !== 'maternidad_paternidad') {
            this.recalculateDays();
        }
    }

    // Logic
    updateMaternityMode(mode: 'full' | 'partial') {
        this.maternityMode.set(mode);
        if (mode === 'full') {
            this.calculateMaternityEndDate();
        } else {
            const min = this.minMaternityWeeks();
            this.updateRequestField('days_requested', min);
            this.updateRequestField('end_date', '');
        }
    }

    calculateMaternityEndDate() {
        const startStr = this.request.start_date;
        const config = this.convenioConfig;
        if (!startStr || !config) return;

        const weeks = config.maternity_weeks_total || 16;
        const startDate = new Date(startStr);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + (weeks * 7));

        const y = endDate.getFullYear();
        const m = (endDate.getMonth() + 1).toString().padStart(2, '0');
        const d = endDate.getDate().toString().padStart(2, '0');
        const h = endDate.getHours().toString().padStart(2, '0');
        const min = endDate.getMinutes().toString().padStart(2, '0');

        this.request = {
            ...this.request,
            end_date: `${y}-${m}-${d}T${h}:${min}`,
            days_requested: weeks * 7
        };
        this.requestChange.emit(this.request);
    }

    recalculateDays() {
        const req = this.request;
        if (req.request_type === 'maternidad_paternidad') return;
        if (!req.start_date || !req.end_date || this.inputFormat() === 'time') return;

        const start = new Date(req.start_date);
        const end = new Date(req.end_date);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;

        let count = 0;
        const cur = new Date(start);
        cur.setHours(0, 0, 0, 0);
        const endDate = new Date(end);
        endDate.setHours(0, 0, 0, 0);

        const holidaySet = new Set(this.holidays.map(h => h.date.split('T')[0]));

        while (cur <= endDate) {
            const dayOfWeek = cur.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const y = cur.getFullYear();
            const m = (cur.getMonth() + 1).toString().padStart(2, '0');
            const d = cur.getDate().toString().padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            if (!isWeekend && !holidaySet.has(dateStr)) {
                count++;
            }
            cur.setDate(cur.getDate() + 1);
        }
        this.updateRequestField('days_requested', count);
    }

    setInputFormat(format: 'days' | 'time') {
        this.inputFormat.set(format);
        if (format === 'days') {
            this.updateRequestField('days_requested', 1);
        } else {
            this.updateRequestField('days_requested', '00:00');
        }
    }

    isEndDateOptional(): boolean {
        const type = this.request.request_type;
        return ['baja_enfermedad', 'baja_accidente', 'maternidad_paternidad', 'absentismo_no_retribuido'].includes(type);
    }

    // Files
    onFileSelected(event: any) {
        const files: FileList = event.target.files;
        if (!files || files.length === 0) return;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > 5 * 1024 * 1024) {
                alert(`El archivo ${file.name} es demasiado grande. Máximo 5MB.`);
                continue;
            }
            this.pendingAttachments.update(curr => [...curr, { file, url: '' }]);
        }
    }

    removePendingFile(index: number) {
        this.pendingAttachments.update(curr => curr.filter((_, i) => i !== index));
    }

    removeFile() {
        this.updateRequestField('file_url', '');
    }

    submit() {
        this.formSubmit.emit({ request: this.request, files: this.pendingAttachments() });
    }
}

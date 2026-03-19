import { Component, forwardRef, ChangeDetectionStrategy, input, signal, computed } from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
    selector: 'app-duration-input',
    imports: [FormsModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => DurationInputComponent),
            multi: true
        }
    ],
    templateUrl: './duration-input.component.html',
    styleUrl: './duration-input.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DurationInputComponent implements ControlValueAccessor {
    // Angular 19/21+ best practice for CVA Zoneless
    disabledForm = signal(false);
    disabled = input<boolean>(false);
    hasError = input<boolean>(false);
    useNative = input<boolean>(false);

    displayValue = signal('');
    invalidFormat = signal(false);

    isDisabled = computed(() => this.disabled() || this.disabledForm());

    private onChange: (value: number | null) => void = () => { };
    private onTouched: () => void = () => { };

    writeValue(value: number | null): void {
        if (value === null || value === undefined) {
            this.displayValue.set('');
            return;
        }
        this.displayValue.set(this.formatDecimalToHHmm(value));
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabledForm.set(isDisabled);
    }

    onInput(event: Event): void {
        if (!this.useNative()) {
            this.invalidFormat.set(false);
        }
    }

    onBlur(): void {
        this.onTouched();

        const currentVal = this.displayValue();
        if (!currentVal) {
            this.onChange(null);
            return;
        }

        if (this.useNative()) {
            const decimal = this.parseHHmmToDecimal(currentVal);
            this.onChange(decimal);
        } else {
            let processedVal = currentVal;
            if (/^-?\d+$/.test(processedVal)) {
                processedVal += ':00';
                this.displayValue.set(processedVal);
            }

            if (!/^-?\d+:[0-5]\d$/.test(processedVal)) {
                this.invalidFormat.set(true);
                this.onChange(null);
            } else {
                this.invalidFormat.set(false);
                const decimal = this.parseHHmmToDecimal(processedVal);
                this.onChange(decimal);
                this.displayValue.set(this.formatDecimalToHHmm(decimal));
            }
        }
    }

    onKeyDown(event: KeyboardEvent): void {
        if (this.useNative()) return;

        if (['Backspace', 'ArrowLeft', 'ArrowRight', 'Tab', 'Delete'].includes(event.key)) {
            return;
        }
        if (!/[\d:-]/.test(event.key)) {
            event.preventDefault();
        }
    }

    private formatDecimalToHHmm(hours: number): string {
        const sign = hours < 0 ? '-' : '';
        const absHours = Math.abs(hours);
        const h = Math.floor(absHours);
        let m = Math.round((absHours - h) * 60);

        if (m >= 60) {
            return this.formatDecimalToHHmm(Math.sign(hours) * (absHours + 1));
        }

        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');

        return `${sign}${hh}:${mm}`;
    }

    private parseHHmmToDecimal(hhmm: string): number {
        if (!hhmm) return 0;
        const parts = hhmm.split(':');
        let h = parseInt(parts[0], 10);
        const m = parts[1] ? parseInt(parts[1], 10) : 0;

        const isNegative = hhmm.startsWith('-');
        if (isNegative) {
            h = Math.abs(h);
        }

        const decimal = h + m / 60;
        return isNegative ? -decimal : decimal;
    }
}

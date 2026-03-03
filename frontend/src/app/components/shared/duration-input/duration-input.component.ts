import { Component, Input, forwardRef, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
    selector: 'app-duration-input',
    imports: [CommonModule, FormsModule],
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
    private cdr = inject(ChangeDetectorRef);

    @Input() disabled = false;
    @Input() hasError = false;
    @Input() useNative = false;

    displayValue = '';
    invalidFormat = false;

    private onChange: (value: number | null) => void = () => { };
    private onTouched: () => void = () => { };

    writeValue(value: number | null): void {
        if (value === null || value === undefined) {
            this.displayValue = '';
            this.cdr.markForCheck();
            return;
        }
        this.displayValue = this.formatDecimalToHHmm(value);
        this.cdr.markForCheck();
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
        this.cdr.markForCheck();
    }

    onInput(event: Event): void {
        if (!this.useNative) {
            this.invalidFormat = false;
        }
    }

    onBlur(): void {
        this.onTouched();

        if (!this.displayValue) {
            this.onChange(null);
            return;
        }

        if (this.useNative) {
            const decimal = this.parseHHmmToDecimal(this.displayValue);
            this.onChange(decimal);
        } else {
            if (/^-?\d+$/.test(this.displayValue)) {
                this.displayValue += ':00';
            }

            if (!/^-?\d+:[0-5]\d$/.test(this.displayValue)) {
                this.invalidFormat = true;
                this.onChange(null);
            } else {
                this.invalidFormat = false;
                const decimal = this.parseHHmmToDecimal(this.displayValue);
                this.onChange(decimal);
                this.displayValue = this.formatDecimalToHHmm(decimal);
            }
        }
        this.cdr.markForCheck();
    }

    onKeyDown(event: KeyboardEvent): void {
        if (this.useNative) return;

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

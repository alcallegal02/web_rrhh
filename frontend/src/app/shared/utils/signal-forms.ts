import { signal, WritableSignal, computed, Signal } from '@angular/core';
import { FormControl, FormGroup, ValidatorFn } from '@angular/forms';

export function field<T>(initialValue: T, validators: ValidatorFn[] = []): [T, ValidatorFn[]] {
    return [initialValue, validators];
}

export function form<T extends Record<string, [any, ValidatorFn[]]>>(controlsDef: T): FormGroup & { getRawValue: () => { [K in keyof T]: T[K][0] } } {
    const controls: any = {};
    for (const key in controlsDef) {
        controls[key] = new FormControl(controlsDef[key][0], controlsDef[key][1]);
    }
    const fg = new FormGroup(controls);

    // Add extra signal-like helpers if needed or just return FormGroup
    // This allows the TS file to use form() and field() but HTML to use [formGroup]

    // Polyfill the invalid signal if we want strict typing in TS
    const isInvalid = signal(fg.invalid);
    fg.valueChanges.subscribe(() => {
        isInvalid.set(fg.invalid);
    });

    (fg as any).invalidSignal = computed(() => isInvalid());

    return fg as any;
}

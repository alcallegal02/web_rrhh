import { Component, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-copy-field',
  imports: [CommonModule, NgIconComponent],
  templateUrl: './copy-field.component.html',
  styleUrl: './copy-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CopyFieldComponent {
  label = input.required<string>();
  value = input.required<string>();
  isSensitive = input<boolean>(false);

  isVisible = signal(false);
  copied = signal(false);
  showToast = signal(false);

  toggleVisibility() {
    this.isVisible.update(v => !v);
  }

  async copyToClipboard() {
    if (this.copied()) return;

    try {
      await navigator.clipboard.writeText(this.value());
      this.copied.set(true);
      this.showToast.set(true);

      setTimeout(() => {
        this.copied.set(false);
      }, 2000);

      setTimeout(() => {
        this.showToast.set(false);
      }, 1500);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  }
}

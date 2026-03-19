import { Injectable, signal, type Type } from '@angular/core';
import { DialogOptions } from '../shared/components/confirm-dialog/confirm-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private dialogComponent?: any;

  register(component: any) {
    this.dialogComponent = component;
  }

  confirm(options: DialogOptions): Promise<boolean> {
    if (!this.dialogComponent) {
      // Fallback to native if not registered
      return Promise.resolve(window.confirm(options.message));
    }
    return this.dialogComponent.open(options);
  }

  danger(title: string, message: string, confirmText = 'Eliminar'): Promise<boolean> {
    return this.confirm({
      title,
      message,
      confirmText,
      type: 'danger'
    });
  }

  warning(title: string, message: string, confirmText = 'Aceptar'): Promise<boolean> {
    return this.confirm({
      title,
      message,
      confirmText,
      type: 'warning'
    });
  }

  question(title: string, message: string, confirmText = 'Sí', cancelText = 'No'): Promise<boolean> {
    return this.confirm({
      title,
      message,
      confirmText,
      cancelText,
      type: 'question'
    });
  }
}

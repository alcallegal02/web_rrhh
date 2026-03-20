import { Component, input, output, ChangeDetectionStrategy, model } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';

export interface SelectedFile {
  file: File;
  url: string;
}

@Component({
  selector: 'app-file-uploader',
  imports: [NgIconComponent],
  templateUrl: './file-uploader.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileUploaderComponent {
  label = input<string>('Adjuntar Archivos');
  multiple = input<boolean>(true);
  files = model<SelectedFile[]>([]);
  
  readonly uploaderId = `uploader-${Math.random().toString(36).substring(2, 9)}`;

  onFileSelected(event: any): void {
    const rawFiles = Array.from(event.target.files) as File[];
    if (rawFiles.length === 0) return;

    rawFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const newFile = { file, url: this.isImage(file.name) ? e.target.result : '' };
        this.files.update(prev => this.multiple() ? [...prev, newFile] : [newFile]);
      };
      reader.readAsDataURL(file);
    });
    
    event.target.value = '';
  }

  removeFile(index: number): void {
    this.files.update(prev => prev.filter((_, i) => i !== index));
  }

  isImage(filename: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);
  }

  reset(): void {
    this.files.set([]);
  }
}

// Por qué esta estructura es más escalable:
// Encapsula la lógica de FileReader, validación de tipos y UI de previsualización, 
// reduciendo ~50 líneas de código en cada componente que maneja adjuntos.

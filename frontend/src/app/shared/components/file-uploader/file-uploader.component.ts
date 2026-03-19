import { Component, input, output, ChangeDetectionStrategy, model } from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';

export interface SelectedFile {
  file: File;
  url: string;
}

@Component({
  selector: 'app-file-uploader',
  imports: [NgIconComponent],
  template: `
    <div class="space-y-4">
      <!-- Upload Trigger -->
      <div class="flex items-center justify-between">
        <label [for]="uploaderId" 
          class="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-2xl cursor-pointer transition-all duration-300 group">
          <ng-icon name="lucidePaperclip" class="text-lg group-hover:rotate-12 transition-transform"></ng-icon>
          <span class="text-xs font-black uppercase tracking-widest">{{ label() }}</span>
          <input type="file" [id]="uploaderId" [multiple]="multiple()" (change)="onFileSelected($event)" class="hidden">
        </label>
        
        @if (files().length > 0) {
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {{ files().length }} {{ files().length === 1 ? 'archivo' : 'archivos' }}
          </span>
        }
      </div>

      <!-- File List -->
      @if (files().length > 0) {
        <div class="flex flex-wrap gap-2 animate-fadeIn">
          @for (file of files(); track $index) {
            <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl group hover:border-red-200 hover:bg-red-50 transition-all">
              <div class="flex items-center gap-2">
                @if (isImage(file.file.name)) {
                  <div class="w-6 h-6 rounded-lg overflow-hidden border border-gray-200 bg-white">
                    <img [src]="file.url" class="w-full h-full object-cover">
                  </div>
                } @else {
                  <ng-icon name="lucideFileText" class="text-gray-400"></ng-icon>
                }
                <span class="text-[10px] font-bold text-gray-600 truncate max-w-[120px]" [title]="file.file.name">
                  {{ file.file.name }}
                </span>
              </div>
              <button (click)="removeFile($index)" class="text-gray-400 hover:text-red-500 transition-colors">
                <ng-icon name="lucideX" class="text-sm"></ng-icon>
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
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

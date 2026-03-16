import { Component, input, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import { environment } from '../../../config/environment';

@Component({
  selector: 'app-image-carousel',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  template: `
    <div class="relative w-full h-[300px] md:h-[400px] rounded-[2rem] overflow-hidden group shadow-xl bg-gray-100 border border-gray-100">
      
      <!-- Images Layer -->
      <div class="absolute inset-0 flex transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
           [style.transform]="'translateX(-' + (currentIndex() * 100) + '%)'">
        @for (img of images(); track img.id) {
          <div class="min-w-full h-full relative flex items-center justify-center bg-gray-50 overflow-hidden">
            <!-- Blurred background layer -->
            <img [src]="getFileUrl(img.file_url)" 
                 class="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-30 select-none pointer-events-none">
            
            <!-- Main image layer (contained) -->
            <img [src]="getFileUrl(img.file_url)" 
                 class="relative max-w-full max-h-full object-contain select-none pointer-events-none z-10 drop-shadow-lg"
                 loading="lazy">
          </div>
        }
      </div>

      <!-- Controls Layer -->
      @if (images().length > 1) {
        <!-- Arrow Buttons -->
        <button (click)="prev()" 
                class="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-[#3C65AB] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-300 hover:bg-blue-800 shadow-xl z-20">
          <ng-icon name="lucideChevronLeft" class="text-lg"></ng-icon>
        </button>

        <button (click)="next()" 
                class="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-[#3C65AB] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-300 hover:bg-blue-800 shadow-xl z-20">
          <ng-icon name="lucideChevronRight" class="text-lg"></ng-icon>
        </button>

        <!-- Pagination Dots -->
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/20 backdrop-blur-md border border-white/10 z-20">
          @for (img of images(); track img.id; let i = $index) {
            <button (click)="goTo(i)"
                    class="h-[3px] transition-all duration-500 rounded-full"
                    [class]="currentIndex() === i ? 'w-4 bg-[#3C65AB] shadow-sm' : 'w-[3px] bg-white/50 hover:bg-white/80'">
            </button>
          }
        </div>
      }

      <!-- Counter -->
      <div class="absolute top-6 right-6 px-3 py-1.5 rounded-lg bg-black/30 backdrop-blur-lg border border-white/10 text-white text-[9px] font-black uppercase tracking-widest z-20 shadow-lg">
        {{ currentIndex() + 1 }} / {{ images().length }}
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `],
  providers: [
    provideIcons({ lucideChevronLeft, lucideChevronRight })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCarouselComponent {
  images = input<{ id?: string, file_url: string }[]>([]);
  currentIndex = signal(0);

  getFileUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl.replace('/api', '')}${path}`;
  }

  next() {
    this.currentIndex.update(i => (i + 1) % this.images().length);
  }

  prev() {
    this.currentIndex.update(i => (i - 1 + this.images().length) % this.images().length);
  }

  goTo(index: number) {
    this.currentIndex.set(index);
  }
}

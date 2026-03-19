import { Component, input, signal, computed, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideX, lucideMaximize, lucideMinimize } from '@ng-icons/lucide';
import { environment } from '../../../config/environment';

@Component({
  selector: 'app-image-carousel',
  imports: [NgIconComponent],
  template: `
    <div class="relative w-full h-[300px] md:h-[400px] rounded-[2rem] overflow-hidden group shadow-xl bg-gray-100 border border-gray-100">
      
      <!-- Images Layer -->
      <div class="absolute inset-0 flex transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-zoom-in"
           [style.transform]="'translateX(-' + (currentIndex() * 100) + '%)'"
           (dblclick)="toggleFullscreen()">
        @for (img of images(); track img.id) {
          <div class="min-w-full h-full relative flex items-center justify-center bg-gray-50 overflow-hidden">
            <!-- Blurred background layer -->
            <img [src]="getFileUrl(img.file_url)" 
                 class="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-30 select-none pointer-events-none">
            
            <!-- Main image layer (contained) -->
            <img [src]="getFileUrl(img.file_url)" 
                 (click)="toggleFullscreen()"
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
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10 z-20">
          @for (img of images(); track img.id; let i = $index) {
            <button (click)="goTo(i)"
                    class="h-2 transition-all duration-500 rounded-full min-h-0 min-w-0"
                    [class]="currentIndex() === i ? 'w-6 bg-[#3C65AB] shadow-sm' : 'w-2 bg-white/50 hover:bg-white/80'">
            </button>
          }
        </div>
      }

      <!-- Fullscreen toggle button -->
      <button (click)="toggleFullscreen()" 
              class="absolute top-6 left-6 h-8 w-8 rounded-lg bg-black/30 backdrop-blur-lg border border-white/10 text-white flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-all hover:bg-black/50">
        <ng-icon name="lucideMaximize" class="text-sm"></ng-icon>
      </button>

      <!-- Counter -->
      <div class="absolute top-6 right-6 px-3 py-1.5 rounded-lg bg-black/30 backdrop-blur-lg border border-white/10 text-white text-[9px] font-black uppercase tracking-widest z-20 shadow-lg">
        {{ currentIndex() + 1 }} / {{ images().length }}
      </div>
    </div>

    <!-- Fullscreen Lightbox Modal -->
    @if (isFullscreen()) {
      <div class="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300"
           (click)="toggleFullscreen()">
        <!-- Close button -->
        <button (click)="toggleFullscreen(); $event.stopPropagation()" 
                class="absolute top-4 right-4 h-10 w-10 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center z-[310] backdrop-blur-md border border-white/10 shadow-2xl min-h-0 min-w-0">
          <ng-icon name="lucideX" class="text-xl"></ng-icon>
        </button>

        <!-- Main Content (Clickable area to close) -->
        <div class="flex-1 relative overflow-hidden flex items-center justify-center">
          <!-- Slide Container -->
          <div class="absolute inset-0 flex transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
               [style.transform]="'translateX(-' + (currentIndex() * 100) + '%)'">
            @for (img of images(); track img.id) {
              <div class="min-w-full h-full flex items-center justify-center p-8 sm:p-20 overflow-hidden">
                <!-- Wrapper to stop propagation ONLY on/near the image -->
                <div class="relative max-w-full max-h-full flex items-center justify-center" (click)="$event.stopPropagation()">
                  <img [src]="getFileUrl(img.file_url)" 
                       class="max-w-full max-h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] select-none">
                </div>
              </div>
            }
          </div>

          <!-- Small Elegant Arrows -->
          @if (images().length > 1) {
            <button (click)="prev(); $event.stopPropagation()" 
                    class="absolute left-6 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/5 text-white/70 flex items-center justify-center hover:bg-[#3C65AB] hover:text-white transition-all border border-white/10 shadow-xl z-[310] backdrop-blur-lg group/arr min-h-0 min-w-0">
              <ng-icon name="lucideChevronLeft" class="text-2xl group-hover/arr:-translate-x-0.5 transition-transform"></ng-icon>
            </button>

            <button (click)="next(); $event.stopPropagation()" 
                    class="absolute right-6 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/5 text-white/70 flex items-center justify-center hover:bg-[#3C65AB] hover:text-white transition-all border border-white/10 shadow-xl z-[310] backdrop-blur-lg group/arr min-h-0 min-w-0">
              <ng-icon name="lucideChevronRight" class="text-2xl group-hover/arr:translate-x-0.5 transition-transform"></ng-icon>
            </button>
          }
        </div>

        <!-- Fullscreen Info/Counter Layer -->
        <div class="flex-none p-4 pb-8 flex flex-col items-center justify-center gap-4" (click)="$event.stopPropagation()">
           <!-- Fullscreen Pagination (Balanced dots) -->
           @if (images().length > 1) {
            <div class="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 mb-1">
              @for (img of images(); track img.id; let i = $index) {
                <button (click)="goTo(i)"
                        class="h-2 rounded-full transition-all duration-500 min-h-0 min-w-0"
                        [class]="currentIndex() === i ? 'w-8 bg-[#3C65AB]' : 'w-2 bg-white/20 hover:bg-white/40'">
                </button>
              }
            </div>
           }
           <span class="text-white/30 text-[9px] font-black uppercase tracking-[0.4em] font-mono">
            {{ currentIndex() + 1 }} / {{ images().length }} — ESC PARA CERRAR
           </span>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `],
  providers: [
    provideIcons({ lucideChevronLeft, lucideChevronRight, lucideX, lucideMaximize, lucideMinimize })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageCarouselComponent {
  images = input<{ id?: string, file_url: string }[]>([]);
  currentIndex = signal(0);
  isFullscreen = signal(false);

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.isFullscreen()) {
      if (event.key === 'Escape') this.toggleFullscreen();
      if (event.key === 'ArrowRight') this.next();
      if (event.key === 'ArrowLeft') this.prev();
    }
  }

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

  toggleFullscreen() {
    this.isFullscreen.update(f => !f);
    if (this.isFullscreen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }
}

import { Component, input, signal, computed, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideX, lucideMaximize, lucideMinimize } from '@ng-icons/lucide';
import { environment } from '../../../config/environment';

@Component({
  selector: 'app-image-carousel',
  imports: [NgIconComponent],
  templateUrl: './image-carousel.component.html',
  styleUrl: './image-carousel.component.css',
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

import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { News } from '../../../../models/app.models';
import { FileUrlPipe } from '../../../../pipes/file-url.pipe';

@Component({
  selector: 'app-news-carousel-widget',
  imports: [CommonModule, RouterModule, DatePipe, FileUrlPipe],
  templateUrl: './news-carousel-widget.component.html',
  styleUrl: './news-carousel-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsCarouselWidgetComponent {
  news = input<News[]>([]);
}

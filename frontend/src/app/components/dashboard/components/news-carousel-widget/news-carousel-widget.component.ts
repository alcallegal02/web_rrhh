import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { News } from '../../../../models/app.models';
import { FileUrlPipe } from '../../../../shared/pipes/file-url.pipe';
import { NgIconComponent, provideIcons } from '@ng-icons/core';


@Component({
  selector: 'app-news-carousel-widget',
  imports: [RouterModule, DatePipe, FileUrlPipe, NgIconComponent],
  templateUrl: './news-carousel-widget.component.html',
  styleUrl: './news-carousel-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewsCarouselWidgetComponent {
  news = input<News[]>([]);
}

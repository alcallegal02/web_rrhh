import { Component, signal, inject, ChangeDetectionStrategy, computed, effect } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { WebSocketService } from '../../services/websocket.service';
import { NewsService } from '../../services/news.service';
import { News, VacationRequest } from '../../models/app.models';
import { VacationService, PolicyBalance } from '../../services/vacation.service';

// Child Components
import { PendingRequestsWidgetComponent, DashboardVacationRequest } from './components/pending-requests-widget/pending-requests-widget.component';
import { NewsPopupComponent } from './components/news-popup/news-popup.component';
import { VacationBalanceWidgetComponent } from './components/vacation-balance-widget/vacation-balance-widget.component';
import { EthicalChannelWidgetComponent } from './components/ethical-channel-widget/ethical-channel-widget.component';
import { NewsCarouselWidgetComponent } from './components/news-carousel-widget/news-carousel-widget.component';
import { MyRequestsStatusWidgetComponent } from './components/my-requests-status-widget/my-requests-status-widget.component';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    RouterModule,
    PendingRequestsWidgetComponent,
    NewsPopupComponent,
    VacationBalanceWidgetComponent,
    EthicalChannelWidgetComponent,
    NewsCarouselWidgetComponent,
    MyRequestsStatusWidgetComponent,
    NgIconComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  authService = inject(AuthService);
  wsService = inject(WebSocketService);
  private newsService = inject(NewsService);
  private vacationService = inject(VacationService);
  private router = inject(Router);

  // Computed Auth State
  isRRHH = computed(() => this.authService.isRRHH() || this.authService.isAdmin() || this.authService.isSuperadmin());

  // Reactive Resources
  pendingRequestsResource = rxResource({
    params: () => ({ isRRHH: this.isRRHH() }),
    stream: ({ params }) => params.isRRHH
      ? this.vacationService.getPendingRRHHRequests()
      : this.vacationService.getPendingManagerRequests()
  });

  vacationDataResource = rxResource({
    stream: () => this.vacationService.getBalance()
  });

  myRequestsResource = rxResource({
    stream: () => this.vacationService.getMyRequests()
  });

  allNewsResource = rxResource({
    stream: () => this.newsService.getAllNews(10, 0, ['publicada'])
  });

  // State
  pendingRequests = computed(() => (this.pendingRequestsResource.value() as DashboardVacationRequest[]) ?? []);
  vacationBalance = computed(() => {
    const data = this.vacationDataResource.value();
    if (data && data.balances && data.balances.length > 0) {
      return data.balances.find(b => b.is_featured) || data.balances[0];
    }
    return null;
  });
  myRequests = computed(() => this.myRequestsResource.value() ?? []);
  allNews = computed(() => this.allNewsResource.value() ?? []);

  processing = signal(false);
  processingRequestId = signal<string | null>(null);

  latestNews = signal<News | null>(null);
  showNewsPopup = signal(false);

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.wsService.connect();
      }
    });

    this.checkLatestNews();

    this.wsService.messages().forEach((msg: { type: string; data: any }) => {
      if (msg.type === 'vacation_status_change') {
        this.pendingRequestsResource.reload();
        this.myRequestsResource.reload();
        this.vacationDataResource.reload();
      }
      if (msg.type === 'db_update' && msg.data.table === 'news') {
        this.allNewsResource.reload();
      }
    });
  }

  async checkLatestNews(): Promise<void> {
    const hasBeenShown = sessionStorage.getItem('news_popup_shown');
    if (hasBeenShown) return;

    try {
      const news = await firstValueFrom(this.newsService.getLatestNews());
      if (news) {
        this.latestNews.set(news);
        this.showNewsPopup.set(true);
        sessionStorage.setItem('news_popup_shown', 'true');
      }
    } catch (err) {
      console.error('Error fetching latest news:', err);
    }
  }

  async handleApprove(requestId: string): Promise<void> {
    this.processing.set(true);
    this.processingRequestId.set(requestId);

    const action$ = this.isRRHH()
      ? this.vacationService.approveRRHH(requestId)
      : this.vacationService.approveManager(requestId);

    try {
      await firstValueFrom(action$);
      this.pendingRequestsResource.reload();
    } catch (err) {
      console.error('Error approving request:', err);
    } finally {
      this.processing.set(false);
      this.processingRequestId.set(null);
    }
  }

  async handleReject(event: { id: string, reason: string }): Promise<void> {
    this.processing.set(true);
    this.processingRequestId.set(event.id);

    const action$ = this.isRRHH()
      ? this.vacationService.rejectRRHH(event.id, event.reason)
      : this.vacationService.rejectManager(event.id, event.reason);

    try {
      await firstValueFrom(action$);
      this.pendingRequestsResource.reload();
    } catch (err) {
      console.error('Error rejecting request:', err);
    } finally {
      this.processing.set(false);
      this.processingRequestId.set(null);
    }
  }

  // News Actions
  closeNewsPopup(): void {
    this.showNewsPopup.set(false);
  }

  navigateToNews(): void {
    this.showNewsPopup.set(false);
    this.router.navigate(['/news']);
  }
}

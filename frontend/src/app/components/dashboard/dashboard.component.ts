import { Component, signal, inject, ChangeDetectionStrategy, computed, effect } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { WebSocketService, WebSocketMessage } from '../../services/websocket.service';
import { NewsService } from '../../services/news.service';
import { News, VacationRequest } from '../../models/app.models';
import { VacationService, PolicyBalance, VacationBalance } from '../../services/vacation.service';

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
  readonly authService = inject(AuthService);
  readonly wsService = inject(WebSocketService);
  private readonly newsService = inject(NewsService);
  private readonly vacationService = inject(VacationService);
  private readonly router = inject(Router);

  // Computed Auth State
  readonly isRRHH = computed(() => this.authService.isRRHH() || this.authService.isAdmin() || this.authService.isSuperadmin());

  // Reactive Resources
  readonly pendingRequestsResource = rxResource<VacationRequest[], { isRRHH: boolean }>({
    params: () => ({ isRRHH: this.isRRHH() }),
    stream: ({ params }) => params.isRRHH
      ? this.vacationService.getPendingRRHHRequests()
      : this.vacationService.getPendingManagerRequests()
  });

  readonly vacationDataResource = rxResource<VacationBalance | null, unknown>({
    stream: () => this.vacationService.getBalance()
  });

  readonly myRequestsResource = rxResource<VacationRequest[], unknown>({
    stream: () => this.vacationService.getMyRequests()
  });

  readonly allNewsResource = rxResource<News[], unknown>({
    stream: () => this.newsService.getAllNews(10, 0, ['publicada'])
  });

  // State
  readonly pendingRequests = computed(() => (this.pendingRequestsResource.value() as DashboardVacationRequest[]) ?? []);
  readonly vacationBalance = computed(() => {
    const data = this.vacationDataResource.value();
    if (data?.balances?.length) {
      return data.balances.find((b: any) => b.is_featured) ?? data.balances[0];
    }
    return null;
  });
  readonly myRequests = computed(() => this.myRequestsResource.value() ?? []);
  readonly allNews = computed(() => this.allNewsResource.value() ?? []);

  readonly processing = signal(false);
  readonly processingRequestId = signal<string | null>(null);

  readonly latestNews = signal<News | null>(null);
  readonly showNewsPopup = signal(false);

  constructor() {
    // Conexión reactiva al WebSocket
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.wsService.connect();
      }
    });

    this.checkLatestNews();

    // Reacción a mensajes del WebSocket
    effect(() => {
      const messages = this.wsService.messages();
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg) return;

      if (lastMsg.type === 'vacation_status_change') {
        this.pendingRequestsResource.reload();
        this.myRequestsResource.reload();
        this.vacationDataResource.reload();
      }
      if (lastMsg.type === 'db_update' && lastMsg.data.table === 'news') {
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
    } finally {
      this.processing.set(false);
      this.processingRequestId.set(null);
    }
  }

  closeNewsPopup(): void {
    this.showNewsPopup.set(false);
  }

  navigateToNews(): void {
    this.showNewsPopup.set(false);
    this.router.navigate(['/news']);
  }
}

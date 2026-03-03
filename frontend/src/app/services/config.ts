import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../config/environment';

export interface UploadLimits {
  maxImageSizeMB: number;
  maxDocumentSizeMB: number;
  maxComplaintPayloadMB: number;
  maxNewsPayloadMB: number;
  DAILY_UPLOAD_QUOTA_MB: number; // For backward compatibility if needed
  dailyUploadQuotaMB: number;
  bruteForceRedirectUrl: string;
  bruteForceMaxAttempts: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private http = inject(HttpClient);

  limits = signal<UploadLimits>({
    maxImageSizeMB: 10,
    maxDocumentSizeMB: 10,
    maxComplaintPayloadMB: 20,
    maxNewsPayloadMB: 30,
    dailyUploadQuotaMB: 50,
    DAILY_UPLOAD_QUOTA_MB: 50,
    bruteForceRedirectUrl: '',
    bruteForceMaxAttempts: 3
  });

  constructor() {
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const data = await firstValueFrom(
        this.http.get<UploadLimits>(`${environment.apiUrl}/config/upload-limits`)
      );
      this.limits.set({
        ...data,
        DAILY_UPLOAD_QUOTA_MB: data.dailyUploadQuotaMB // Sync both
      });
    } catch (err) {
      console.error('Error loading upload limits config:', err);
      // Keep defaults if error
    }
  }

  get maxImageSizeBytes(): number {
    return this.limits().maxImageSizeMB * 1024 * 1024;
  }

  get maxDocumentSizeBytes(): number {
    return this.limits().maxDocumentSizeMB * 1024 * 1024;
  }

  get maxComplaintPayloadBytes(): number {
    return this.limits().maxComplaintPayloadMB * 1024 * 1024;
  }

  get maxNewsPayloadBytes(): number {
    return this.limits().maxNewsPayloadMB * 1024 * 1024;
  }
}

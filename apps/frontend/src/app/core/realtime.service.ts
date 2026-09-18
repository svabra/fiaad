import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { RealtimeEvent } from './models';
import { TenantService } from './tenant.service';

export type ConnectionState = 'connecting' | 'connected' | 'degraded' | 'offline';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly tenant = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);
  private controller?: AbortController;
  private started = false;
  private retryTimer?: number;
  private retryCount = 0;
  readonly state = signal<ConnectionState>(navigator.onLine ? 'connecting' : 'offline');
  readonly latestEvent = signal<RealtimeEvent | null>(null);

  constructor() {
    const goOnline = () => this.reconnect();
    const goOffline = () => {
      this.state.set('offline');
      this.controller?.abort();
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    effect(() => {
      this.tenant.current().id;
      if (this.started) this.reconnect();
    });
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      this.controller?.abort();
      if (this.retryTimer) window.clearTimeout(this.retryTimer);
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.connect();
  }

  private reconnect(): void {
    if (!this.started || !navigator.onLine) return;
    this.controller?.abort();
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    this.retryCount = 0;
    void this.connect();
  }

  private async connect(): Promise<void> {
    if (!navigator.onLine) {
      this.state.set('offline');
      return;
    }
    this.controller = new AbortController();
    const localController = this.controller;
    this.state.set('connecting');
    try {
      const response = await fetch('/api/v1/events', {
        headers: this.tenant.headers(),
        signal: localController.signal,
        cache: 'no-store',
      });
      if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
      this.retryCount = 0;
      this.state.set('connected');
      await this.consume(response.body, localController.signal);
      if (!localController.signal.aborted) throw new Error('SSE stream ended');
    } catch {
      if (localController.signal.aborted) return;
      this.state.set(navigator.onLine ? 'degraded' : 'offline');
      const delay = Math.min(30_000, 1_000 * 2 ** this.retryCount++);
      this.retryTimer = window.setTimeout(() => void this.connect(), delay);
    }
  }

  private async consume(stream: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) {
          try {
            this.latestEvent.set(JSON.parse(data) as RealtimeEvent);
          } catch {
            // Ignore malformed frames and keep the single connection alive.
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  }
}


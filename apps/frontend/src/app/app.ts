import { NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppUpdateComponent } from './core/app-update.component';
import { RealtimeService } from './core/realtime.service';
import { TenantService } from './core/tenant.service';

@Component({
  imports: [NgClass, RouterLink, RouterLinkActive, RouterOutlet, AppUpdateComponent],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  readonly tenant = inject(TenantService);
  readonly realtime = inject(RealtimeService);
  readonly mobileNavOpen = signal(false);
  readonly connectionLabel = computed(() => {
    const labels = {
      connected: 'Online · Live verbunden',
      connecting: 'Verbindung wird aufgebaut',
      degraded: 'Online · Live-Kanal unterbrochen',
      offline: 'Offline · lokale Daten',
    } as const;
    return labels[this.realtime.state()];
  });

  constructor() {
    this.realtime.start();
  }

  selectTenant(tenantId: string): void {
    this.tenant.select(tenantId);
  }
}

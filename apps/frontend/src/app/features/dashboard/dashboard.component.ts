import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CurationEvent, DataProduct, Overview } from '../../core/models';
import { TenantService } from '../../core/tenant.service';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, DecimalPipe, RouterLink],
  template: `
    <section class="page dashboard-page">
      <div class="journey-hero">
        <div class="hero-grid-pattern" aria-hidden="true"></div>
        <div class="hero-copy">
          <span class="eyebrow">DAAIF · {{ tenant.current().shortLabel }}</span>
          <h1>Von erschlossenen Daten zur belastbaren Entscheidung.</h1>
          <p>Datenquellen verstehen, SQL sicher ausführen und nachvollziehbar kuratierte Datenprodukte bereitstellen – mandantenspezifisch und auch offline auffindbar.</p>
          <div class="hero-actions">
            <a class="button button-primary" routerLink="/query-studio">Query Studio öffnen</a>
            <a class="button button-secondary button-on-dark" routerLink="/catalog">Quellen ansehen</a>
          </div>
        </div>
        <div class="hero-orbit" aria-hidden="true">
          <span class="orbit-core">F</span><span class="orbit-node node-one">SQL</span><span class="orbit-node node-two">AI</span><span class="orbit-node node-three">API</span>
          <span class="orbit-line line-one"></span><span class="orbit-line line-two"></span><span class="orbit-line line-three"></span>
        </div>
      </div>

      <div class="kpi-grid" aria-label="DAAIF Kennzahlen">
        <article class="kpi-card"><span>Erschlossene Quellen</span><strong>{{ overview()?.source_count ?? '–' }}</strong><small>{{ overview()?.source_type_count ?? '–' }} Quellentypen</small></article>
        <article class="kpi-card"><span>Datenprodukte</span><strong>{{ overview()?.product_count ?? '–' }}</strong><small>{{ overview()?.published_product_count ?? '–' }} publiziert</small></article>
        <article class="kpi-card"><span>Qualität</span><strong>{{ averageQuality() | number:'1.0-0' }}%</strong><small>über kuratierte Produkte</small></article>
        <article class="kpi-card"><span>Letzte Kuratierung</span><strong class="kpi-date">{{ overview()?.latest_curation_at | date:'dd.MM.' }}</strong><small>{{ overview()?.latest_curation_at | date:'HH:mm' }} Uhr</small></article>
      </div>

      @if (error()) { <div class="notice notice-error">{{ error() }}</div> }

      <div class="dashboard-grid">
        <section class="panel">
          <div class="panel-heading"><div><span class="eyebrow eyebrow-dark">Weiterarbeiten</span><h2>Aktuelle Datenprodukte</h2></div><a routerLink="/products">Alle anzeigen <span aria-hidden="true">→</span></a></div>
          <div class="product-list compact-list">
            @for (product of products(); track product.id) {
              <article class="compact-product">
                <div class="product-symbol" aria-hidden="true">{{ product.name.slice(0, 1) }}</div>
                <div class="compact-main"><div class="compact-title"><h3>{{ product.name }}</h3><span class="status-pill" [class.is-published]="product.status === 'published'">{{ product.status }}</span></div><p>{{ product.description }}</p><div class="tag-row">@for (tag of product.tags; track tag) { <span>{{ tag }}</span> }</div></div>
                <div class="quality-score"><strong>{{ product.quality_score * 100 | number:'1.0-0' }}%</strong><span>Qualität</span></div>
              </article>
            } @empty { <div class="skeleton-block">Daten werden geladen …</div> }
          </div>
        </section>

        <section class="panel activity-panel">
          <div class="panel-heading"><div><span class="eyebrow eyebrow-dark">Nachvollziehbar</span><h2>Letzte Aktivitäten</h2></div></div>
          <ol class="timeline">
            @for (event of events(); track event.id) {
              <li><span class="timeline-dot" aria-hidden="true"></span><div><strong>{{ event.product_name }}</strong><p>{{ event.summary }}</p><small>{{ event.actor }} · {{ event.occurred_at | date:'dd.MM.yyyy, HH:mm' }}</small></div></li>
            } @empty { <li><span class="timeline-dot"></span><div><p>Aktivitäten werden geladen …</p></div></li> }
          </ol>
        </section>
      </div>
    </section>
  `,
})
export class DashboardComponent {
  readonly tenant = inject(TenantService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly overview = signal<Overview | null>(null);
  readonly products = signal<DataProduct[]>([]);
  readonly events = signal<CurationEvent[]>([]);
  readonly error = signal('');

  constructor() {
    effect(() => { this.tenant.current().id; this.load(); });
  }

  averageQuality(): number {
    const products = this.products();
    return products.length ? (products.reduce((sum, product) => sum + product.quality_score, 0) / products.length) * 100 : 0;
  }

  private load(): void {
    this.error.set('');
    forkJoin({ overview: this.api.overview(), products: this.api.products(), events: this.api.curationEvents() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ overview, products, events }) => { this.overview.set(overview); this.products.set(products); this.events.set(events.slice(0, 4)); },
        error: () => this.error.set('Für diesen Mandanten sind noch keine lokalen oder online verfügbaren Katalogdaten vorhanden.'),
      });
  }
}


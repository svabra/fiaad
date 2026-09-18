import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CurationEvent, DataProduct } from '../../core/models';
import { TenantService } from '../../core/tenant.service';

@Component({
  selector: 'app-products',
  imports: [DatePipe, DecimalPipe],
  template: `
    <section class="page">
      <header class="page-heading"><div><span class="eyebrow eyebrow-dark">Governed Data</span><h1>Kuratierte Datenprodukte</h1><p>Qualität, Herkunft und Verantwortlichkeit bleiben von der Quelle bis zur Publikation sichtbar.</p></div><div class="heading-stat"><strong>{{ products().length }}</strong><span>Produkte im Mandanten</span></div></header>
      <div class="products-layout">
        <section class="product-card-grid">
          @for (product of products(); track product.id) {
            <article class="product-card">
              <div class="product-card-top"><div class="product-symbol product-symbol-large">{{ product.name.slice(0, 1) }}</div><span class="status-pill" [class.is-published]="product.status === 'published'">{{ product.status }}</span></div>
              <h2>{{ product.name }}</h2><p>{{ product.description }}</p>
              <div class="quality-bar"><div><span>Qualitätswert</span><strong>{{ product.quality_score * 100 | number:'1.0-0' }}%</strong></div><span class="quality-track"><span [style.width.%]="product.quality_score * 100"></span></span></div>
              <dl class="product-meta"><div><dt>Kuratiert durch</dt><dd>{{ product.curated_by }}</dd></div><div><dt>Letzte Änderung</dt><dd>{{ product.curated_at | date:'dd.MM.yyyy, HH:mm' }}</dd></div><div><dt>Quellen</dt><dd>{{ product.source_ids.join(', ') }}</dd></div></dl>
              <div class="tag-row">@for (tag of product.tags; track tag) { <span>{{ tag }}</span> }</div>
            </article>
          }
        </section>
        <aside class="panel audit-panel">
          <div class="panel-heading"><div><span class="eyebrow eyebrow-dark">Audit Trail</span><h2>Wer hat wann kuratiert?</h2></div></div>
          <ol class="timeline detailed-timeline">
            @for (event of events(); track event.id) { <li><span class="timeline-dot"></span><div><span class="event-action">{{ actionLabel(event.action) }}</span><strong>{{ event.product_name }}</strong><p>{{ event.summary }}</p><small>{{ event.actor }}</small><time>{{ event.occurred_at | date:'dd.MM.yyyy · HH:mm' }}</time></div></li> }
          </ol>
        </aside>
      </div>
    </section>
  `,
})
export class ProductsComponent {
  readonly tenant = inject(TenantService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly products = signal<DataProduct[]>([]);
  readonly events = signal<CurationEvent[]>([]);

  constructor() {
    effect(() => {
      this.tenant.current().id;
      forkJoin({ products: this.api.products(), events: this.api.curationEvents() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ products, events }) => { this.products.set(products); this.events.set(events); });
    });
  }

  actionLabel(action: CurationEvent['action']): string { return { created: 'Angelegt', enriched: 'Angereichert', validated: 'Validiert', published: 'Publiziert' }[action]; }
}


import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { DataSource, DataSourceType } from '../../core/models';
import { TenantService } from '../../core/tenant.service';

@Component({
  selector: 'app-catalog',
  imports: [DatePipe],
  template: `
    <section class="page">
      <header class="page-heading">
        <div><span class="eyebrow eyebrow-dark">Data Catalog</span><h1>Erschlossene Datenquellen</h1><p>Technische Endpunkte werden katalogisiert, geprüft und strikt dem aktiven Mandanten zugeordnet.</p></div>
        <label class="search-field"><span>Quellen durchsuchen</span><input type="search" placeholder="Name, Typ oder Owner" [value]="search()" (input)="search.set($any($event.target).value)" /></label>
      </header>
      <div class="source-type-grid">
        @for (type of sourceTypes(); track type.kind) { <article class="source-type-card"><span class="source-type-icon" aria-hidden="true">{{ sourceIcon(type.kind) }}</span><div><strong>{{ type.label }}</strong><small>{{ type.count }} verbunden</small></div><span class="source-chevron">→</span></article> }
      </div>
      <section class="panel catalog-panel">
        <div class="panel-heading"><div><span class="eyebrow eyebrow-dark">{{ tenant.current().shortLabel }}</span><h2>Quellenregister</h2></div><span class="result-count">{{ filteredSources().length }} Ergebnisse</span></div>
        <div class="table-scroll"><table class="data-table source-table">
          <thead><tr><th>Status</th><th>Quelle</th><th>Typ</th><th>Verantwortung</th><th>Erschlossen</th><th>Fähigkeiten</th></tr></thead>
          <tbody>
            @for (source of filteredSources(); track source.id) {
              <tr><td><span class="availability" [class.is-degraded]="source.status === 'degraded'"><span></span>{{ source.status === 'available' ? 'Verfügbar' : 'Eingeschränkt' }}</span></td><td><strong>{{ source.name }}</strong><small class="table-subline">{{ source.location }}</small></td><td><span class="kind-pill">{{ source.kind }}</span></td><td>{{ source.owner }}</td><td>{{ source.discovered_at | date:'dd.MM.yyyy' }}</td><td><div class="tag-row">@for (capability of source.capabilities; track capability) { <span>{{ capability }}</span> }</div></td></tr>
            } @empty { <tr><td colspan="6" class="empty-cell">Keine passende Quelle gefunden.</td></tr> }
          </tbody>
        </table></div>
      </section>
    </section>
  `,
})
export class CatalogComponent {
  readonly tenant = inject(TenantService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sourceTypes = signal<DataSourceType[]>([]);
  readonly sources = signal<DataSource[]>([]);
  readonly search = signal('');
  readonly filteredSources = computed(() => {
    const needle = this.search().trim().toLocaleLowerCase();
    return needle ? this.sources().filter((source) => [source.name, source.kind, source.owner, source.description].some((value) => value.toLocaleLowerCase().includes(needle))) : this.sources();
  });

  constructor() {
    effect(() => {
      this.tenant.current().id;
      forkJoin({ types: this.api.sourceTypes(), sources: this.api.sources() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ types, sources }) => { this.sourceTypes.set(types); this.sources.set(sources); });
    });
  }

  sourceIcon(kind: string): string { return kind === 'postgresql' ? 'PG' : kind === 's3' ? 'S3' : '01'; }
}


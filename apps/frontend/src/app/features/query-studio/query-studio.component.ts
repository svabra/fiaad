import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api.service';
import { LocalDataService } from '../../core/local-data.service';
import { QueryExecutionResult, QueryOptimizationResult } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { TenantService } from '../../core/tenant.service';

const SAMPLE_SQL = `SELECT region, SUM(amount) AS revenue
FROM (SELECT * FROM sales) raw
WHERE EXTRACT(YEAR FROM order_date) = 2026
GROUP BY region
ORDER BY revenue DESC;`;

@Component({
  selector: 'app-query-studio',
  imports: [DatePipe, DecimalPipe],
  template: `
    <section class="query-page">
      <header class="query-header">
        <div><span class="eyebrow eyebrow-dark">Query Workbench</span><h1>SQL analysieren und verbessern</h1><p>DuckDB führt ausschließlich freigegebene Read-only-Abfragen im aktiven Mandanten aus.</p></div>
        <div class="query-header-meta"><span class="live-event"><i></i>{{ liveStatus() }}</span><span>Relation: <strong>sales</strong></span></div>
      </header>

      <div class="query-workspace">
        <section class="editor-panel">
          <div class="editor-toolbar">
            <div class="editor-tabs"><button class="is-active" type="button">analyse.sql</button><button type="button" disabled>+</button></div>
            <div class="editor-actions">
              <button class="button button-ai" type="button" (click)="optimize()" [disabled]="busy() || !online()"><span aria-hidden="true">✦</span>{{ optimizing() ? 'Optimiert …' : 'Mit AI optimieren' }}</button>
              <button class="button button-run" type="button" (click)="execute()" [disabled]="busy() || !online()"><span aria-hidden="true">▶</span>{{ executing() ? 'Läuft …' : 'Ausführen' }}</button>
            </div>
          </div>
          <div class="code-editor-shell">
            <div class="line-numbers" aria-hidden="true">@for (line of editorLines(); track $index) { <span>{{ $index + 1 }}</span> }</div>
            <textarea aria-label="DuckDB SQL" spellcheck="false" [value]="sql()" (input)="setSql($any($event.target).value)"></textarea>
          </div>
          <footer class="editor-footer"><span>DuckDB SQL</span><span>UTF-8</span><span>Nur SELECT</span><span>{{ sql().length }} Zeichen</span></footer>
        </section>

        <aside class="schema-panel">
          <div class="schema-heading"><span>Schema</span><small>1 Relation</small></div>
          <div class="schema-tree"><div class="schema-database"><span class="tree-disclosure">⌄</span><strong>tenant_{{ tenant.current().id }}</strong></div><div class="schema-table"><span class="tree-disclosure">⌄</span><strong>sales</strong></div>
            <ul><li><span>#</span>order_id <small>INTEGER</small></li><li><span>◷</span>order_date <small>DATE</small></li><li><span>A</span>region <small>VARCHAR</small></li><li><span>A</span>category <small>VARCHAR</small></li><li><span>#</span>amount <small>DECIMAL</small></li></ul>
          </div>
          <div class="schema-security"><span aria-hidden="true">◇</span><p><strong>Mandantenisoliert</strong>DuckDB-Datei und Ergebnis-Cache sind getrennt.</p></div>
        </aside>
      </div>

      @if (error()) { <div class="notice notice-error query-notice">{{ error() }}</div> }
      @if (!online()) { <div class="notice notice-offline query-notice"><strong>Offline-Modus.</strong> Gespeicherte Ergebnisse bleiben sichtbar; Ausführung und AI-Optimierung benötigen eine Verbindung.</div> }

      @if (optimization(); as optimized) {
        <section class="optimization-panel panel">
          <div class="panel-heading optimization-heading"><div><span class="eyebrow eyebrow-dark">{{ optimized.optimizer === 'ai-gateway' ? 'AI Gateway' : 'Sicherer Fallback' }}</span><h2>Optimierungsvorschlag</h2></div><button class="button button-secondary" type="button" (click)="applyOptimization()">Optimierte Query übernehmen</button></div>
          <div class="optimization-summary"><span class="insight-icon">?</span><div><small>Was beantwortet diese Abfrage wahrscheinlich?</small><p>{{ optimized.likely_question }}</p></div></div>
          <div class="optimization-grid">
            <div class="explanation-card"><h3>Warum läuft sie besser?</h3><ul>@for (reason of optimized.explanation; track reason) { <li>{{ reason }}</li> }</ul>@for (warning of optimized.warnings; track warning) { <p class="optimizer-warning">{{ warning }}</p> }</div>
            <div class="diff-card"><div class="diff-heading"><h3>Code-Differenz</h3><span><i class="add-key"></i>Neu <i class="remove-key"></i>Entfernt</span></div><div class="visual-diff" role="table" aria-label="SQL Differenz">
              @for (line of optimized.diff; track $index) { <div class="diff-line" [class.is-added]="line.kind === 'add'" [class.is-removed]="line.kind === 'remove'"><span class="diff-number">{{ line.old_line ?? '' }}</span><span class="diff-number">{{ line.new_line ?? '' }}</span><span class="diff-marker">{{ line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' ' }}</span><code>{{ line.text || ' ' }}</code></div> }
            </div></div>
          </div>
        </section>
      }

      <section class="results-panel panel">
        <div class="panel-heading results-heading"><div><span class="eyebrow eyebrow-dark">Result Set</span><h2>Abfrageergebnis</h2></div>
          @if (result(); as current) { <div class="result-meta"><span [class.cached-badge]="fromCache()">{{ fromCache() ? 'Lokal gespeichert' : 'Soeben ausgeführt' }}</span><strong>{{ current.row_count }} Zeilen</strong><span>{{ current.duration_ms | number:'1.0-2' }} ms</span><span>{{ current.executed_at | date:'HH:mm:ss' }}</span></div> }
        </div>
        @if (result(); as current) {
          <div class="table-scroll"><table class="data-table result-table"><thead><tr>@for (column of current.columns; track column) { <th>{{ column }}</th> }</tr></thead><tbody>@for (row of current.rows; track $index) { <tr>@for (cell of row; track $index) { <td>{{ cell }}</td> }</tr> }</tbody></table></div>
        } @else { <div class="empty-result"><span aria-hidden="true">▶</span><h3>Bereit für die erste Abfrage</h3><p>Führen Sie das Beispiel aus oder laden Sie ein lokal gespeichertes Resultat.</p></div> }
      </section>
    </section>
  `,
})
export class QueryStudioComponent {
  readonly tenant = inject(TenantService);
  readonly realtime = inject(RealtimeService);
  private readonly api = inject(ApiService);
  private readonly localData = inject(LocalDataService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sql = signal(SAMPLE_SQL);
  readonly result = signal<QueryExecutionResult | null>(null);
  readonly optimization = signal<QueryOptimizationResult | null>(null);
  readonly executing = signal(false);
  readonly optimizing = signal(false);
  readonly error = signal('');
  readonly fromCache = signal(false);
  readonly online = signal(navigator.onLine);

  constructor() {
    const updateOnline = () => this.online.set(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    this.destroyRef.onDestroy(() => { window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); });
    effect(() => { void this.restoreLocal(this.tenant.current().id); });
  }

  busy(): boolean { return this.executing() || this.optimizing(); }
  editorLines(): string[] { return this.sql().split('\n'); }
  setSql(value: string): void { this.sql.set(value); this.optimization.set(null); }
  liveStatus(): string { const event = this.realtime.latestEvent(); return event?.topic === 'query.completed' ? 'Query abgeschlossen' : 'Live-Monitor aktiv'; }

  execute(): void {
    if (!this.online() || this.busy()) return;
    this.executing.set(true); this.error.set('');
    this.api.execute(this.sql()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.result.set(result); this.fromCache.set(false); this.executing.set(false); void this.localData.putQuery(this.tenant.current().id, this.sql(), result); },
      error: (error: HttpErrorResponse) => { this.error.set(this.errorMessage(error)); this.executing.set(false); },
    });
  }

  optimize(): void {
    if (!this.online() || this.busy()) return;
    this.optimizing.set(true); this.error.set('');
    this.api.optimize(this.sql()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (optimization) => { this.optimization.set(optimization); this.optimizing.set(false); void this.localData.putOptimization(this.tenant.current().id, this.sql(), optimization); },
      error: (error: HttpErrorResponse) => { this.error.set(this.errorMessage(error)); this.optimizing.set(false); },
    });
  }

  applyOptimization(): void { const optimized = this.optimization(); if (optimized) this.sql.set(optimized.optimized_sql); }

  private async restoreLocal(tenantId: string): Promise<void> {
    const stored = await this.localData.latestQuery(tenantId);
    if (!stored || this.tenant.current().id !== tenantId) { this.result.set(null); this.optimization.set(null); this.fromCache.set(false); return; }
    this.sql.set(stored.sql);
    this.result.set(stored.result ?? null);
    this.optimization.set(stored.optimization ?? null);
    this.fromCache.set(Boolean(stored.result));
  }

  private errorMessage(error: HttpErrorResponse): string {
    return typeof error.error?.detail === 'string' ? error.error.detail : 'Die Anfrage konnte nicht verarbeitet werden.';
  }
}

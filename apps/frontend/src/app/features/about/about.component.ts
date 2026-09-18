import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  template: `
    <section class="page architecture-page">
      <header class="page-heading"><div><span class="eyebrow eyebrow-dark">Target Blueprint</span><h1>N-Tier heute, verteilbar morgen</h1><p>Jeder Laufzeitbaustein besitzt ein eigenes Image. Fachlogik kommuniziert über stabile Ports statt über Prozessgrenzen.</p></div><span class="architecture-version">Architecture baseline · 0.1</span></header>
      <div class="architecture-flow" aria-label="DAAIF Laufzeitarchitektur">
        <article><span class="tier-index">01</span><small>Client Tier</small><h2>Angular PWA</h2><p>App-Shell, mandantenspezifischer IndexedDB-Cache und ein multiplexter SSE-Kanal.</p><span class="tech-pill">:8080</span></article>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <article><span class="tier-index">02</span><small>Edge Tier</small><h2>API</h2><p>Authentisierung, Tenant Context, REST-Verträge, SSE-Proxy und Policy Enforcement.</p><span class="tech-pill">:8000</span></article>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <article class="tier-highlight"><span class="tier-index">03</span><small>Application Tier</small><h2>Backend</h2><p>Katalog-Use-Cases, Query-Orchestrierung und heute noch eingebettete DuckDB Engine.</p><span class="tech-pill">:8001</span></article>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <article><span class="tier-index">04</span><small>AI Access Tier</small><h2>MCP Server</h2><p>Read-only-Werkzeuge greifen ausschließlich über die öffentliche DAAIF API zu.</p><span class="tech-pill">:8002/mcp</span></article>
      </div>
      <section class="future-split panel">
        <div class="future-copy"><span class="eyebrow eyebrow-dark">Geplante Entkopplung</span><h2>Das Backend besitzt bereits die späteren Service-Nähte.</h2><p>QueryOrchestrator und QueryEngine hängen an Ports. Für die Verteilung wird der In-Process-Adapter durch Queue/HTTP/gRPC ersetzt; REST- und UI-Verträge bleiben stabil.</p></div>
        <div class="split-diagram"><div><small>Backend Core</small><strong>Catalog &amp; Governance</strong></div><span>→</span><div><small>Query Orchestrator</small><strong>Jobs &amp; Routing</strong></div><span>→</span><div><small>Query Engine</small><strong>DuckDB Worker Pool</strong></div></div>
      </section>
      <div class="principle-grid">
        <article><span>◇</span><h3>Tenant by construction</h3><p>Tenant-ID ist Teil jedes Use-Case-Aufrufs, Storage-Pfads, Cache-Keys und Events.</p></article>
        <article><span>↯</span><h3>Ein Live-Kanal</h3><p>Ein SSE-Stream multiplexiert Query-, Katalog- und Systemereignisse pro laufendem Client.</p></article>
        <article><span>✦</span><h3>AI mit Leitplanken</h3><p>Nur SQL und Schema verlassen das Backend; Resultatdaten werden nicht an das Gateway gesendet.</p></article>
        <article><span>□</span><h3>Offline bewusst</h3><p>Lesen aus mandantenspezifischem Cache ist möglich. Schreib- und Query-Aktionen bleiben online-only.</p></article>
      </div>
    </section>
  `,
})
export class AboutComponent {}


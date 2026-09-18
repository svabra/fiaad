# ADR 0001: Modularer Backend-Monolith vor Service-Aufteilung

- Status: Accepted
- Datum: 2026-09-14

## Kontext

Der erste PoC bündelte UI, API und DuckDB in einem Container. Die Zielarchitektur muss getrennt deploybar sein; gleichzeitig sind Lastprofil, Orchestrator-Protokoll und Betriebsplattform noch nicht final.

## Entscheidung

Frontend, API und Backend werden sofort getrennte Images. Im Backend bleiben Catalog Core, Query Orchestrator und Query Engine zunächst in einem Prozess, kommunizieren aber ausschließlich über explizite Ports und Request/Result-Modelle. MCP ist ein viertes, read-only Image und nutzt nur die API.

## Konsequenzen

- Klare Sicherheits- und Deployment-Grenzen entstehen jetzt.
- Lokale Entwicklung bleibt mit Docker Compose einfach.
- Die spätere Engine-Verteilung erfordert einen Adapter statt eines fachlichen Rewrite.
- Verteilte Cancel-, Retry-, Result-Storage- und Exactly-once-/Idempotenz-Semantik werden bewusst erst mit dem realen Plattformvertrag festgelegt.


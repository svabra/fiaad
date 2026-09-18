# DAAIF Entwicklungsstatus

Stand: 2026-09-18  
Gültig für: Repository `svabra/fiaad` – alle Produkt- und Codenamen bleiben **DAAIF**.

Dieses Dokument ist die verbindliche Arbeitsorientierung für die Migration. Es wird bei jeder funktionalen Änderung im selben Commit aktualisiert. Produktbeschreibung und kompakter Funktionsstand stehen zusätzlich im [README](README.md).

## Gesamtbild

| Dimension | Einschätzung | Begründung |
| --- | --- | --- |
| Zielarchitektur-Grundgerüst | **weit fortgeschritten** | Vier Images, API-Grenze, modularer Backend-Kern, QueryEngine-Port, MCP und Compose sind vorhanden |
| Übertragene Legacy-Funktionalität | **frühe Phase** | Query-Basis und Katalog-Lesepfade existieren; die grossen Legacy-Bereiche Ingestion, Explorer, Notebooks/Pipelines und Data Exchange fehlen |
| Produktionsreife | **frühe Phase** | Demo-Auth, Seed-Katalog, In-Memory-Events und In-Process-DuckDB müssen produktiv ersetzt/gehärtet werden |

Eine Prozentzahl wäre derzeit irreführend: Der Architekturanteil ist deutlich weiter als die fachliche Funktionsparität. Der alte PoC bleibt bis zur expliziten Abnahme jedes vertikalen Slices die Verhaltensreferenz.

## Aktuell implementiert und verifiziert

- Angular 22 PWA mit DAAIF-Shell und responsiver Navigation
- installierbarer App-Shell-Service-Worker
- automatische Laufzeitaktualisierung nach dem Muster von `tib-daca-poc/apps/catalog-ui`:
  - sofortige Registrierung und Prüfung bei kontrollierendem Service Worker;
  - 15-minütige sowie Online-/Visibility-/Controller-Prüfungen;
  - automatische Startaktualisierung nur vor Benutzerinteraktion;
  - manueller, warnender Bestätigungsdialog während einer Sitzung;
  - ausschliesslich vollständiger Reload – kein `activateUpdate()` in die laufende App;
  - Session-Guard gegen Reload-Schleifen und sicheres Verhalten ohne Session Storage;
  - Unit-Tests für Start-, Interaktions-, Fehler-, Metadaten- und Lifecycle-Fälle.
- tenant-spezifischer IndexedDB-Cache für GET-Antworten und letztes Query-Resultat
- sichtbarer Online-/Offline-/SSE-Zustand; ein multiplexter SSE-Kanal pro Client
- REST API mit signiertem internem Tenant Context
- Backend-Core mit Ports für Katalog, SQL-Optimierung und Query Engine
- sichere Read-only-DuckDB-Ausführung gegen erlaubte Relationen
- AI-Gateway-Adapter plus validierter Regel-Fallback, Erklärung und Code-Diff
- eigenständiger MCP-Server auf Basis des Python MCP SDK 2 mit fünf read-only Tools
- lokale Compose-Topologie und getrennte Images für Frontend, API, Backend und MCP

Letzte Verifikation:

```text
Angular: 9 Tests erfolgreich
Angular: Production Build erfolgreich
Python: letzter Baseline-Lauf 7 Tests erfolgreich
Python-Rerun: in dieser Laufzeit durch inkompatibles natives DuckDB-Wheel (Bus error) blockiert; Änderung betrifft nur Angular und Dokumentation
Compose-Validierung: Docker CLI in dieser Laufzeit nicht verfügbar
```

## Aktuelle Risiken und offene Architekturentscheidungen

1. Der Katalog verwendet Seed-Daten statt einer persistenten Metadatenbank mit Row-Level Security.
2. Authentisierung und Rollen sind lokal simuliert; der Vertrag mit Plattform-Orchestrator/IAM fehlt.
3. Query Orchestrator und DuckDB Engine sind fachlich getrennt, aber noch im selben Prozess.
4. Der Event Broker ist in-memory; Resume, Replay und verteilte Zustellung fehlen.
5. Reale Source Credentials, Vault/Credential Broker und Klassifizierungsregeln fehlen.
6. Offline-Caches sind tenant-geschlüsselt, aber noch nicht verschlüsselt oder per Datenklasse steuerbar.
7. Der konkrete BIT-AI-Gateway-Vertrag muss den vorläufigen OpenAI-kompatiblen Adapter ersetzen oder bestätigen.
8. Die GitHub-App kann öffentliche Inhalte lesen, ist für `svabra/fiaad` aktuell aber nicht als beschreibbare Installation sichtbar.

## Entwicklungsplan

### M0 – Repository- und Update-Baseline

Status: **in Arbeit**

- [x] FIAAD nur als Repositoryname; intern durchgängig DAAIF
- [x] `README.md` als Produkt-/Funktionsübersicht
- [x] `AGENTS.md` mit verbindlichem Migrationsvorgehen
- [x] `DEV_STATUS.md` als laufende Statusquelle
- [x] DACA-artige automatische PWA-Laufzeitaktualisierung
- [x] Unit-Tests und Production Build für den Updater
- [ ] A/B-Browsertest mit zwei Builds und genau einem Reload in CI
- [ ] zentrale Release-Version synchron in TypeScript und `ngsw-config.json` verwalten
- [ ] Angular-Evergreen-Workflow: planmässig `ng update`, vollständige CI, Review, kontrollierter Rollback
- [ ] Windows-Clone unter `C:\Users\braya\apps\BIT\fiaad` auf dem Zielrechner verifizieren

### M1 – Query Workbench als erster Legacy-Slice

Status: **Basis vorhanden**

- [x] einzelne Read-only-Query ausführen
- [x] Resultat, Laufzeit und Limit anzeigen
- [x] letztes Resultat lokal pro Tenant cachen
- [x] Query per AI Gateway/Regeln optimieren und Diff erklären
- [ ] Notebook-Domainmodell, Autosave und Versionierung
- [ ] Multi-Cell SQL/Python Editor und Query-Quellen
- [ ] Run-History, Explain/Plan, Timing, Cancel und Fortschritt
- [ ] Result-Export und optionaler tenant-isolierter Object-Storage
- [ ] bestehende Legacy-Regressionen als API-/Angular-E2E-Tests neu aufbauen

### M2 – Reale Datenquellen und Explorer

Status: **geplant**

- [ ] Source/Credential Ports und Policy-Prüfung definieren
- [ ] S3-, PostgreSQL- und Oracle-Adapter
- [ ] Local Workspace und S3-Browser mit sicherer Pfadvalidierung
- [ ] Schema-/DDL-Ansicht und Query-Handoff
- [ ] Quell-Discovery, Status und tenant-isolierte Metadatenpersistenz

### M3 – Ingestion Workbench

Status: **geplant**

- [ ] Upload-/Job-Verträge, Quotas, Cancel und Fortschritt
- [ ] CSV/ZIP, JSON, XLSX, XML und Parquet
- [ ] Vorschau, Typinferenz, Normalisierung und Parquet-Ausgabe
- [ ] Übergabe an Query Studio sowie Source-/Lineage-Registrierung

### M4 – Notebooks, Pipelines und geteilte Arbeit

Status: **geplant**

- [ ] lokaler und geteilter Workspace mit klarer Ownership
- [ ] Notebook-Baum, Ordner, Drag-and-drop und Metadaten
- [ ] materialisierte Stufen und wiederholbare Pipelines
- [ ] Python-Ausführung in isolierten Workern
- [ ] Event- und Konfliktmodell für gleichzeitige Änderungen

### M5 – Datenprodukte und Data Exchange

Status: **teilweise**

- [x] Produktliste und Kurationshistorie lesen
- [ ] Produkt erstellen, validieren, versionieren und überschreiben
- [ ] S3-Parquet als Produktquelle und paginierte Vorschau
- [ ] DACA-Publikation/Reconciliation mit Idempotenz und Fail-Closed-Policy
- [ ] Data-Exchange-Upload, Download, Move und Query-Handoff
- [ ] manipulationssicherer Audit Trail und Lineage

### M6 – Mandantenfähigkeit und Produktionshärtung

Status: **teilweise vorbereitet**

- [ ] OIDC/JWT und Token Exchange mit dem Plattform-Orchestrator
- [ ] objektbezogene Policy Engine, Quotas und Rate Limits
- [ ] PostgreSQL-Katalog mit RLS und Migrationen
- [ ] verteilter Event Bus und getrennte Query-Worker
- [ ] tenant-isolierte Secrets, Temp-Daten, Resultate, Logs und Traces
- [ ] verschlüsselter/klassifizierter Offline-Cache oder Cache-Verbot je Datenklasse
- [ ] Cross-Tenant-Negativtests, Security Scan, SBOM und Penetrationstest
- [ ] SLOs, Monitoring, Backup/Restore, Retention und Offboarding

## Nächste empfohlene Arbeit

1. M0 abschliessen: A/B-PWA-Test, Versionsskript und Angular-Evergreen-CI.
2. M1 vertikal migrieren: Notebook-Domainmodell plus einen echten gespeicherten SQL-Run Ende-zu-Ende.
3. Erst danach den S3-Source-Port aus M2 anbinden; so werden UI, API, Orchestrator und Engine nicht wieder quer gekoppelt.

## Pflege-Regel

Bei jedem Slice müssen mindestens diese Stellen gemeinsam aktualisiert werden:

1. Implementierung und automatisierte Tests;
2. die betroffene Zeile der Produktmatrix in `README.md`;
3. Checkboxen, Risiken und Verifikationsnachweis in diesem Dokument;
4. Architektur-/Betriebsdokumente, falls ein Vertrag oder eine Grenze verändert wurde.

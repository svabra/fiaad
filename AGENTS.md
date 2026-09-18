# DAAIF Arbeitsanweisungen

Diese Regeln gelten für das gesamte Repository. Untergeordnete `AGENTS.md` dürfen sie für einen Teilbaum präzisieren, aber Architektur- und Sicherheitsgrenzen nicht abschwächen.

## Name und Arbeitsverzeichnis

- Nur Repository, Clone-Ordner und GitHub-URL heissen `fiaad`.
- Produkt, UI, Services, Python-/npm-Packages, Images, Umgebungsvariablen, Protokolle und Dokumentation heissen **DAAIF** bzw. `daaif`.
- Vorgesehener Windows-Clone: `C:\Users\braya\apps\BIT\fiaad`.
- Vor Arbeiten auf dem Zielrechner prüfen:

```powershell
Test-Path C:\Users\braya\apps\BIT\fiaad\.git
git -C C:\Users\braya\apps\BIT\fiaad remote -v
git -C C:\Users\braya\apps\BIT\fiaad status --short
```

Wenn der Clone fehlt:

```powershell
Set-Location C:\Users\braya\apps\BIT
git clone https://github.com/svabra/fiaad.git fiaad
```

## Vor jeder Änderung

1. `README.md`, `DEV_STATUS.md`, dieses Dokument und einschlägige ADRs lesen.
2. Den passenden Funktionsbereich im alten PoC `svabra/tib-daail-evo1-poc-query-engine` ermitteln.
3. Verhalten, Sicherheitsregeln und Regressionstests als Referenz aufnehmen; die alte Kopplung von UI und Backend nicht kopieren.
4. Dirty Worktree und bestehende Benutzeränderungen respektieren.
5. Den kleinsten vollständigen vertikalen Slice planen: Angular → API → Use Case → Port/Adapter → Tests → Dokumentation.

## Migrationsprinzip

- Migriert wird beobachtbares Produktverhalten, nicht die alte Dateistruktur.
- Jeder Slice besitzt explizite DTOs und Verantwortungsgrenzen.
- Das Angular-Frontend spricht ausschliesslich mit der öffentlichen API.
- Der MCP-Server spricht ebenfalls ausschliesslich mit der API und bleibt standardmässig read-only.
- Die API besitzt externe Verträge, AuthN/AuthZ-Hooks, Tenant Context und Edge-Policies; sie führt kein DuckDB aus.
- Backend-Use-Cases hängen von Ports ab, nicht direkt von HTTP, DuckDB, S3 oder dem AI-Gateway-Protokoll.
- `QueryOrchestrator` und `QueryEngine` bleiben so getrennt, dass ein In-Process-Adapter später durch Queue/gRPC/HTTP ersetzt werden kann.
- Kein neuer Funktionsbereich darf die spätere Aufteilung in Backend Core, Query Orchestrator und Query Engine erschweren.

## Verbindliche Querschnittsregeln

### Mandantenfähigkeit

- Tenant und Benutzer kommen in Produktion nur aus verifizierten Claims, nie aus frei wählbaren Body-/Query-Parametern.
- Tenant Context wird unveränderlich durch alle Aufrufe, Jobs, Events, Caches und Audit-Einträge getragen.
- Cache Keys, Storage-Pfade, DB-Schlüssel, Event-Topics und Job-IDs müssen tenant-isoliert sein.
- Jeder neue Datenzugriff braucht einen negativen Cross-Tenant-Test.
- Details und Abnahmekriterien: `docs/multitenancy.md`.

### Query-Sicherheit

- Standard ist eine einzelne Read-only-Anweisung.
- DDL, DML, `ATTACH`, `COPY`, `INSTALL`, `LOAD`, externe URLs und unkontrollierte Datei-Leser bleiben gesperrt.
- Relation-Allowlist, Result-Limit, Timeout, Cancel und Ressourcenlimit gehören vor produktiver Freigabe in den Ausführungspfad.
- AI-generiertes SQL ist unvertrauenswürdig, wird erneut validiert und nie automatisch ausgeführt.

### Realtime und Offline

- Pro Client/User existiert genau eine langlebige SSE-Verbindung; Topics werden darin multiplexiert.
- Keine komponentenspezifischen zusätzlichen SSE-/WebSocket-Verbindungen eröffnen.
- Offline-Zustand bleibt permanent sichtbar.
- Offline-Schreibaktionen werden nicht stillschweigend später ausgeführt. Queueing braucht explizite UX, Idempotenz und Konfliktregeln.
- Lokale Daten dürfen nach Tenant-Wechsel niemals einem anderen Tenant angezeigt werden.

### Automatische Angular-PWA-Aktualisierung

- Das in `apps/frontend/src/app/core/app-update.service.ts` übernommene DACA-Muster ist eine Sicherheitsanforderung.
- Keine neue Version mit `activateUpdate()` in die laufende App mischen; Übernahme nur per vollständigem Reload.
- Bei unberührtem Start darf nach erfolgreicher Installation automatisch neu geladen werden.
- Nach Benutzerinteraktion muss ein Update sichtbar angeboten und vor dem Reload bestätigt werden.
- Reload-Loop-Guard, Installationsfehler und unrecoverable state müssen fail-safe bleiben.
- `app-version.ts` und `ngsw-config.json.appData.releaseVersion` müssen bei Releases synchron sein.
- Änderungen brauchen Unit-Tests; vorgesehen ist zusätzlich ein A/B-PWA-Browsertest mit altem und neuem Build.

### Angular Evergreen

- Laufzeit-App-Updates und Framework-Abhängigkeitsupdates sind zwei verschiedene Mechanismen.
- Angular-/CLI-/Build-/Service-Worker-Versionen werden gemeinsam mit `ng update` angehoben.
- Ein automatisierter Update-PR darf erst nach Unit Tests, Production Build, PWA-A/B-Test und Review gemergt werden.
- Keine blinden Major-Upgrades und keine dauerhaft ignorierten Migrationswarnungen.

## Definition of Done für einen migrierten Slice

- fachlicher Happy Path und relevante Fehler-/Berechtigungspfade sind Ende-zu-Ende ausführbar;
- API- und Event-Verträge sind typisiert und dokumentiert;
- Tenant-Isolation und Query-/Storage-Sicherheit sind getestet;
- Angular-Unit-Tests sowie Python-Tests laufen grün; Production Build funktioniert;
- bei kritischen Journeys existiert ein Browser-/Integrations-Smoke-Test;
- kein direkter Frontend- oder MCP-Zugriff auf Backend/DB wurde eingeführt;
- Produktmatrix in `README.md` und Arbeitsstand in `DEV_STATUS.md` sind im selben Commit aktualisiert;
- Legacy-Funktion wird erst als migriert markiert, wenn ihr relevanter Umfang abgenommen ist.

## Standard-Verifikation

```bash
python -m pytest
npm --prefix apps/frontend test -- --watch=false
npm --prefix apps/frontend run build
docker compose config
```

Erweiterte Tests eines migrierten Funktionsbereichs kommen hinzu; bestehende Prüfungen werden nicht ohne dokumentierte Begründung entfernt.

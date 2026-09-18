# Was „mandantenfähig“ für DAAIF bedeutet

Mandantenfähigkeit ist keine einzelne Spalte `tenant_id`. Sie ist die nachweisbare Eigenschaft, dass Identitäten, Daten, Rechenressourcen, Caches, Ereignisse, Konfiguration und Betrieb eines Mandanten niemals unautorisiert auf einen anderen Mandanten wirken. DAAIF muss diese Eigenschaft an jeder Grenze erzwingen, auch wenn der künftige Plattform-Orchestrator die Instanzen startet und Identitäten liefert.

## Verantwortungsmodell

| Fähigkeit | Plattform-Orchestrator (zukünftig) | DAAIF |
| --- | --- | --- |
| Tenant-Lifecycle | Tenant anlegen/sperren/löschen, Schlüssel und Quotas zuweisen | Provisioning-API/Events konsumieren, Zustand tenant-gebunden führen |
| Identität | Benutzer authentisieren, Tenant-Mitgliedschaft und Rollen signieren | Token prüfen, Claims in unveränderlichen Request Context übersetzen |
| Routing | optional Tenant auf Region/Instanz/Shard routen | Tenant nie aus Hostname/Body erraten; Context durch alle Use Cases tragen |
| Autorisierung | globale Rollen-/Policy-Vorgaben | objektbezogene Rechte an Quelle, Produkt und Query prüfen |
| Schlüssel/Secrets | tenant-spezifische Secrets ausgeben/rotieren | Secrets nur über Referenzen abrufen; nie in Logs, Cache oder Prompts schreiben |
| Billing/Quota | Pläne und Obergrenzen definieren | Verbrauch messen, Limits vor Ausführung erzwingen, Usage tenant-markieren |
| Offboarding | Löschauftrag und rechtliche Retention auslösen | Cache, Metadaten, Resultate, Jobs und Schlüssel nach Policy löschen/archivieren |

## Zehn Isolationsdimensionen

1. **Identität und Context**  
   Jede externe Anfrage braucht einen signierten Claim `tid` und `sub`. Die API erzeugt daraus einen kurzlebigen internen Context. Tenant-ID aus einem Request-Body oder frei gesetztem Browser-Header ist in Produktion nicht vertrauenswürdig.

2. **Autorisierung**  
   Rollen allein reichen nicht. Zugriffe müssen `subject × action × resource × tenant` prüfen. Ein Analyst darf etwa ein Datenprodukt sehen, aber nicht automatisch dessen Quell-Credentials oder Rohdaten exportieren.

3. **Metadaten**  
   Jede katalogisierte Quelle, Query, Version, Lineage-Kante und Audit-Zeile trägt eine nicht-nullbare Tenant-ID. Die Ziel-Metadatenbank nutzt Row-Level Security und Composite Keys, bei denen `tenant_id` Bestandteil natürlicher/technischer Eindeutigkeit ist.

4. **Daten und Object Storage**  
   Mindestens getrennte Präfixe plus tenant-spezifische IAM-Policies, bei höherer Schutzklasse getrennte Buckets/Accounts. Eine Query Engine erhält kurzlebige Credentials nur für die im Request erlaubten Quellen.

5. **Compute**  
   Jobs tragen Tenant, Klassifizierung, Quota und Deadline. Worker dürfen keine Connection, Temp-Datei oder Extension-Konfiguration zwischen Tenants wiederverwenden. Für starke Isolation ist ein Prozess/Pod pro Job oder Tenant-Pool vorzusehen.

6. **Events und Realtime**  
   Topics sind tenant-partitioniert. Ein Subscriber wird serverseitig aus seinem verifizierten Context gebunden; Clientfilter sind keine Sicherheitsgrenze. Replay, Dead Letter und Event Store müssen dieselbe Partitionierung einhalten.

7. **Offline-Cache**  
   Alle Schlüssel enthalten die Tenant-ID. Ein Tenant-Wechsel zeigt nie Einträge des vorherigen Tenants. Tokens und Secrets werden nicht persistiert. Für klassifizierte Daten braucht die Zielversion zusätzlich WebCrypto-Verschlüsselung, Gerätebindung, TTL und Remote-Wipe-Policy.

8. **AI Gateway**  
   Prompt, Modellfreigabe, Rate Limit und Audit sind tenant-bezogen. DAAIF sendet standardmäßig nur SQL und Schema, keine Datenzeilen. Antworten gelten als unvertrauenswürdig und werden syntaktisch sowie gegen Read-only-/Source-Policies validiert.

9. **Observability**  
   Logs, Traces und Metriken enthalten eine pseudonymisierte Tenant-Referenz und Correlation-ID, aber keine Query-Daten oder Secrets. Zugriff auf Telemetrie ist selbst tenant-/rollenbasiert. High-cardinality Labels werden kontrolliert.

10. **Lifecycle und Support**  
    Backup, Restore, Export, Retention, Legal Hold und Löschung funktionieren pro Tenant. Ein Restore von Tenant A darf keine globalen Tabellen oder Caches von Tenant B zurückrollen.

## Was im aktuellen Stand bereits technisch erzwungen wird

- validiertes `tenant_id`-Format im API- und Backend-Context
- kurzlebig HMAC-signierter Context zwischen API und Backend
- tenant-spezifische Metadatenabfragen
- gehashter, tenant-spezifischer DuckDB-Speicherpfad
- tenant-spezifische Event-Queues
- tenant-spezifische IndexedDB-Schlüssel für API- und Query-Result-Caches
- MCP-Zugriff ausschließlich über die API mit konfiguriertem Tenant-/Bearer-Context
- Tests, die unterschiedliche Quellenpfade für zwei Tenants und keine ESTV-Referenz im BIT-Resultat prüfen

## Was vor Produktion noch integriert werden muss

- OIDC/JWT-Verifikation gegen die reale Orchestrator-/IAM-JWKS mit asymmetrischen Schlüsseln
- Policy Engine (z. B. OPA/Cedar oder bestehender BIT-Standard) für objektbezogene Rechte
- persistenter Katalog auf PostgreSQL mit Row-Level Security und Migrationen
- Credential Broker/Vault und tenant-spezifische kurzlebige Datenquellen-Credentials
- verteilte Query-Worker mit Quota, Cancel, Idempotenz und tenant-isoliertem Temp Storage
- verschlüsselter Offline-Cache samt Klassifizierungs- und TTL-Regeln oder bewusstes Cache-Verbot je Datensatz
- manipulationssicherer Audit Store und tenant-spezifischer Export/Retention
- Penetrationstests für IDOR, Cache Poisoning, Confused Deputy und Cross-Tenant-Side-Channels

## Abnahmekriterien

Mandantenfähigkeit gilt erst als abgenommen, wenn automatisierte Negativtests mindestens Folgendes zeigen:

- Ein gültiges Token für Tenant A kann keine ID, Suche, Export-URL, Event-ID oder Job-ID von Tenant B lesen oder verändern.
- Ein Tenant-Wechsel im Browser zeigt ohne Netz keine gecachten Daten des vorherigen Tenants.
- Ein MCP-Client kann durch Toolparameter keinen anderen Tenant wählen.
- Ein absichtlich manipuliertes internes Context-Token wird vom Backend abgelehnt.
- Query-Temp-Dateien, DuckDB-Verbindungen und Resultate werden nach Jobende freigegeben bzw. tenant-isoliert wiederverwendet.
- Logs, Traces und AI-Prompts enthalten keine Secrets oder ungefilterten Datenzeilen.
- Backup/Restore und Offboarding sind für genau einen Tenant ausführbar und revisionssicher nachweisbar.


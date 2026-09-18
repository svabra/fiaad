# DAAIF MCP Server

Der MCP-Server ist ein eigenständiges, read-only Image auf Basis des MCP Python SDK 2. Er verwendet Streamable HTTP unter `/mcp` und liest fachliche Informationen ausschließlich über die öffentliche DAAIF API.

## Werkzeuge

| Tool | Antwort |
| --- | --- |
| `list_source_types` | erschlossene Quellentypen und Fähigkeiten |
| `list_data_sources` | konkrete Quellen, optional nach Typ gefiltert |
| `list_curated_data_products` | kuratierte/publizierte Produkte, optional nach Status |
| `get_curation_history` | wer wann welches Produkt wie kuratiert hat |
| `answer_catalog_question` | deterministische Auswahl der passenden Fakten für klassische Katalogfragen |

Zusätzlich stehen read-only Ressourcen `daaif://catalog/source-types` und `daaif://catalog/data-products` bereit.

## Lokaler Client-Endpunkt

```text
http://localhost:8002/mcp
```

Der lokale Container läuft stateless mit JSON-Responses und maximal 1 MiB Request-Größe. DNS-Rebinding-Schutz und Host-/Origin-Allowlisten sind aktiv.

## Mandantenmodell

Im lokalen PoC erhält der MCP-Container einen festen `DAAIF_MCP_TENANT_ID`. Das ist eine sichere Deployment-Isolation, solange der Orchestrator genau eine Instanz/Config pro Tenant erzeugt und der Endpunkt nur diesem Tenant zugänglich ist.

Für einen gemeinsam genutzten Produktionsserver wird dieser feste Context ersetzt durch:

1. OAuth-Authentisierung des MCP-Clients;
2. Prüfung der Audience und Tenant-Mitgliedschaft;
3. Token Exchange auf einen kurzlebigen DAAIF-API-Token;
4. keinerlei `tenant_id`-Toolparameter – der Tenant stammt ausschließlich aus dem verifizierten Token;
5. Rate Limits und Audit je `tenant × client_id × tool`.

Diese Integration hängt vom künftigen Plattform-Orchestrator/IAM ab. Die API-Zugriffsgrenze und der `DaaifApiClient` bleiben dabei bestehen.


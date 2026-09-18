# SQL-Optimierung über das interne AI Gateway

## Verhalten

`POST /api/v1/queries/optimize` nimmt `sql` und optional einen begrenzten `schema_context` entgegen. Das Backend prüft zuerst, ob die Query eine einzelne erlaubte Read-only-Anweisung ist. Erst dann wird der Gateway-Adapter aufgerufen.

Erwartete strukturierte Antwort:

```json
{
  "optimized_sql": "SELECT ...",
  "explanation": ["Prädikat pushdown-fähig formuliert."],
  "likely_question": "Die Abfrage beantwortet wahrscheinlich ..."
}
```

DAAIF validiert `optimized_sql` erneut und erzeugt serverseitig:

- einen Unified Diff für Logs/Exports;
- ein strukturiertes Zeilen-Diff für die Angular-Darstellung;
- eine Kennzeichnung, ob AI Gateway oder Regel-Fallback verwendet wurde;
- Warnungen bei Gateway-Ausfall oder ungültiger Antwort.

## Sicherheitsregeln

- Keine Datenzeilen oder Resultsets im Prompt.
- Keine Credentials, Storage-URLs oder Connection Strings.
- Eine Query, ein Statement, Read-only.
- `ATTACH`, `COPY`, DDL, DML, `INSTALL`, `LOAD`, `PRAGMA`, externe URLs und direkte Datei-Lesefunktionen sind gesperrt.
- Tabellen werden gegen die für den Tenant freigegebene Relation-Allowlist geprüft.
- Das AI-Ergebnis wird nie automatisch ausgeführt. Der Benutzer übernimmt es sichtbar und startet separat.
- Original, Vorschlag, Modell/Adapter, Benutzer, Tenant, Zeitpunkt und finale Entscheidung gehören in den produktiven Audit Store.

## Gateway-Vertrag austauschen

Der aktuelle `AiGatewaySqlOptimizer` verwendet einen OpenAI-kompatiblen `/v1/chat/completions`-Vertrag. Der fachliche `SqlOptimizer`-Port kennt dieses Protokoll nicht. Für ein BIT-spezifisches REST-, SDK- oder mTLS-Protokoll wird nur der Infrastrukturadapter ersetzt.


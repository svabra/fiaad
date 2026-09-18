# Kubernetes / OpenShift Übergabe

Die vier Images werden unabhängig gebaut:

```text
ghcr.io/svabra/daaif-frontend:<tag>
ghcr.io/svabra/daaif-api:<tag>
ghcr.io/svabra/daaif-backend:<tag>
ghcr.io/svabra/daaif-mcp-server:<tag>
```

Für die produktive Plattform werden Deployments absichtlich erst nach Klärung der BIT-Vorgaben für Routes/Ingress, OIDC, Service Mesh, NetworkPolicy, Secret Store CSI, StorageClass und Pod Security festgeschrieben. Die Mindesttopologie ist:

- Frontend darf nur API erreichen.
- MCP darf nur API erreichen.
- API darf Backend erreichen.
- Backend darf freigegebene Datenquellen und AI Gateway erreichen.
- Backend erhält ein tenant-/klassifizierungsgeeignetes Volume oder verwendet externe Query Worker.
- Kein anderer Dienst veröffentlicht den internen Backend-Port.

`compose.yaml` ist die ausführbare lokale Referenz dieser Topologie. Die Workflow-Dateien bauen dieselben Dockerfiles und publizieren sie nach GHCR.


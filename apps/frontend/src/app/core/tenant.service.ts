import { Injectable, computed, signal } from '@angular/core';
import { Tenant } from './models';

const TENANTS: readonly Tenant[] = [
  { id: 'estv', label: 'Eidg. Steuerverwaltung', shortLabel: 'ESTV' },
  { id: 'bit-lab', label: 'BIT Innovation Lab', shortLabel: 'BIT' },
];

@Injectable({ providedIn: 'root' })
export class TenantService {
  readonly tenants = TENANTS;
  private readonly selectedId = signal(this.restoreTenant());
  readonly current = computed(
    () => TENANTS.find((tenant) => tenant.id === this.selectedId()) ?? TENANTS[0],
  );

  select(tenantId: string): void {
    if (!TENANTS.some((tenant) => tenant.id === tenantId)) return;
    this.selectedId.set(tenantId);
    localStorage.setItem('daaif.tenant', tenantId);
  }

  headers(): Record<string, string> {
    return {
      'X-Tenant-ID': this.current().id,
      'X-User-ID': 'data.analyst@local',
    };
  }

  private restoreTenant(): string {
    const saved = localStorage.getItem('daaif.tenant');
    return TENANTS.some((tenant) => tenant.id === saved) ? saved! : TENANTS[0].id;
  }
}


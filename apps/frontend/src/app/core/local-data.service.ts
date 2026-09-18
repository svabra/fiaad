import { Injectable } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { QueryExecutionResult, QueryOptimizationResult } from './models';

interface ApiCacheRecord {
  key: string;
  tenantId: string;
  body: unknown;
  status: number;
  statusText: string;
  url: string;
  storedAt: string;
}

interface QueryRecord {
  key: string;
  tenantId: string;
  sql: string;
  result?: QueryExecutionResult;
  optimization?: QueryOptimizationResult;
  storedAt: string;
}

interface DaaifDb extends DBSchema {
  'api-cache': {
    key: string;
    value: ApiCacheRecord;
    indexes: { tenant: string };
  };
  'query-results': {
    key: string;
    value: QueryRecord;
    indexes: { tenant: string };
  };
}

@Injectable({ providedIn: 'root' })
export class LocalDataService {
  private readonly db: Promise<IDBPDatabase<DaaifDb>> = openDB<DaaifDb>('daaif-local-v1', 1, {
    upgrade(database) {
      const apiCache = database.createObjectStore('api-cache', { keyPath: 'key' });
      apiCache.createIndex('tenant', 'tenantId');
      const queryResults = database.createObjectStore('query-results', { keyPath: 'key' });
      queryResults.createIndex('tenant', 'tenantId');
    },
  });

  apiKey(tenantId: string, url: string): string {
    return `${tenantId}::${url}`;
  }

  async putApi(record: ApiCacheRecord): Promise<void> {
    await (await this.db).put('api-cache', record);
  }

  async getApi(tenantId: string, url: string): Promise<ApiCacheRecord | undefined> {
    return (await this.db).get('api-cache', this.apiKey(tenantId, url));
  }

  async putQuery(tenantId: string, sql: string, result: QueryExecutionResult): Promise<void> {
    const database = await this.db;
    const key = `${tenantId}::latest`;
    const existing = await database.get('query-results', key);
    await database.put('query-results', {
      key,
      tenantId,
      sql,
      result,
      optimization: existing?.sql === sql ? existing.optimization : undefined,
      storedAt: new Date().toISOString(),
    });
  }

  async putOptimization(
    tenantId: string,
    sql: string,
    optimization: QueryOptimizationResult,
  ): Promise<void> {
    const database = await this.db;
    const key = `${tenantId}::latest`;
    const existing = await database.get('query-results', key);
    await database.put('query-results', {
      key,
      tenantId,
      sql,
      result: existing?.sql === sql ? existing.result : undefined,
      optimization,
      storedAt: new Date().toISOString(),
    });
  }

  async latestQuery(tenantId: string): Promise<QueryRecord | undefined> {
    return (await this.db).get('query-results', `${tenantId}::latest`);
  }
}

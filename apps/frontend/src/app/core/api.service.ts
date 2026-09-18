import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CurationEvent,
  DataProduct,
  DataSource,
  DataSourceType,
  Overview,
  QueryExecutionResult,
  QueryOptimizationResult,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  overview(): Observable<Overview> {
    return this.http.get<Overview>(`${this.baseUrl}/overview`);
  }

  sourceTypes(): Observable<DataSourceType[]> {
    return this.http.get<DataSourceType[]>(`${this.baseUrl}/sources/types`);
  }

  sources(): Observable<DataSource[]> {
    return this.http.get<DataSource[]>(`${this.baseUrl}/sources`);
  }

  products(): Observable<DataProduct[]> {
    return this.http.get<DataProduct[]>(`${this.baseUrl}/data-products`);
  }

  curationEvents(): Observable<CurationEvent[]> {
    return this.http.get<CurationEvent[]>(`${this.baseUrl}/curation-events`);
  }

  execute(sql: string): Observable<QueryExecutionResult> {
    return this.http.post<QueryExecutionResult>(`${this.baseUrl}/queries/execute`, {
      sql,
      max_rows: 250,
    });
  }

  optimize(sql: string): Observable<QueryOptimizationResult> {
    return this.http.post<QueryOptimizationResult>(`${this.baseUrl}/queries/optimize`, {
      sql,
      schema_context: 'sales(order_id INTEGER, order_date DATE, region VARCHAR, category VARCHAR, amount DECIMAL)',
    });
  }
}


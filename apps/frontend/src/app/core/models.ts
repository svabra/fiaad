export interface Tenant {
  id: string;
  label: string;
  shortLabel: string;
}

export interface Overview {
  source_count: number;
  source_type_count: number;
  product_count: number;
  published_product_count: number;
  latest_curation_at: string | null;
}

export interface DataSourceType {
  kind: string;
  label: string;
  count: number;
  capabilities: string[];
}

export interface DataSource {
  id: string;
  name: string;
  kind: string;
  status: 'available' | 'degraded' | 'offline';
  description: string;
  location: string;
  owner: string;
  discovered_at: string;
  capabilities: string[];
}

export interface DataProduct {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'curated' | 'published';
  source_ids: string[];
  curated_by: string;
  curated_at: string;
  quality_score: number;
  tags: string[];
}

export interface CurationEvent {
  id: string;
  product_id: string;
  product_name: string;
  action: 'created' | 'enriched' | 'validated' | 'published';
  actor: string;
  occurred_at: string;
  summary: string;
}

export interface QueryExecutionResult {
  query_id: string;
  columns: string[];
  rows: unknown[][];
  row_count: number;
  duration_ms: number;
  truncated: boolean;
  executed_at: string;
}

export interface DiffLine {
  kind: 'equal' | 'add' | 'remove';
  old_line: number | null;
  new_line: number | null;
  text: string;
}

export interface QueryOptimizationResult {
  original_sql: string;
  optimized_sql: string;
  explanation: string[];
  likely_question: string;
  unified_diff: string;
  diff: DiffLine[];
  optimizer: 'ai-gateway' | 'rules';
  warnings: string[];
}

export interface RealtimeEvent {
  event_id?: string;
  topic: string;
  tenant_id?: string;
  occurred_at?: string;
  payload: Record<string, unknown>;
}


import { AsyncLocalStorage } from 'async_hooks';

export interface SqlDebugQuery {
  sql: string;
  parameters?: unknown[];
  tables: string[];
}

interface SqlDebugContext {
  queries: SqlDebugQuery[];
}

const storage = new AsyncLocalStorage<SqlDebugContext>();
const MAX_QUERIES_PER_REQUEST = 30;

export function runWithSqlDebugContext<T>(callback: () => T): T {
  return storage.run({ queries: [] }, callback);
}

export function getSqlDebugQueries(): SqlDebugQuery[] {
  return storage.getStore()?.queries ?? [];
}

export function recordSqlDebugQuery(sql: string, parameters?: unknown[]): void {
  const store = storage.getStore();
  if (!store || !isSelectSql(sql)) {
    return;
  }

  store.queries.push({
    sql,
    parameters,
    tables: extractSqlTables(sql),
  });

  if (store.queries.length > MAX_QUERIES_PER_REQUEST) {
    store.queries.splice(0, store.queries.length - MAX_QUERIES_PER_REQUEST);
  }
}

function isSelectSql(sql: string): boolean {
  return sql.trimStart().toUpperCase().startsWith('SELECT');
}

export function extractSqlTables(sql: string): string[] {
  const tables = new Set<string>();
  const tablePattern = /\b(?:FROM|JOIN)\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_$#]*))/gi;
  let match: RegExpExecArray | null;

  while ((match = tablePattern.exec(sql)) !== null) {
    const table = match[1] ?? match[2];
    if (table) {
      tables.add(table.toUpperCase());
    }
  }

  return [...tables];
}

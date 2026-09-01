/**
 * @file src/modules/ai/schema-info.service.ts
 * @description text-to-SQL용 스키마 정보 제공 (Oracle USER_TABLES/USER_TAB_COLUMNS)
 *
 * 1단계(테이블 선택): getTableSummaries() — 전체 테이블명 + 코멘트
 * 2단계(SQL 생성): getTableSchemas(tables) — 선택 테이블 컬럼 스키마
 * 인증/권한 등 민감 테이블은 노출하지 않는다.
 */
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** AI에 노출하지 않는 민감 테이블 (인증/권한/계정) */
const EXCLUDED_TABLES = new Set([
  'USERS',
  'USER_AUTHS',
  'ROLES',
  'ROLE_MENU_PERMISSIONS',
  'PDA_ROLES',
  'PDA_ROLE_MENU',
  'PDA_ROLE_MENUS',
]);

/** AI 카탈로그에 노출하지 않는 테이블 판별 (인증/권한·백업·메타) */
export function isExcludedTable(table: string): boolean {
  const upper = table.toUpperCase();
  if (EXCLUDED_TABLES.has(upper)) return true;
  if (upper.startsWith('BIN$')) return true; // Oracle 휴지통(recyclebin)
  if (upper.startsWith('FLYWAY') || upper.startsWith('TYPEORM')) return true;
  if (upper === 'MIGRATIONS') return true; // TypeORM 마이그레이션 메타
  if (/_(BAK|BACKUP|OLD|TMP|TEMP)(_?\d+)?$/.test(upper)) return true; // 백업/임시(날짜 접미 포함)
  return false;
}

export interface TableSummary {
  table: string;
  comment: string;
}

export interface ColumnSchema {
  table: string;
  column: string;
  type: string;
  nullable: string;
  comment: string;
}

@Injectable()
export class SchemaInfoService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** 테이블 선택 카탈로그 캐시 (스키마는 거의 불변 → DB 반복 조회 제거) */
  private catalogCache: { catalog: string; tables: string[]; at: number } | null = null;
  private static readonly CATALOG_TTL_MS = 10 * 60 * 1000; // 10분

  private isExcluded(table: string): boolean {
    return isExcludedTable(table);
  }

  /**
   * 1단계 테이블 선택용 카탈로그: 테이블명 + 코멘트만.
   * 컬럼 목록은 넣지 않는다(전체 ~68KB → 수 KB로 축소, LLM 토큰/지연 급감).
   * 컬럼 상세는 2단계 getSchemaText(선택 테이블)에서만 제공한다.
   * 코멘트 없는 테이블은 테이블명만 노출되므로, 식별 정확도를 위해 테이블 코멘트를 보강한다.
   */
  async getSelectionCatalog(): Promise<{ catalog: string; tables: string[] }> {
    const now = Date.now();
    if (this.catalogCache && now - this.catalogCache.at < SchemaInfoService.CATALOG_TTL_MS) {
      return { catalog: this.catalogCache.catalog, tables: this.catalogCache.tables };
    }
    const rows = await this.dataSource.query<{ table: string; tcmt: string }[]>(
      `SELECT TABLE_NAME AS "table", NVL(COMMENTS,'') AS "tcmt"
       FROM USER_TAB_COMMENTS
       WHERE TABLE_TYPE = 'TABLE'
       ORDER BY TABLE_NAME`,
    );
    const tables: string[] = [];
    const blocks: string[] = [];
    for (const r of rows) {
      if (this.isExcluded(r.table)) continue;
      tables.push(r.table);
      blocks.push(r.tcmt ? `${r.table}: ${r.tcmt}` : r.table);
    }
    const catalog = blocks.join('\n');
    this.catalogCache = { catalog, tables, at: now };
    return { catalog, tables };
  }

  /** 1단계: 전체 테이블 요약 (테이블명 + 코멘트) */
  async getTableSummaries(): Promise<TableSummary[]> {
    const rows = await this.dataSource.query<TableSummary[]>(
      `SELECT t.TABLE_NAME AS "table", NVL(c.COMMENTS, '') AS "comment"
       FROM USER_TABLES t
       LEFT JOIN USER_TAB_COMMENTS c ON c.TABLE_NAME = t.TABLE_NAME
       ORDER BY t.TABLE_NAME`,
    );
    return rows.filter((r) => !this.isExcluded(r.table));
  }


  /** 2단계: 선택 테이블의 컬럼 스키마 */
  async getTableSchemas(tables: string[]): Promise<ColumnSchema[]> {
    const safe = [...new Set(tables.map((t) => t.toUpperCase()))].filter((t) => !this.isExcluded(t));
    if (safe.length === 0) return [];

    const placeholders = safe.map((_, i) => `:${i + 1}`).join(',');
    return this.dataSource.query<ColumnSchema[]>(
      `SELECT
         c.TABLE_NAME   AS "table",
         c.COLUMN_NAME  AS "column",
         c.DATA_TYPE    AS "type",
         c.NULLABLE     AS "nullable",
         NVL(cc.COMMENTS, '') AS "comment"
       FROM USER_TAB_COLUMNS c
       LEFT JOIN USER_COL_COMMENTS cc
         ON cc.TABLE_NAME = c.TABLE_NAME AND cc.COLUMN_NAME = c.COLUMN_NAME
       WHERE c.TABLE_NAME IN (${placeholders})
       ORDER BY c.TABLE_NAME, c.COLUMN_ID`,
      safe,
    );
  }

  /** 선택 테이블 스키마를 LLM 프롬프트용 텍스트로 직렬화 */
  async getSchemaText(tables: string[]): Promise<string> {
    const cols = await this.getTableSchemas(tables);
    if (cols.length === 0) return '(스키마 없음)';
    const byTable = new Map<string, ColumnSchema[]>();
    for (const c of cols) {
      if (!byTable.has(c.table)) byTable.set(c.table, []);
      byTable.get(c.table)!.push(c);
    }
    const blocks: string[] = [];
    for (const [table, list] of byTable) {
      const colLines = list
        .map((c) => `  ${c.column} ${c.type}${c.nullable === 'N' ? ' NOT NULL' : ''}${c.comment ? ` -- ${c.comment}` : ''}`)
        .join('\n');
      blocks.push(`TABLE ${table}:\n${colLines}`);
    }
    return blocks.join('\n\n');
  }
}

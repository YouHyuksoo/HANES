/**
 * @file src/modules/ai/ai-catalog.service.ts
 * @description AI 질의(text-to-SQL)에 주입할 "테이블 카탈로그" 지식 파일 관리.
 *
 * 소스 오브 트루스 = md 파일(git 커밋, 사람이 편집). DB가 아니라 큐레이션된 참조 지식.
 * - 1단계(테이블 선택): 테이블명 + 설명 + 동의어만 주입 → 간결
 * - 2단계(SQL 생성): 선택 테이블의 컬럼 관계(JOIN 키) 주입 → 정확한 JOIN
 * - "DB와 동기화": 실제 테이블 목록과 비교해 누락 테이블만 추가(사람이 쓴 설명·관계 보존)
 * 파일이 없으면 호출측에서 DB 폴백.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { isExcludedTable } from './schema-info.service';

export interface CatalogRelation {
  /** 이 테이블의 컬럼 */
  column: string;
  /** 연결 대상. 보통 "TABLE.COLUMN", 자유 텍스트 메모도 허용 */
  target: string;
}

export interface CatalogTable {
  name: string;
  description: string;
  synonyms: string[];
  relations: CatalogRelation[];
}

export interface CatalogSyncResult {
  added: string[];
  /** md에는 있으나 DB에 없는(삭제 의심) 테이블 — 자동 삭제하지 않고 경고만 */
  missingInDb: string[];
  total: number;
}

@Injectable()
export class AiCatalogService {
  private readonly logger = new Logger(AiCatalogService.name);
  private cache: { tables: CatalogTable[]; at: number } | null = null;
  private static readonly TTL_MS = 10 * 60 * 1000; // 10분

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** md 파일 경로. 기본은 프로젝트 루트의 docs/database/table-catalog.md (docs 표준으로 관리).
   *  env AI_CATALOG_PATH로 override 가능. 상대경로는 프로젝트 루트(backend cwd의 ../..) 기준. */
  private filePath(): string {
    const root = path.resolve(process.cwd(), '..', '..');
    const p = process.env.AI_CATALOG_PATH || 'docs/database/table-catalog.md';
    return path.isAbsolute(p) ? p : path.resolve(root, p);
  }

  invalidate(): void {
    this.cache = null;
  }

  /** 원본 md 텍스트 (없으면 빈 문자열) */
  async readRaw(): Promise<string> {
    try {
      return await fs.readFile(this.filePath(), 'utf8');
    } catch {
      return '';
    }
  }


  /** md 저장 + 캐시 무효화 */
  async saveRaw(raw: string): Promise<void> {
    const fp = this.filePath();
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, raw, 'utf8');
    this.invalidate();
  }

  /** 파싱된 카탈로그 (10분 캐시) */
  async getTables(): Promise<CatalogTable[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < AiCatalogService.TTL_MS) return this.cache.tables;
    const tables = this.parse(await this.readRaw());
    this.cache = { tables, at: now };
    return tables;
  }

  /**
   * 1단계 테이블 선택용 카탈로그.
   * md에 테이블이 하나도 없으면 null → 호출측 DB 폴백.
   */
  async getSelectionCatalog(): Promise<{ catalog: string; tables: string[] } | null> {
    const tables = (await this.getTables()).filter((t) => !isExcludedTable(t.name));
    if (tables.length === 0) return null;
    const blocks = tables.map((t) => {
      const head = t.description ? `${t.name}: ${t.description}` : t.name;
      return t.synonyms.length ? `${head} (동의어: ${t.synonyms.join(', ')})` : head;
    });
    return { catalog: blocks.join('\n'), tables: tables.map((t) => t.name) };
  }

  /** 2단계 SQL 생성용: 선택 테이블의 컬럼 관계(JOIN 키) 텍스트 */
  async getRelationsText(selected: string[]): Promise<string> {
    const want = new Set(selected.map((s) => s.toUpperCase()));
    const tables = (await this.getTables()).filter(
      (t) => want.has(t.name.toUpperCase()) && t.relations.length > 0,
    );
    if (tables.length === 0) return '';
    const lines = tables.map((t) => {
      const rels = t.relations.map((r) => `${t.name}.${r.column} = ${r.target}`).join('; ');
      return `- ${rels}`;
    });
    return `## 테이블 관계(JOIN 키)\n${lines.join('\n')}`;
  }

  /** DB 실제 테이블과 동기화: 누락 테이블만 추가(기존 큐레이션 보존) */
  async syncFromDb(): Promise<CatalogSyncResult> {
    const rows = await this.dataSource.query<{ table: string; tcmt: string }[]>(
      `SELECT TABLE_NAME AS "table", NVL(COMMENTS,'') AS "tcmt"
       FROM USER_TAB_COMMENTS
       WHERE TABLE_TYPE = 'TABLE'
       ORDER BY TABLE_NAME`,
    );
    const dbTables = rows.filter((r) => !isExcludedTable(r.table));
    const dbNames = new Set(dbTables.map((r) => r.table.toUpperCase()));

    const existing = this.parse(await this.readRaw());
    const byName = new Map(existing.map((t) => [t.name.toUpperCase(), t]));

    const added: string[] = [];
    for (const r of dbTables) {
      if (byName.has(r.table.toUpperCase())) continue;
      const t: CatalogTable = { name: r.table, description: r.tcmt, synonyms: [], relations: [] };
      existing.push(t);
      byName.set(r.table.toUpperCase(), t);
      added.push(r.table);
    }
    const missingInDb = existing.filter((t) => !dbNames.has(t.name.toUpperCase())).map((t) => t.name);

    existing.sort((a, b) => a.name.localeCompare(b.name));
    await this.saveRaw(this.serialize(existing));
    return { added, missingInDb, total: existing.length };
  }

  // ---- 파싱/직렬화 ---------------------------------------------------------

  /** md → CatalogTable[] (관대한 파서) */
  parse(md: string): CatalogTable[] {
    const tables: CatalogTable[] = [];
    let cur: CatalogTable | null = null;
    let inRelations = false;
    for (const rawLine of md.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      const header = /^##\s+(.+)$/.exec(line);
      if (header) {
        if (cur) tables.push(cur);
        const text = header[1].trim();
        const sep = text.search(/\s[—-]\s/);
        const name = (sep === -1 ? text : text.slice(0, sep)).trim().toUpperCase();
        const desc = sep === -1 ? '' : text.slice(sep).replace(/^\s[—-]\s/, '').trim();
        cur = { name, description: desc, synonyms: [], relations: [] };
        inRelations = false;
        continue;
      }
      if (!cur) continue;
      const descM = /^설명\s*[:：]\s*(.*)$/.exec(line);
      if (descM) { cur.description = descM[1].trim(); inRelations = false; continue; }
      const synM = /^동의어\s*[:：]\s*(.*)$/.exec(line);
      if (synM) {
        cur.synonyms = synM[1].split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        inRelations = false;
        continue;
      }
      if (/^관계\s*[:：]?\s*$/.test(line)) { inRelations = true; continue; }
      const relM = /^[-*]\s*(.+?)\s*->\s*(.+)$/.exec(line);
      if (relM && inRelations) {
        cur.relations.push({ column: relM[1].trim(), target: relM[2].trim() });
        continue;
      }
      if (line.trim() === '') inRelations = false;
    }
    if (cur) tables.push(cur);
    return tables;
  }

  /** CatalogTable[] → md (정규 형식) */
  serialize(tables: CatalogTable[]): string {
    const head = [
      '# HANES MES — AI 테이블 카탈로그',
      '',
      '<!-- AI 질의(text-to-SQL) 시 주입되는 테이블 지식. 사람이 직접 편집할 수 있습니다. -->',
      '<!-- 형식: "## 테이블명 — 설명" / "동의어: a, b" / "관계:" 아래 "- 컬럼 -> 대상테이블.컬럼" -->',
      '<!-- "DB와 동기화" 시 누락 테이블이 자동 추가되며, 작성한 설명·관계는 보존됩니다. -->',
      '',
    ].join('\n');
    const body = tables
      .map((t) => {
        const lines = [`## ${t.name}${t.description ? ` — ${t.description}` : ''}`];
        if (t.synonyms.length) lines.push(`동의어: ${t.synonyms.join(', ')}`);
        if (t.relations.length) {
          lines.push('관계:');
          for (const r of t.relations) lines.push(`- ${r.column} -> ${r.target}`);
        }
        return lines.join('\n');
      })
      .join('\n\n');
    return `${head}\n${body}\n`;
  }
}

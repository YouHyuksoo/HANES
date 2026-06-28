/**
 * @file src/modules/system/services/er-view.service.ts
 * @description 실시간 Oracle 스키마 ER VIEW/관계 분석/DDL 실행 서비스
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { execFileSync } from 'child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';

type ConstraintType = 'P' | 'U';
type RelationshipType = 'PHYSICAL_FK' | 'INFERRED';
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
type ActionType = 'ADD_FK' | 'ADD_UK' | 'DROP_FK' | 'DELETE_ORPHANS' | 'UPDATE_ORPHAN_KEY';

export interface TableMeta {
  tableName: string;
  tableComment: string;
  numRows: number | null;
}

export interface ColumnMeta {
  tableName: string;
  columnName: string;
  columnId: number;
  dataType: string;
  nullable: 'Y' | 'N';
  dataLength?: number | null;
  dataPrecision?: number | null;
  dataScale?: number | null;
  dataDefault?: string | null;
  comments?: string | null;
}

export interface KeyMeta {
  tableName: string;
  constraintName: string;
  constraintType: ConstraintType;
  columns: string[];
}

export interface ForeignKeyMeta {
  constraintName: string;
  childTable: string;
  childColumns: string[];
  parentTable: string;
  parentColumns: string[];
  deleteRule?: string;
}

export interface SchemaSnapshot {
  tables: TableMeta[];
  columns: ColumnMeta[];
  keys: KeyMeta[];
  foreignKeys: ForeignKeyMeta[];
}

export interface ErRelationship {
  id?: string;
  relationshipType: RelationshipType;
  constraintName?: string;
  childTable: string;
  childColumns: string[];
  parentTable: string;
  parentColumns: string[];
  parentKeyReady: boolean;
  tenantIncluded: boolean;
  confidence: Confidence;
  orphanCount?: number;
  risk?: RiskScore;
}

export interface RiskScore {
  score: number;
  level: RiskLevel;
  executable: boolean;
  recommendation: string;
  reasons: Array<{ code: string; label: string; score: number }>;
}

export interface OrphanScanResult {
  relationshipId: string;
  orphanCount: number;
  sampleLimit: number;
  samples: Record<string, unknown>[];
  sql: string;
}

export interface ActionPayload {
  actionType: ActionType;
  constraintName?: string;
  childTable?: string;
  childColumns?: string[];
  parentTable?: string;
  parentColumns?: string[];
  tableName?: string;
  columns?: string[];
  fromKey?: Record<string, string | number | null>;
  toKey?: Record<string, string | number | null>;
  confirmationPhrase?: string;
}

export interface ActionPreview {
  actionType: ActionType;
  sql: string;
  confirmationPhrase: string;
  expectedAffectedRows: number;
  riskLevel: RiskLevel;
  rawSqlAccepted: false;
}

export interface GraphTableColumn {
  columnName: string;
  dataType: string;
  nullable: 'Y' | 'N';
  comments?: string | null;
  isPk: boolean;
  isFkCandidate: boolean;
}

export interface GraphTableNode {
  id: string;
  label: string;
  comment: string;
  pkColumns: string[];
  columns: GraphTableColumn[];
}

const IDENTIFIER = /^[A-Z][A-Z0-9_]{0,127}$/;
const CONSTRAINT_IDENTIFIER = /^[A-Z][A-Z0-9_]{0,29}$/;
const TENANT_COLUMNS = ['COMPANY', 'PLANT_CD'];
const LOG_DIR_DISPLAY = 'logs/schema-governance';
const SIMPLE_CONFIRMATION_PHRASE = '실행';

const SEMANTIC_PARENT: Record<string, string> = {
  ITEM_CODE: 'ITEM_MASTERS',
  PARENT_ITEM_CODE: 'ITEM_MASTERS',
  CHILD_ITEM_CODE: 'ITEM_MASTERS',
  PROCESS_CODE: 'PROCESS_MASTERS',
  PROCESS_CD: 'PROCESS_MASTERS',
  EQUIP_CODE: 'EQUIP_MASTERS',
  WORKER_CODE: 'WORKER_MASTERS',
  VENDOR_CODE: 'VENDOR_MASTERS',
  PARTNER_CODE: 'PARTNER_MASTERS',
  WAREHOUSE_CODE: 'WAREHOUSES',
  LOCATION_CODE: 'WAREHOUSE_LOCATIONS',
  GAUGE_CODE: 'GAUGE_MASTERS',
  MOLD_CODE: 'MOLD_MASTERS',
  CONSUMABLE_CODE: 'CONSUMABLE_MASTERS',
  PO_NO: 'PURCHASE_ORDERS',
  PO_ID: 'PURCHASE_ORDERS',
  PO_ITEM_ID: 'PURCHASE_ORDER_ITEMS',
  DEFECT_ID: 'DEFECT_LOGS',
  DEFECT_LOG_ID: 'DEFECT_LOGS',
  CALENDAR_ID: 'WORK_CALENDARS',
};

@Injectable()
export class ErViewService {
  private snapshotCache: { at: number; snapshot: SchemaSnapshot } | null = null;
  private readonly cacheTtlMs = 10 * 60 * 1000;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getSummary() {
    const snapshot = await this.loadSnapshot();
    const physicalFkCount = snapshot.foreignKeys.length;
    const inferredCount = this.inferRelationshipsForSnapshot(snapshot).length;
    const pkTables = new Set(snapshot.keys.filter((k) => k.constraintType === 'P').map((k) => k.tableName));

    return {
      mode: this.mode,
      tableCount: snapshot.tables.length,
      columnCount: snapshot.columns.length,
      pkTableCount: pkTables.size,
      physicalFkCount,
      inferredRelationshipCount: inferredCount,
    };
  }

  async getTables() {
    const snapshot = await this.loadSnapshot();
    const pkTables = new Set(snapshot.keys.filter((k) => k.constraintType === 'P').map((k) => k.tableName));
    const columnsByTable = this.groupColumns(snapshot.columns);
    return snapshot.tables.map((table) => ({
      ...table,
      module: this.moduleFor(table.tableName),
      hasPk: pkTables.has(table.tableName),
      columnCount: columnsByTable.get(table.tableName)?.length ?? 0,
    }));
  }

  async getTableDetail(tableName: string) {
    const table = this.normalizeIdentifier(tableName);
    const snapshot = await this.loadSnapshot();
    return {
      table,
      columns: snapshot.columns.filter((c) => c.tableName === table),
      keys: snapshot.keys.filter((k) => k.tableName === table),
      foreignKeys: snapshot.foreignKeys.filter((fk) => fk.childTable === table || fk.parentTable === table),
      relationships: await this.getRelationships(table),
    };
  }

  async getRelationships(tableName?: string) {
    const table = tableName ? this.normalizeIdentifier(tableName) : undefined;
    const snapshot = await this.loadSnapshot();
    const physical = snapshot.foreignKeys.map((fk): ErRelationship => ({
      id: this.relationshipId('PHYSICAL_FK', fk.childTable, fk.parentTable, fk.childColumns),
      relationshipType: 'PHYSICAL_FK',
      constraintName: fk.constraintName,
      childTable: fk.childTable,
      childColumns: fk.childColumns,
      parentTable: fk.parentTable,
      parentColumns: fk.parentColumns,
      parentKeyReady: true,
      tenantIncluded: this.hasTenantColumns(fk.childColumns) && this.hasTenantColumns(fk.parentColumns),
      confidence: 'HIGH',
      risk: this.scoreRelationshipRisk({
        relationshipType: 'PHYSICAL_FK',
        constraintName: fk.constraintName,
        childTable: fk.childTable,
        childColumns: fk.childColumns,
        parentTable: fk.parentTable,
        parentColumns: fk.parentColumns,
        parentKeyReady: true,
        tenantIncluded: this.hasTenantColumns(fk.childColumns) && this.hasTenantColumns(fk.parentColumns),
        confidence: 'HIGH',
      }),
    }));
    const inferred = this.inferRelationshipsForSnapshot(snapshot).map((rel) => ({
      ...rel,
      id: this.relationshipId(rel.relationshipType, rel.childTable, rel.parentTable, rel.childColumns),
      risk: this.scoreRelationshipRisk(rel),
    }));
    return [...physical, ...inferred].filter((rel) => !table || rel.childTable === table || rel.parentTable === table);
  }

  async getGraph(tableName: string, depth = 1) {
    const table = this.normalizeIdentifier(tableName);
    const relationships = await this.getRelationships(table);
    const nodeNames = new Set<string>([table]);
    for (const rel of relationships) {
      nodeNames.add(rel.childTable);
      nodeNames.add(rel.parentTable);
    }
    if (depth > 1) {
      const more = (await this.getRelationships()).filter((rel) => nodeNames.has(rel.childTable) || nodeNames.has(rel.parentTable));
      for (const rel of more) {
        nodeNames.add(rel.childTable);
        nodeNames.add(rel.parentTable);
      }
      relationships.push(...more.filter((rel) => !relationships.some((r) => r.id === rel.id)));
    }
    const snapshot = await this.loadSnapshot();
    const tableMap = new Map(snapshot.tables.map((t) => [t.tableName, t]));
    const columnsByTable = this.groupColumns(snapshot.columns);
    const pkColumnsByTable = this.primaryKeyColumnsByTable(snapshot.keys);
    const fkCandidateColumnsByTable = this.fkCandidateColumnsByTable(relationships);
    return {
      nodes: [...nodeNames].map((name): GraphTableNode => {
        const pkColumns = pkColumnsByTable.get(name) ?? [];
        const fkCandidateColumns = fkCandidateColumnsByTable.get(name) ?? new Set<string>();
        return {
          id: name,
          label: name,
          comment: tableMap.get(name)?.tableComment ?? '',
          pkColumns,
          columns: (columnsByTable.get(name) ?? []).map((column) => ({
            columnName: column.columnName,
            dataType: this.formatColumnType(column),
            nullable: column.nullable,
            comments: column.comments,
            isPk: pkColumns.includes(column.columnName),
            isFkCandidate: fkCandidateColumns.has(column.columnName),
          })),
        };
      }),
      edges: relationships.map((rel) => ({
        id: rel.id,
        source: rel.childTable,
        target: rel.parentTable,
        label: rel.childColumns.join(', '),
        constraintName: rel.constraintName,
        relationshipType: rel.relationshipType,
        riskLevel: rel.risk?.level ?? 'MEDIUM',
      })),
      relationships,
    };
  }

  inferRelationshipsForSnapshot(snapshot: SchemaSnapshot): ErRelationship[] {
    const tableSet = new Set(snapshot.tables.map((t) => t.tableName));
    const columnsByTable = this.groupColumns(snapshot.columns);
    const physicalKeys = new Set(snapshot.foreignKeys.map((fk) => `${fk.childTable}:${fk.parentTable}:${fk.childColumns.join(',')}`));
    const result: ErRelationship[] = [];

    for (const column of snapshot.columns) {
      if (TENANT_COLUMNS.includes(column.columnName) || column.columnName === 'CREATED_BY' || column.columnName === 'UPDATED_BY') {
        continue;
      }
      const parentTable = this.resolveParentTable(column.columnName, tableSet, column.tableName);
      if (!parentTable || parentTable === column.tableName) {
        continue;
      }

      const childColumns = this.preferTenantColumns(column.tableName, parentTable, column.columnName, columnsByTable);
      if (!childColumns) {
        continue;
      }
      const parentColumn = this.resolveParentColumn(column.columnName, parentTable, columnsByTable);
      if (!parentColumn) {
        continue;
      }
      const parentColumns = this.preferTenantColumns(parentTable, column.tableName, parentColumn, columnsByTable);
      if (!parentColumns) {
        continue;
      }
      const physicalKey = `${column.tableName}:${parentTable}:${childColumns.join(',')}`;
      if (physicalKeys.has(physicalKey)) {
        continue;
      }

      const parentKeyReady = this.hasMatchingKey(snapshot.keys, parentTable, parentColumns);
      const tenantIncluded = this.hasTenantColumns(childColumns) && this.hasTenantColumns(parentColumns);
      const isSemanticMatch = SEMANTIC_PARENT[column.columnName] === parentTable
        || (column.tableName === 'ACTIVITY_LOGS' && column.columnName === 'EMAIL' && parentTable === 'USERS');
      const confidence: Confidence = isSemanticMatch && parentKeyReady ? 'HIGH' : 'MEDIUM';
      result.push({
        relationshipType: 'INFERRED',
        childTable: column.tableName,
        childColumns,
        parentTable,
        parentColumns,
        parentKeyReady,
        tenantIncluded,
        confidence,
      });
    }

    return result;
  }

  scoreRelationshipRisk(rel: Omit<ErRelationship, 'risk' | 'id'>): RiskScore {
    const reasons: RiskScore['reasons'] = [];
    let score = 0;

    if (rel.relationshipType === 'PHYSICAL_FK') {
      reasons.push({ code: 'PHYSICAL_FK_EXISTS', label: '이미 FK 존재: 신규 생성 불필요', score: 0 });
      return { score: 0, level: 'LOW', executable: false, recommendation: '신규 생성 불필요', reasons };
    }
    if ((rel.orphanCount ?? 0) > 0) {
      score += 50;
      reasons.push({ code: 'ORPHAN_EXISTS', label: `orphan ${rel.orphanCount}건`, score: 50 });
    }
    if (!rel.parentKeyReady) {
      score += 40;
      reasons.push({ code: 'PARENT_KEY_MISSING', label: '부모 PK/UK 없음', score: 40 });
    }
    if (!rel.tenantIncluded) {
      score += 25;
      reasons.push({ code: 'TENANT_KEY_MISSING', label: '테넌트 컬럼 미포함', score: 25 });
    }
    if (this.isLogLike(rel.childTable)) {
      score += 20;
      reasons.push({ code: 'LOG_TABLE', label: '로그/이력 계열 테이블', score: 20 });
    }
    if (rel.confidence === 'LOW') {
      score += 20;
      reasons.push({ code: 'LOW_CONFIDENCE', label: '추정 신뢰도 낮음', score: 20 });
    }
    if (rel.confidence === 'HIGH' && rel.parentKeyReady && rel.tenantIncluded && !rel.orphanCount) {
      score = Math.max(0, score - 40);
      reasons.push({ code: 'HIGH_CONFIDENCE_READY', label: '부모키/테넌트/orphan 조건 양호', score: -40 });
    }

    const level: RiskLevel = !rel.parentKeyReady || (rel.orphanCount ?? 0) > 0
      ? 'BLOCKED'
      : score >= 70
        ? 'HIGH'
        : score >= 25
          ? 'MEDIUM'
          : 'LOW';
    return {
      score,
      level,
      executable: level === 'LOW' || level === 'MEDIUM',
      recommendation: level === 'BLOCKED' ? '데이터 정리 또는 UK 생성 필요' : 'ENABLE VALIDATE 적용 가능',
      reasons,
    };
  }

  async scanOrphans(input: ErRelationship | { childTable: string; childColumns: string[]; parentTable: string; parentColumns: string[] }, sampleLimit = 20): Promise<OrphanScanResult> {
    const childTable = this.normalizeIdentifier(input.childTable);
    const parentTable = this.normalizeIdentifier(input.parentTable);
    const childColumns = input.childColumns.map((c) => this.normalizeIdentifier(c));
    const parentColumns = input.parentColumns.map((c) => this.normalizeIdentifier(c));
    this.assertSameLength(childColumns, parentColumns);
    const snapshot = await this.loadSnapshot(true);
    this.assertTableColumnsExist(snapshot, childTable, childColumns);
    this.assertTableColumnsExist(snapshot, parentTable, parentColumns);
    const join = childColumns.map((col, idx) => `p.${parentColumns[idx]} = c.${col}`).join(' AND ');
    const childNotNull = childColumns.map((col) => `c.${col} IS NOT NULL`).join(' AND ');
    const parentNull = `p.${parentColumns[0]} IS NULL`;
    const where = `${childNotNull} AND ${parentNull}`;
    const countSql = `SELECT COUNT(*) AS "orphanCount" FROM ${childTable} c LEFT JOIN ${parentTable} p ON ${join} WHERE ${where}`;
    const sampleSql = `SELECT c.ROWID AS "rowid", c.* FROM ${childTable} c LEFT JOIN ${parentTable} p ON ${join} WHERE ${where} AND ROWNUM <= :1`;
    const [countRows, samples] = await Promise.all([
      this.dataSource.query<{ orphanCount: number }[]>(countSql),
      this.dataSource.query<Record<string, unknown>[]>(sampleSql, [Math.min(sampleLimit, 100)]),
    ]);
    return {
      relationshipId: this.relationshipId('INFERRED', childTable, parentTable, childColumns),
      orphanCount: Number(countRows[0]?.orphanCount ?? 0),
      sampleLimit: Math.min(sampleLimit, 100),
      samples,
      sql: countSql,
    };
  }

  async previewAction(payload: ActionPayload): Promise<ActionPreview> {
    this.validateActionPayload(payload);
    if (payload.actionType === 'ADD_FK') {
      const rel = this.payloadToRelationship(payload);
      const snapshot = await this.loadSnapshot(true);
      this.assertTableColumnsExist(snapshot, rel.childTable, rel.childColumns);
      this.assertTableColumnsExist(snapshot, rel.parentTable, rel.parentColumns);
      const existingFk = this.findExistingForeignKey(snapshot.foreignKeys, rel);
      if (existingFk) {
        throw new BadRequestException(`동일한 FK가 이미 존재합니다: ${existingFk.constraintName}`);
      }
      const parentKeyReady = this.hasMatchingKey(snapshot.keys, rel.parentTable, rel.parentColumns);
      if (!parentKeyReady) {
        throw new BadRequestException('부모 PK/UK가 없어 FK를 생성할 수 없습니다');
      }
      const scan = await this.scanOrphans(rel);
      if (scan.orphanCount > 0) {
        throw new BadRequestException(`orphan ${scan.orphanCount}건이 있어 VALIDATE FK를 생성할 수 없습니다`);
      }
      return {
        actionType: 'ADD_FK',
        sql: this.buildAddFkSql(payload.constraintName!, rel),
        confirmationPhrase: SIMPLE_CONFIRMATION_PHRASE,
        expectedAffectedRows: 0,
        riskLevel: 'LOW',
        rawSqlAccepted: false,
      };
    }
    if (payload.actionType === 'ADD_UK') {
      const table = this.normalizeIdentifier(payload.tableName!);
      const columns = payload.columns!.map((c) => this.normalizeIdentifier(c));
      const snapshot = await this.loadSnapshot(true);
      this.assertTableColumnsExist(snapshot, table, columns);
      const existingConstraint = this.findConstraintByName(snapshot, payload.constraintName!);
      if (existingConstraint) {
        throw new BadRequestException(`동일한 이름의 constraint가 이미 존재합니다: ${payload.constraintName}`);
      }
      const existingKey = this.findExistingKey(snapshot.keys, table, columns);
      if (existingKey) {
        throw new BadRequestException(`동일한 PK/UK가 이미 존재합니다: ${existingKey.constraintName}`);
      }
      const duplicateSql = `SELECT COUNT(*) AS "duplicateCount" FROM (SELECT ${columns.join(', ')} FROM ${table} GROUP BY ${columns.join(', ')} HAVING COUNT(*) > 1)`;
      const nullSql = `SELECT COUNT(*) AS "nullCount" FROM ${table} WHERE ${columns.map((c) => `${c} IS NULL`).join(' OR ')}`;
      const [duplicateRows, nullRows] = await Promise.all([
        this.dataSource.query<{ duplicateCount: number }[]>(duplicateSql),
        this.dataSource.query<{ nullCount: number }[]>(nullSql),
      ]);
      if (Number(duplicateRows[0]?.duplicateCount ?? 0) > 0 || Number(nullRows[0]?.nullCount ?? 0) > 0) {
        throw new BadRequestException('중복 또는 NULL 데이터가 있어 VALIDATE UK를 생성할 수 없습니다');
      }
      return {
        actionType: 'ADD_UK',
        sql: `ALTER TABLE ${table} ADD CONSTRAINT ${payload.constraintName} UNIQUE (${columns.join(', ')}) ENABLE VALIDATE`,
        confirmationPhrase: SIMPLE_CONFIRMATION_PHRASE,
        expectedAffectedRows: 0,
        riskLevel: 'LOW',
        rawSqlAccepted: false,
      };
    }
    if (payload.actionType === 'DROP_FK') {
      const childTable = this.normalizeIdentifier(payload.childTable!);
      const constraintName = this.normalizeConstraintName(payload.constraintName!);
      const snapshot = await this.loadSnapshot(true);
      const fk = snapshot.foreignKeys.find((item) => item.constraintName === constraintName);
      if (!fk) {
        throw new BadRequestException(`존재하지 않는 FK입니다: ${constraintName}`);
      }
      if (fk.childTable !== childTable) {
        throw new BadRequestException(`FK 소유 테이블이 일치하지 않습니다: ${fk.childTable}`);
      }
      return {
        actionType: 'DROP_FK',
        sql: this.buildDropFkSql(fk),
        confirmationPhrase: SIMPLE_CONFIRMATION_PHRASE,
        expectedAffectedRows: 0,
        riskLevel: 'HIGH',
        rawSqlAccepted: false,
      };
    }
    if (payload.actionType === 'DELETE_ORPHANS') {
      const rel = this.payloadToRelationship(payload);
      const scan = await this.scanOrphans(rel);
      return {
        actionType: 'DELETE_ORPHANS',
        sql: this.buildDeleteOrphansSql(rel),
        confirmationPhrase: SIMPLE_CONFIRMATION_PHRASE,
        expectedAffectedRows: scan.orphanCount,
        riskLevel: this.mode === 'prod' ? 'HIGH' : 'MEDIUM',
        rawSqlAccepted: false,
      };
    }
    if (payload.actionType === 'UPDATE_ORPHAN_KEY') {
      const rel = this.payloadToRelationship(payload);
      const where = this.bindKeyPredicate(rel.childColumns, payload.fromKey ?? {}, 'c');
      return {
        actionType: 'UPDATE_ORPHAN_KEY',
        sql: `UPDATE ${rel.childTable} c SET ${rel.childColumns.map((c) => `${c} = :${this.bindName(c, 'to')}`).join(', ')} WHERE ${where.sql}`,
        confirmationPhrase: SIMPLE_CONFIRMATION_PHRASE,
        expectedAffectedRows: 0,
        riskLevel: 'MEDIUM',
        rawSqlAccepted: false,
      };
    }
    throw new BadRequestException('지원하지 않는 actionType입니다');
  }

  async executeAction(payload: ActionPayload) {
    const preview = await this.previewAction(payload);
    if (payload.confirmationPhrase !== preview.confirmationPhrase) {
      throw new BadRequestException('확인 문구가 일치하지 않습니다');
    }

    if (payload.actionType === 'ADD_FK' || payload.actionType === 'ADD_UK' || payload.actionType === 'DROP_FK') {
      const created: Array<{ table: string; constraintName: string }> = [];
      try {
        await this.dataSource.query(preview.sql);
        if (payload.actionType === 'ADD_FK' || payload.actionType === 'ADD_UK') {
          created.push({
            table: payload.actionType === 'ADD_FK' ? this.normalizeIdentifier(payload.childTable!) : this.normalizeIdentifier(payload.tableName!),
            constraintName: this.normalizeConstraintName(payload.constraintName!),
          });
        }
        this.snapshotCache = null;
        const migrationPath = this.mode === 'dev' ? this.writeMigrationFile(preview.sql, payload.constraintName!) : null;
        const erd = this.mode === 'dev' ? this.regenerateErd() : { status: 'SKIPPED' };
        const status = erd.status === 'FAILED' ? 'SUCCESS_WITH_ERD_WARNING' : 'SUCCESS';
        this.writeActionLog({ payload, preview, status, migrationPath, erd });
        return { status, migrationPath, erd };
      } catch (error) {
        const compensationSql: string[] = [];
        this.snapshotCache = null;
        for (const item of created.reverse()) {
          const dropSql = `ALTER TABLE ${item.table} DROP CONSTRAINT ${item.constraintName}`;
          compensationSql.push(dropSql);
          try {
            await this.dataSource.query(dropSql);
          } catch {
            this.writeActionLog({ payload, preview, status: 'PARTIAL_FAILED', errorMessage: String(error), compensationSql });
            throw error;
          }
        }
        this.writeActionLog({ payload, preview, status: 'FAILED', errorMessage: String(error), compensationSql });
        if (this.isOracleConstraintAlreadyExistsError(error)) {
          throw new BadRequestException('동일한 constraint 또는 참조 제약이 이미 존재합니다. 새로고침 후 현재 물리 제약 상태를 확인하세요.');
        }
        throw error;
      }
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.query(preview.sql);
      const after = payload.childTable && payload.parentTable
        ? await this.scanOrphans(this.payloadToRelationship(payload))
        : null;
      this.writeActionLog({ payload, preview, status: 'SUCCESS', afterOrphanCount: after?.orphanCount });
      return { status: 'SUCCESS', afterOrphanCount: after?.orphanCount };
    });
  }

  getActions() {
    return { logDir: LOG_DIR_DISPLAY };
  }

  private async loadSnapshot(force = false): Promise<SchemaSnapshot> {
    if (!force && this.snapshotCache && Date.now() - this.snapshotCache.at < this.cacheTtlMs) {
      return this.snapshotCache.snapshot;
    }
    const [tables, columns, keyRows, fkRows] = await Promise.all([
      this.dataSource.query<TableMeta[]>(`
        SELECT t.TABLE_NAME AS "tableName", NVL(c.COMMENTS, '') AS "tableComment", t.NUM_ROWS AS "numRows"
        FROM USER_TABLES t
        LEFT JOIN USER_TAB_COMMENTS c ON c.TABLE_NAME = t.TABLE_NAME
        WHERE t.NESTED = 'NO' AND t.TABLE_NAME NOT LIKE 'BIN$%'
        ORDER BY t.TABLE_NAME
      `),
      this.dataSource.query<ColumnMeta[]>(`
        SELECT c.TABLE_NAME AS "tableName", c.COLUMN_NAME AS "columnName", c.COLUMN_ID AS "columnId",
               c.DATA_TYPE AS "dataType", c.NULLABLE AS "nullable", c.DATA_LENGTH AS "dataLength",
               c.DATA_PRECISION AS "dataPrecision", c.DATA_SCALE AS "dataScale",
               c.DATA_DEFAULT AS "dataDefault", NVL(cc.COMMENTS, '') AS "comments"
        FROM USER_TAB_COLUMNS c
        LEFT JOIN USER_COL_COMMENTS cc ON cc.TABLE_NAME = c.TABLE_NAME AND cc.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_NAME NOT LIKE 'BIN$%'
        ORDER BY c.TABLE_NAME, c.COLUMN_ID
      `),
      this.dataSource.query<Array<{ tableName: string; constraintName: string; constraintType: ConstraintType; columnName: string; position: number }>>(`
        SELECT cons.TABLE_NAME AS "tableName", cons.CONSTRAINT_NAME AS "constraintName",
               cons.CONSTRAINT_TYPE AS "constraintType", cols.COLUMN_NAME AS "columnName", cols.POSITION AS "position"
        FROM USER_CONSTRAINTS cons
        JOIN USER_CONS_COLUMNS cols ON cols.CONSTRAINT_NAME = cons.CONSTRAINT_NAME
        WHERE cons.CONSTRAINT_TYPE IN ('P','U') AND cons.TABLE_NAME NOT LIKE 'BIN$%'
        ORDER BY cons.TABLE_NAME, cons.CONSTRAINT_NAME, cols.POSITION
      `),
      this.dataSource.query<Array<{ constraintName: string; childTable: string; childColumn: string; parentTable: string; parentColumn: string; position: number; deleteRule: string }>>(`
        SELECT fk.CONSTRAINT_NAME AS "constraintName", fk.TABLE_NAME AS "childTable",
               fkc.COLUMN_NAME AS "childColumn", pk.TABLE_NAME AS "parentTable",
               pkc.COLUMN_NAME AS "parentColumn", fkc.POSITION AS "position", fk.DELETE_RULE AS "deleteRule"
        FROM USER_CONSTRAINTS fk
        JOIN USER_CONS_COLUMNS fkc ON fkc.CONSTRAINT_NAME = fk.CONSTRAINT_NAME
        JOIN USER_CONSTRAINTS pk ON pk.CONSTRAINT_NAME = fk.R_CONSTRAINT_NAME
        JOIN USER_CONS_COLUMNS pkc ON pkc.CONSTRAINT_NAME = pk.CONSTRAINT_NAME AND pkc.POSITION = fkc.POSITION
        WHERE fk.CONSTRAINT_TYPE = 'R' AND fk.TABLE_NAME NOT LIKE 'BIN$%'
        ORDER BY fk.CONSTRAINT_NAME, fkc.POSITION
      `),
    ]);

    const keys = this.groupKeys(keyRows);
    const foreignKeys = this.groupForeignKeys(fkRows);
    const snapshot = { tables, columns, keys, foreignKeys };
    this.snapshotCache = { at: Date.now(), snapshot };
    return snapshot;
  }

  private get mode(): 'dev' | 'prod' {
    return process.env.SCHEMA_GOVERNANCE_MODE === 'prod' ? 'prod' : 'dev';
  }

  private validateActionPayload(payload: ActionPayload) {
    if (!payload.actionType) {
      throw new BadRequestException('actionType이 필요합니다');
    }
    if (payload.constraintName) {
      this.normalizeConstraintName(payload.constraintName);
    }
    for (const table of [payload.childTable, payload.parentTable, payload.tableName]) {
      if (table) this.normalizeIdentifier(table);
    }
    for (const columns of [payload.childColumns, payload.parentColumns, payload.columns]) {
      columns?.forEach((column) => this.normalizeIdentifier(column));
    }
  }

  private payloadToRelationship(payload: ActionPayload): ErRelationship {
    return {
      relationshipType: 'INFERRED',
      childTable: this.normalizeIdentifier(payload.childTable!),
      childColumns: payload.childColumns!.map((c) => this.normalizeIdentifier(c)),
      parentTable: this.normalizeIdentifier(payload.parentTable!),
      parentColumns: payload.parentColumns!.map((c) => this.normalizeIdentifier(c)),
      parentKeyReady: false,
      tenantIncluded: this.hasTenantColumns(payload.childColumns ?? []) && this.hasTenantColumns(payload.parentColumns ?? []),
      confidence: 'HIGH',
    };
  }

  private buildAddFkSql(constraintName: string, rel: ErRelationship): string {
    this.assertSameLength(rel.childColumns, rel.parentColumns);
    return `ALTER TABLE ${rel.childTable} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${rel.childColumns.join(', ')}) REFERENCES ${rel.parentTable} (${rel.parentColumns.join(', ')}) ENABLE VALIDATE`;
  }

  private buildDropFkSql(fk: ForeignKeyMeta): string {
    return `ALTER TABLE ${fk.childTable} DROP CONSTRAINT ${fk.constraintName}`;
  }

  private buildDeleteOrphansSql(rel: ErRelationship): string {
    this.assertSameLength(rel.childColumns, rel.parentColumns);
    const exists = rel.childColumns.map((col, idx) => `p.${rel.parentColumns[idx]} = c.${col}`).join(' AND ');
    const childNotNull = rel.childColumns.map((col) => `c.${col} IS NOT NULL`).join(' AND ');
    return `DELETE FROM ${rel.childTable} c WHERE ${childNotNull} AND NOT EXISTS (SELECT 1 FROM ${rel.parentTable} p WHERE ${exists})`;
  }

  private normalizeIdentifier(value: string): string {
    const upper = String(value ?? '').toUpperCase();
    if (!IDENTIFIER.test(upper)) {
      throw new BadRequestException(`유효하지 않은 식별자입니다: ${value}`);
    }
    return upper;
  }

  private normalizeConstraintName(value: string): string {
    const upper = String(value ?? '').toUpperCase();
    if (!CONSTRAINT_IDENTIFIER.test(upper)) {
      throw new BadRequestException(`유효하지 않은 constraint 이름입니다: ${value}`);
    }
    return upper;
  }

  private groupColumns(columns: ColumnMeta[]) {
    const map = new Map<string, ColumnMeta[]>();
    for (const column of columns) {
      if (!map.has(column.tableName)) map.set(column.tableName, []);
      map.get(column.tableName)!.push(column);
    }
    return map;
  }

  private primaryKeyColumnsByTable(keys: KeyMeta[]) {
    const map = new Map<string, string[]>();
    for (const key of keys) {
      if (key.constraintType === 'P') {
        map.set(key.tableName, key.columns);
      }
    }
    return map;
  }

  private fkCandidateColumnsByTable(relationships: ErRelationship[]) {
    const map = new Map<string, Set<string>>();
    for (const rel of relationships) {
      if (!map.has(rel.childTable)) {
        map.set(rel.childTable, new Set<string>());
      }
      for (const column of rel.childColumns) {
        map.get(rel.childTable)!.add(column);
      }
    }
    return map;
  }

  private formatColumnType(column: ColumnMeta): string {
    if (column.dataType === 'VARCHAR2' || column.dataType === 'CHAR') {
      return `${column.dataType}(${column.dataLength ?? ''})`;
    }
    if (column.dataType === 'NUMBER' && column.dataPrecision) {
      return column.dataScale ? `NUMBER(${column.dataPrecision},${column.dataScale})` : `NUMBER(${column.dataPrecision})`;
    }
    return column.dataType;
  }

  private groupKeys(rows: Array<{ tableName: string; constraintName: string; constraintType: ConstraintType; columnName: string; position: number }>): KeyMeta[] {
    const map = new Map<string, KeyMeta>();
    for (const row of rows) {
      const key = `${row.tableName}:${row.constraintName}`;
      if (!map.has(key)) {
        map.set(key, { tableName: row.tableName, constraintName: row.constraintName, constraintType: row.constraintType, columns: [] });
      }
      map.get(key)!.columns.push(row.columnName);
    }
    return [...map.values()];
  }

  private groupForeignKeys(rows: Array<{ constraintName: string; childTable: string; childColumn: string; parentTable: string; parentColumn: string; deleteRule: string }>): ForeignKeyMeta[] {
    const map = new Map<string, ForeignKeyMeta>();
    for (const row of rows) {
      if (!map.has(row.constraintName)) {
        map.set(row.constraintName, {
          constraintName: row.constraintName,
          childTable: row.childTable,
          childColumns: [],
          parentTable: row.parentTable,
          parentColumns: [],
          deleteRule: row.deleteRule,
        });
      }
      map.get(row.constraintName)!.childColumns.push(row.childColumn);
      map.get(row.constraintName)!.parentColumns.push(row.parentColumn);
    }
    return [...map.values()];
  }

  private hasMatchingKey(keys: KeyMeta[], tableName: string, columns: string[]): boolean {
    return keys.some((key) => key.tableName === tableName && key.columns.join('|') === columns.join('|'));
  }

  private findExistingKey(keys: KeyMeta[], tableName: string, columns: string[]): KeyMeta | undefined {
    return keys.find((key) => key.tableName === tableName && this.sameColumns(key.columns, columns));
  }

  private findExistingForeignKey(foreignKeys: ForeignKeyMeta[], rel: ErRelationship): ForeignKeyMeta | undefined {
    return foreignKeys.find((fk) => (
      fk.childTable === rel.childTable
      && fk.parentTable === rel.parentTable
      && this.sameColumns(fk.childColumns, rel.childColumns)
      && this.sameColumns(fk.parentColumns, rel.parentColumns)
    ));
  }

  private findConstraintByName(snapshot: SchemaSnapshot, constraintName: string): KeyMeta | ForeignKeyMeta | undefined {
    const normalized = this.normalizeConstraintName(constraintName);
    return snapshot.keys.find((key) => key.constraintName === normalized)
      ?? snapshot.foreignKeys.find((fk) => fk.constraintName === normalized);
  }

  private sameColumns(left: string[], right: string[]): boolean {
    return left.join('|') === right.join('|');
  }

  private isOracleConstraintAlreadyExistsError(error: unknown): boolean {
    const message = String(error);
    return message.includes('ORA-02275')
      || message.includes('ORA-02264')
      || message.includes('ORA-02261');
  }

  private hasTenantColumns(columns: string[]): boolean {
    return TENANT_COLUMNS.every((column) => columns.includes(column));
  }

  private preferTenantColumns(table: string, otherTable: string, terminalColumn: string, columnsByTable: Map<string, ColumnMeta[]>): string[] | null {
    const tableCols = new Set((columnsByTable.get(table) ?? []).map((c) => c.columnName));
    const otherCols = new Set((columnsByTable.get(otherTable) ?? []).map((c) => c.columnName));
    if (!tableCols.has(terminalColumn)) {
      return null;
    }
    if (
      (table === 'USERS' && terminalColumn === 'EMAIL')
      || (otherTable === 'USERS' && terminalColumn === 'EMAIL')
    ) {
      return [terminalColumn];
    }
    if (TENANT_COLUMNS.every((c) => tableCols.has(c) && otherCols.has(c))) {
      return [...TENANT_COLUMNS, terminalColumn];
    }
    return [terminalColumn];
  }

  private resolveParentTable(columnName: string, tableSet: Set<string>, childTable?: string): string | null {
    if (childTable === 'ACTIVITY_LOGS' && columnName === 'EMAIL' && tableSet.has('USERS')) {
      return 'USERS';
    }
    if (SEMANTIC_PARENT[columnName] && tableSet.has(SEMANTIC_PARENT[columnName])) {
      return SEMANTIC_PARENT[columnName];
    }
    const base = columnName.endsWith('_CODE')
      ? columnName.slice(0, -5)
      : columnName.endsWith('_ID') || columnName.endsWith('_NO')
        ? columnName.slice(0, -3)
        : null;
    if (!base) return null;
    const candidates = [`${base}_MASTERS`, `${base}S`];
    return candidates.find((candidate) => tableSet.has(candidate)) ?? null;
  }

  private resolveParentColumn(columnName: string, parentTable: string, columnsByTable: Map<string, ColumnMeta[]>): string | null {
    const parentCols = new Set((columnsByTable.get(parentTable) ?? []).map((c) => c.columnName));
    if (parentCols.has(columnName)) return columnName;
    if ((columnName === 'PARENT_ITEM_CODE' || columnName === 'CHILD_ITEM_CODE') && parentCols.has('ITEM_CODE')) return 'ITEM_CODE';
    if (columnName.endsWith('_ID')) {
      const noColumn = `${columnName.slice(0, -3)}_NO`;
      if (parentCols.has(noColumn)) return noColumn;
    }
    return null;
  }

  private relationshipId(type: RelationshipType, childTable: string, parentTable: string, childColumns: string[]) {
    return `${type}:${childTable}:${parentTable}:${childColumns.join(',')}`;
  }

  private moduleFor(tableName: string): string {
    if (/^(ITEM_|BOM_|ROUTING_|PROCESS_|WORKER_|VENDOR_|PARTNER_|COMPANY_|WAREHOUSE_|LABEL_|IQC_PART_SPEC)/.test(tableName)) return 'Master Data';
    if (/^(MAT_|MATERIAL_|PURCHASE_|ARRIVAL|RECEIV|ISSUE|INVENTORY|STOCK|LOT_)/.test(tableName)) return 'Material/Inventory';
    if (/^(PROD_|JOB_|WORK_ORDER|INPUT_|WIP_|BOX_|PALLET_)/.test(tableName)) return 'Production';
    if (/^(QUALITY_|IQC_|OQC_|INSPECT|DEFECT|FAI_|MSA_|GAUGE_|CALIBRATION_)/.test(tableName)) return 'Quality';
    if (/^(USERS|ROLES|MENU_|PDA_|COM_|SYS_|ACTIVITY_|TRAINING_|DEPARTMENT)/.test(tableName)) return 'System/Auth';
    return 'Other';
  }

  private isLogLike(tableName: string): boolean {
    return /(_LOGS?|_HISTORY|_TRANSACTIONS?|AUDIT|TRACE)/.test(tableName);
  }

  private assertSameLength(left: string[], right: string[]) {
    if (left.length === 0 || left.length !== right.length) {
      throw new BadRequestException('컬럼 수가 일치하지 않습니다');
    }
  }

  private assertTableColumnsExist(snapshot: SchemaSnapshot, tableName: string, columns: string[]) {
    const tableColumns = new Set(snapshot.columns.filter((column) => column.tableName === tableName).map((column) => column.columnName));
    if (tableColumns.size === 0 && !snapshot.tables.some((table) => table.tableName === tableName)) {
      throw new BadRequestException(`존재하지 않는 테이블입니다: ${tableName}`);
    }
    const missing = columns.filter((column) => !tableColumns.has(column));
    if (missing.length > 0) {
      throw new BadRequestException(`존재하지 않는 컬럼입니다: ${tableName}.${missing.join(', ')}`);
    }
  }

  private bindName(column: string, suffix: string) {
    return `${column}_${suffix}`.replace(/[^A-Z0-9_]/g, '_');
  }

  private bindKeyPredicate(columns: string[], values: Record<string, string | number | null>, alias: string) {
    return {
      sql: columns.map((column) => `${alias}.${column} = :${this.bindName(column, 'from')}`).join(' AND '),
      values,
    };
  }

  private writeMigrationFile(sql: string, name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 48);
    const fileName = `${new Date().toISOString().slice(0, 10)}_schema_governance_${Date.now()}_${slug}.sql`;
    const migrationsDir = this.backendMigrationsDir();
    mkdirSync(migrationsDir, { recursive: true });
    const filePath = path.join(migrationsDir, fileName);
    writeFileSync(filePath, `${sql};\n`, 'utf8');
    return filePath;
  }

  private backendMigrationsDir(): string {
    const cwd = process.cwd();
    const isBackendCwd = path.basename(cwd).toLowerCase() === 'backend'
      && path.basename(path.dirname(cwd)).toLowerCase() === 'apps';
    const backendRoot = isBackendCwd ? cwd : path.join(cwd, 'apps', 'backend');
    return path.join(backendRoot, 'src', 'migrations');
  }

  private regenerateErd() {
    try {
      execFileSync('python', ['tools/generate_db_schema_doc.py'], {
        cwd: process.cwd(),
        env: { ...process.env, ORACLE_SITE: process.env.ORACLE_SITE ?? 'JSHANES' },
        stdio: 'pipe',
      });
      return { status: 'SUCCESS' };
    } catch (error) {
      return { status: 'FAILED', errorMessage: String(error), command: 'ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py' };
    }
  }

  private writeActionLog(entry: Record<string, unknown>) {
    const dir = path.join(process.cwd(), LOG_DIR_DISPLAY);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `actions-${new Date().toISOString().slice(0, 7)}.jsonl`);
    appendFileSync(file, `${JSON.stringify({ actionId: `SGA-${Date.now()}`, executedAt: new Date().toISOString(), ...entry })}\n`, 'utf8');
  }
}

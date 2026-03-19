# Oracle DB 백업 스케줄러 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oracle DB의 TEST 스키마를 매일 백업(DDL + INSERT SQL)하여 백엔드 서버 로컬에 저장하고, 복구 스크립트를 자동 생성하는 스케줄러 작업 구현

**Architecture:** `SERVICE` executor를 통해 NestJS 서비스(`DbBackupService`)를 호출. oracledb로 스키마 메타데이터(DDL)와 테이블 데이터(INSERT SQL)를 추출하여 날짜별 디렉토리에 저장. 7일 보관 정책으로 자동 정리. 복구 시 `restore.sql`을 sqlplus로 실행하면 됨.

**Tech Stack:** NestJS, oracledb (기존), TypeORM DataSource, fs/path (Node.js), archiver (zip 압축)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `apps/backend/src/modules/scheduler/services/db-backup.service.ts` | 핵심 백업 로직 (DDL 추출, 데이터 덤프, zip 압축, 보관 정리) |
| Create | `apps/backend/src/modules/scheduler/services/db-backup.service.spec.ts` | 유닛 테스트 |
| Modify | `apps/backend/src/modules/scheduler/scheduler.module.ts` | DbBackupService provider 등록 |
| Modify | `apps/backend/src/modules/scheduler/config/scheduler-security.config.ts` | 화이트리스트에 `DbBackupService.runBackup` 추가 + SERVICE_CLASS_MAP 등록 |
| Create | `scripts/migration/seed_db_backup_job.sql` | SCHEDULER_JOBS 시드 INSERT |

---

### Task 1: archiver 패키지 설치

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: archiver + @types 설치**

```bash
cd /c/Project/HANES && pnpm add -F apps/backend archiver && pnpm add -D -F apps/backend @types/archiver
```

- [ ] **Step 2: 설치 확인**

Run: `pnpm ls archiver --filter apps/backend`
Expected: archiver 버전 출력

---

### Task 2: DbBackupService 핵심 구현

**Files:**
- Create: `apps/backend/src/modules/scheduler/services/db-backup.service.ts`

- [ ] **Step 1: DbBackupService 작성**

```typescript
/**
 * @file src/modules/scheduler/services/db-backup.service.ts
 * @description Oracle DB 스키마 백업 서비스 - DDL + INSERT SQL을 추출하여 로컬에 저장한다.
 *
 * 초보자 가이드:
 * 1. **runBackup()**: 스케줄러에서 호출되는 메인 메서드 — DDL 추출 → 데이터 덤프 → zip 압축 → 보관 정리
 * 2. **extractDdl()**: DBMS_METADATA.GET_DDL로 테이블/인덱스/시퀀스/트리거 DDL 추출
 * 3. **dumpTableData()**: 테이블별 SELECT → INSERT INTO ... VALUES (...) SQL 생성
 * 4. **generateRestoreScript()**: 복구 순서를 정의한 restore.sql 생성
 * 5. **compressBackup()**: 백업 폴더를 zip으로 압축
 * 6. **cleanOldBackups()**: 보관 기간(기본 7일) 초과 백업 자동 삭제
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';

/** 백업 실행 파라미터 */
interface BackupParams {
  /** 백업 저장 경로 (기본: ./backups) */
  backupDir?: string;
  /** 보관 일수 (기본: 7) */
  retentionDays?: number;
  /** 백업 대상 스키마 (기본: 환경변수 ORACLE_USER) */
  schema?: string;
}

/** 오라클 테이블 컬럼 정보 */
interface OracleColumn {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  DATA_LENGTH: number;
  NULLABLE: string;
}

@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * 스케줄러에서 호출되는 메인 백업 메서드
   * @param params 백업 파라미터 (execParams에서 전달)
   * @returns 실행 결과 (affectedRows = 백업된 테이블 수)
   */
  async runBackup(params?: BackupParams): Promise<{ affectedRows: number }> {
    const backupRoot = params?.backupDir ?? path.resolve(process.cwd(), 'backups');
    const retentionDays = params?.retentionDays ?? 7;
    const schema = (params?.schema ?? process.env.ORACLE_USER ?? 'TEST').toUpperCase();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `HANES_MES_${timestamp}`;
    const backupDir = path.join(backupRoot, backupName);

    this.logger.log(`백업 시작: ${backupName} (스키마: ${schema})`);

    // 백업 디렉토리 생성
    const ddlDir = path.join(backupDir, '01_ddl');
    const dataDir = path.join(backupDir, '02_data');
    fs.mkdirSync(ddlDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    // 1. DDL 추출
    await this.extractDdl(schema, ddlDir);

    // 2. 테이블 목록 조회
    const tables: { TABLE_NAME: string }[] = await this.dataSource.query(
      `SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = :schema ORDER BY TABLE_NAME`,
      [schema],
    );

    // 3. 테이블별 데이터 덤프
    let tableCount = 0;
    for (const { TABLE_NAME } of tables) {
      const rows = await this.dumpTableData(schema, TABLE_NAME, dataDir);
      if (rows > 0) tableCount++;
    }

    // 4. 복구 스크립트 생성
    await this.generateRestoreScript(
      schema,
      backupDir,
      tables.map((t) => t.TABLE_NAME),
    );

    // 5. zip 압축
    const zipPath = `${backupDir}.zip`;
    await this.compressBackup(backupDir, zipPath);

    // 6. 원본 폴더 삭제 (zip만 보관)
    fs.rmSync(backupDir, { recursive: true, force: true });

    // 7. 오래된 백업 정리
    this.cleanOldBackups(backupRoot, retentionDays);

    this.logger.log(`백업 완료: ${zipPath} (테이블 ${tableCount}개)`);
    return { affectedRows: tableCount };
  }

  /**
   * DBMS_METADATA.GET_DDL로 스키마 오브젝트 DDL 추출
   */
  private async extractDdl(schema: string, ddlDir: string): Promise<void> {
    // 테이블 DDL
    const tableDdls: { DDL_TEXT: string }[] = await this.dataSource.query(
      `SELECT DBMS_METADATA.GET_DDL('TABLE', TABLE_NAME, :schema) AS DDL_TEXT
         FROM ALL_TABLES WHERE OWNER = :schema ORDER BY TABLE_NAME`,
      [schema, schema],
    );
    fs.writeFileSync(
      path.join(ddlDir, 'tables.sql'),
      tableDdls.map((r) => r.DDL_TEXT + ';\n').join('\n'),
      'utf-8',
    );

    // 인덱스 DDL
    const indexDdls: { DDL_TEXT: string }[] = await this.dataSource.query(
      `SELECT DBMS_METADATA.GET_DDL('INDEX', INDEX_NAME, :schema) AS DDL_TEXT
         FROM ALL_INDEXES WHERE OWNER = :schema AND INDEX_TYPE != 'LOB'
         ORDER BY INDEX_NAME`,
      [schema, schema],
    );
    if (indexDdls.length > 0) {
      fs.writeFileSync(
        path.join(ddlDir, 'indexes.sql'),
        indexDdls.map((r) => r.DDL_TEXT + ';\n').join('\n'),
        'utf-8',
      );
    }

    // 시퀀스 DDL
    const seqDdls: { DDL_TEXT: string }[] = await this.dataSource.query(
      `SELECT DBMS_METADATA.GET_DDL('SEQUENCE', SEQUENCE_NAME, :schema) AS DDL_TEXT
         FROM ALL_SEQUENCES WHERE SEQUENCE_OWNER = :schema ORDER BY SEQUENCE_NAME`,
      [schema, schema],
    );
    if (seqDdls.length > 0) {
      fs.writeFileSync(
        path.join(ddlDir, 'sequences.sql'),
        seqDdls.map((r) => r.DDL_TEXT + ';\n').join('\n'),
        'utf-8',
      );
    }

    // 트리거 DDL
    const trigDdls: { DDL_TEXT: string }[] = await this.dataSource.query(
      `SELECT DBMS_METADATA.GET_DDL('TRIGGER', TRIGGER_NAME, :schema) AS DDL_TEXT
         FROM ALL_TRIGGERS WHERE OWNER = :schema ORDER BY TRIGGER_NAME`,
      [schema, schema],
    );
    if (trigDdls.length > 0) {
      fs.writeFileSync(
        path.join(ddlDir, 'triggers.sql'),
        trigDdls.map((r) => r.DDL_TEXT + ';\n').join('\n'),
        'utf-8',
      );
    }

    this.logger.log(`DDL 추출 완료: 테이블 ${tableDdls.length}, 인덱스 ${indexDdls.length}, 시퀀스 ${seqDdls.length}, 트리거 ${trigDdls.length}`);
  }

  /**
   * 테이블 데이터를 INSERT SQL로 덤프
   * @returns 덤프된 행 수
   */
  private async dumpTableData(
    schema: string,
    tableName: string,
    dataDir: string,
  ): Promise<number> {
    // 컬럼 정보 조회
    const columns: OracleColumn[] = await this.dataSource.query(
      `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE
         FROM ALL_TAB_COLUMNS
        WHERE OWNER = :schema AND TABLE_NAME = :table
        ORDER BY COLUMN_ID`,
      [schema, tableName],
    );

    if (columns.length === 0) return 0;

    // 데이터 조회 (1000행씩 배치)
    const colNames = columns.map((c) => `"${c.COLUMN_NAME}"`).join(', ');
    const countResult: { CNT: number }[] = await this.dataSource.query(
      `SELECT COUNT(*) AS CNT FROM "${schema}"."${tableName}"`,
    );
    const totalRows = countResult[0]?.CNT ?? 0;

    if (totalRows === 0) return 0;

    const filePath = path.join(dataDir, `${tableName}.sql`);
    const stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
    stream.write(`-- ${tableName}: ${totalRows} rows\n`);
    stream.write(`-- Generated at ${new Date().toISOString()}\n\n`);

    const batchSize = 1000;
    let offset = 0;

    while (offset < totalRows) {
      const rows: Record<string, unknown>[] = await this.dataSource.query(
        `SELECT ${colNames} FROM "${schema}"."${tableName}"
          ORDER BY ROWID
         OFFSET :offset ROWS FETCH NEXT :batchSize ROWS ONLY`,
        [offset, batchSize],
      );

      for (const row of rows) {
        const values = columns.map((col) => this.formatValue(row[col.COLUMN_NAME], col.DATA_TYPE));
        stream.write(
          `INSERT INTO "${tableName}" (${colNames}) VALUES (${values.join(', ')});\n`,
        );
      }

      offset += batchSize;
    }

    stream.write('\nCOMMIT;\n');
    stream.end();

    // stream이 완료될 때까지 대기
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return totalRows;
  }

  /**
   * Oracle 데이터 타입에 맞게 INSERT용 값 포맷팅
   */
  private formatValue(value: unknown, dataType: string): string {
    if (value === null || value === undefined) return 'NULL';

    // DATE / TIMESTAMP
    if (dataType.includes('DATE') || dataType.includes('TIMESTAMP')) {
      if (value instanceof Date) {
        const iso = value.toISOString().replace('T', ' ').slice(0, 19);
        return `TO_TIMESTAMP('${iso}', 'YYYY-MM-DD HH24:MI:SS')`;
      }
      return `TO_TIMESTAMP('${String(value)}', 'YYYY-MM-DD HH24:MI:SS')`;
    }

    // NUMBER
    if (dataType === 'NUMBER' || dataType === 'FLOAT') {
      return String(value);
    }

    // CLOB / 문자열
    const strVal = String(value).replace(/'/g, "''");
    if (dataType === 'CLOB' || dataType === 'NCLOB') {
      return `TO_CLOB('${strVal}')`;
    }

    return `'${strVal}'`;
  }

  /**
   * 복구 스크립트 생성 — FK 비활성화 → DDL → 데이터 INSERT → FK 활성화
   */
  private async generateRestoreScript(
    schema: string,
    backupDir: string,
    tableNames: string[],
  ): Promise<void> {
    const lines: string[] = [
      `-- HANES MES 복구 스크립트`,
      `-- Generated at ${new Date().toISOString()}`,
      `-- Schema: ${schema}`,
      `-- Usage: sqlplus ${schema}/password@DB @restore.sql`,
      '',
      'SET DEFINE OFF;',
      'SET SQLBLANKLINES ON;',
      '',
      '-- 1. FK 제약조건 비활성화',
      'BEGIN',
      '  FOR c IN (SELECT CONSTRAINT_NAME, TABLE_NAME FROM USER_CONSTRAINTS WHERE CONSTRAINT_TYPE = \'R\') LOOP',
      '    EXECUTE IMMEDIATE \'ALTER TABLE "\' || c.TABLE_NAME || \'" DISABLE CONSTRAINT "\' || c.CONSTRAINT_NAME || \'"\';',
      '  END LOOP;',
      'END;',
      '/',
      '',
      '-- 2. 기존 데이터 삭제',
    ];

    // 역순으로 TRUNCATE (FK 의존성 고려)
    for (const t of [...tableNames].reverse()) {
      lines.push(`TRUNCATE TABLE "${t}";`);
    }

    lines.push('', '-- 3. DDL 실행 (필요 시 주석 해제)');
    lines.push('-- @01_ddl/tables.sql');
    lines.push('-- @01_ddl/indexes.sql');
    lines.push('-- @01_ddl/sequences.sql');
    lines.push('-- @01_ddl/triggers.sql');

    lines.push('', '-- 4. 데이터 INSERT');
    for (const t of tableNames) {
      lines.push(`@02_data/${t}.sql`);
    }

    lines.push(
      '',
      '-- 5. FK 제약조건 재활성화',
      'BEGIN',
      '  FOR c IN (SELECT CONSTRAINT_NAME, TABLE_NAME FROM USER_CONSTRAINTS WHERE CONSTRAINT_TYPE = \'R\') LOOP',
      '    EXECUTE IMMEDIATE \'ALTER TABLE "\' || c.TABLE_NAME || \'" ENABLE CONSTRAINT "\' || c.CONSTRAINT_NAME || \'"\';',
      '  END LOOP;',
      'END;',
      '/',
      '',
      'PROMPT 복구 완료!',
      'EXIT;',
    );

    fs.writeFileSync(
      path.join(backupDir, 'restore.sql'),
      lines.join('\n'),
      'utf-8',
    );
  }

  /**
   * 백업 폴더를 zip으로 압축
   */
  private async compressBackup(sourceDir: string, zipPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err: Error) => reject(err));

      archive.pipe(output);
      archive.directory(sourceDir, path.basename(sourceDir));
      archive.finalize();
    });
  }

  /**
   * 보관 기간 초과 백업 삭제
   */
  private cleanOldBackups(backupRoot: string, retentionDays: number): void {
    if (!fs.existsSync(backupRoot)) return;

    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const entries = fs.readdirSync(backupRoot);

    for (const entry of entries) {
      if (!entry.startsWith('HANES_MES_') || !entry.endsWith('.zip')) continue;

      const fullPath = path.join(backupRoot, entry);
      const stat = fs.statSync(fullPath);

      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
        this.logger.log(`오래된 백업 삭제: ${entry}`);
      }
    }
  }
}
```

- [ ] **Step 2: 파일이 올바르게 생성되었는지 확인**

Run: `pnpm exec tsc --noEmit --project apps/backend/tsconfig.build.json 2>&1 | head -20`

---

### Task 3: 스케줄러 모듈에 DbBackupService 등록

**Files:**
- Modify: `apps/backend/src/modules/scheduler/scheduler.module.ts`
- Modify: `apps/backend/src/modules/scheduler/config/scheduler-security.config.ts`

- [ ] **Step 1: scheduler.module.ts에 provider 추가**

`providers` 배열에 `DbBackupService` 추가:

```typescript
import { DbBackupService } from './services/db-backup.service';
// ...
providers: [
  // ... 기존 providers
  DbBackupService,
],
```

- [ ] **Step 2: scheduler-security.config.ts 화이트리스트 등록**

`ALLOWED_SERVICE_METHODS`에 추가:
```typescript
export const ALLOWED_SERVICE_METHODS: string[] = [
  'InterfaceService.scheduledSyncBom',
  'InterfaceService.scheduledBulkRetry',
  'DbBackupService.runBackup',  // DB 백업 스케줄러
];
```

`scheduler.module.ts`의 `onModuleInit` 또는 모듈 초기화 시 SERVICE_CLASS_MAP에 등록:
```typescript
import { DbBackupService } from './services/db-backup.service';
import { SERVICE_CLASS_MAP } from './config/scheduler-security.config';

// 모듈 클래스에 OnModuleInit 구현 추가
export class SchedulerModule implements OnModuleInit {
  onModuleInit() {
    SERVICE_CLASS_MAP.set('DbBackupService', DbBackupService);
  }
}
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm build`
Expected: 에러 0건

---

### Task 4: 시드 SQL 작성

**Files:**
- Create: `scripts/migration/seed_db_backup_job.sql`

- [ ] **Step 1: 시드 SQL 작성**

```sql
-- DB 백업 스케줄러 작업 시드
-- Usage: oracle-db 스킬로 실행

INSERT INTO SCHEDULER_JOBS (
  COMPANY, PLANT_CD, JOB_CODE, JOB_NAME, JOB_GROUP,
  EXEC_TYPE, EXEC_TARGET, EXEC_PARAMS, CRON_EXPR,
  IS_ACTIVE, MAX_RETRY, TIMEOUT_SEC, DESCRIPTION,
  CREATED_BY, CREATED_AT, UPDATED_BY, UPDATED_AT
) VALUES (
  'HANES', 'PLANT01', 'DB_BACKUP_SCHEMA', 'Oracle 스키마 백업', 'MAINTENANCE',
  'SERVICE', 'DbBackupService.runBackup',
  '{"backupDir":"./backups","retentionDays":7}',
  '0 0 2 * * *',
  'N', 1, 1800, '매일 02:00 TEST 스키마 전체 백업 (DDL + INSERT SQL → zip)',
  'SYSTEM', SYSDATE, 'SYSTEM', SYSDATE
);

COMMIT;
```

- [ ] **Step 2: 사용자 확인 후 DB에 INSERT 실행**

---

### Task 5: 유닛 테스트 작성

**Files:**
- Create: `apps/backend/src/modules/scheduler/services/db-backup.service.spec.ts`

- [ ] **Step 1: 테스트 파일 작성**

주요 테스트 케이스:
1. `runBackup()` — DataSource mock으로 DDL/데이터 추출 → 파일 생성 확인
2. `formatValue()` — DATE, NUMBER, NULL, 문자열 포맷 검증
3. `cleanOldBackups()` — 보관 기간 초과 파일 삭제 확인

- [ ] **Step 2: 테스트 실행**

Run: `pnpm exec jest --testPathPattern=db-backup --verbose`
Expected: 전체 PASS

---

### Task 6: 최종 빌드 검증

- [ ] **Step 1: 전체 빌드**

Run: `pnpm build`
Expected: 에러 0건

- [ ] **Step 2: 기존 스케줄러 테스트 통과 확인**

Run: `pnpm exec jest --testPathPattern=scheduler --verbose`
Expected: 전체 PASS

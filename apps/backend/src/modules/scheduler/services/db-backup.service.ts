/**
 * @file src/modules/scheduler/services/db-backup.service.ts
 * @description DB 백업 서비스 - Oracle 스키마의 DDL·데이터를 파일로 추출하고 ZIP 압축한다.
 *
 * 초보자 가이드:
 * 1. **runBackup()**: 스케줄러에서 호출되는 메인 진입점 — DDL 추출 → 데이터 덤프 → 복원 스크립트 → ZIP 압축 → 구 백업 정리
 * 2. **extractDdl()**: DBMS_METADATA.GET_DDL로 TABLE, INDEX, SEQUENCE, TRIGGER DDL을 .sql 파일로 저장
 * 3. **dumpTableData()**: SELECT → INSERT INTO 구문으로 변환하여 .sql 파일에 기록 (1000행씩 배치)
 * 4. **formatValue()**: Oracle 타입에 맞는 INSERT 값 포맷팅 (NULL, TO_TIMESTAMP, TO_CLOB 등)
 * 5. **generateRestoreScript()**: FK 비활성화 → TRUNCATE → 데이터 로드 → FK 활성화 순서의 복원 SQL 생성
 * 6. **compressBackup()**: archiver로 백업 디렉토리를 ZIP(zlib level 9)으로 압축
 * 7. **cleanOldBackups()**: 보관 기간(retentionDays) 초과된 이전 백업 .zip 파일 삭제
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';

/** 백업 실행 파라미터 */
interface BackupParams {
  /** 백업 저장 루트 디렉토리 (기본: ./backups) */
  backupDir?: string;
  /** 이전 백업 보관 일수 (기본: 7) */
  retentionDays?: number;
  /** Oracle 스키마명 (기본: 환경변수 ORACLE_USER 또는 'TEST') */
  schema?: string;
}

/** DDL 객체 유형 */
type DdlObjectType = 'TABLE' | 'INDEX' | 'SEQUENCE' | 'TRIGGER';

/** Oracle 컬럼 메타데이터 행 */
interface OracleColumnMeta {
  COLUMN_NAME: string;
  DATA_TYPE: string;
}

/** Oracle DDL 결과 행 */
interface DdlRow {
  OBJECT_NAME: string;
  DDL_TEXT: string;
}

/** Oracle 테이블명 결과 행 */
interface TableNameRow {
  TABLE_NAME: string;
}

/** Oracle FK 제약조건 행 */
interface FkConstraintRow {
  CONSTRAINT_NAME: string;
  TABLE_NAME: string;
}

@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);

  constructor(private readonly dataSource: DataSource) {}

  // =============================================
  // 메인 실행
  // =============================================

  /**
   * 메인 백업 실행 — 스케줄러 SERVICE executor에서 호출된다.
   * @param params 백업 파라미터 (선택)
   * @returns 처리된 테이블 수
   */
  async runBackup(params?: BackupParams): Promise<{ affectedRows: number }> {
    const backupRoot = params?.backupDir ?? './backups';
    const retentionDays = params?.retentionDays ?? 7;
    const schema = params?.schema ?? process.env.ORACLE_USER ?? 'TEST';

    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\.\d+Z$/, '');
    const backupName = `HANES_MES_${timestamp}`;
    const backupDir = path.join(backupRoot, backupName);
    const ddlDir = path.join(backupDir, '01_ddl');
    const dataDir = path.join(backupDir, '02_data');

    fs.mkdirSync(ddlDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    this.logger.log(`백업 시작: schema=${schema}, dir=${backupDir}`);

    // 1. DDL 추출
    await this.extractDdl(schema, ddlDir);

    // 2. 테이블 목록 조회
    const tables = await this.dataSource.query<TableNameRow[]>(
      `SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = :schema ORDER BY TABLE_NAME`,
      [schema],
    );
    const tableNames = tables.map((t) => t.TABLE_NAME);

    // 3. 데이터 덤프
    for (const tableName of tableNames) {
      await this.dumpTableData(schema, tableName, dataDir);
    }

    // 4. 복원 스크립트 생성
    await this.generateRestoreScript(schema, backupDir, tableNames);

    // 5. ZIP 압축
    const zipPath = path.join(backupRoot, `${backupName}.zip`);
    await this.compressBackup(backupDir, zipPath);

    // 6. 원본 폴더 삭제
    fs.rmSync(backupDir, { recursive: true, force: true });

    // 7. 구 백업 정리
    await this.cleanOldBackups(backupRoot, retentionDays);

    this.logger.log(`백업 완료: ${zipPath} (테이블 ${tableNames.length}개)`);
    return { affectedRows: tableNames.length };
  }

  // =============================================
  // DDL 추출
  // =============================================

  /**
   * DBMS_METADATA.GET_DDL로 TABLE, INDEX, SEQUENCE, TRIGGER DDL을 추출한다.
   * @param schema Oracle 스키마명
   * @param ddlDir DDL 파일 저장 디렉토리
   */
  async extractDdl(schema: string, ddlDir: string): Promise<void> {
    const objectTypes: DdlObjectType[] = [
      'TABLE',
      'INDEX',
      'SEQUENCE',
      'TRIGGER',
    ];

    for (const objType of objectTypes) {
      try {
        const rows = await this.dataSource.query<DdlRow[]>(
          `SELECT OBJECT_NAME,
                  DBMS_METADATA.GET_DDL(:objType, OBJECT_NAME, :schema) AS DDL_TEXT
             FROM ALL_OBJECTS
            WHERE OWNER = :schema
              AND OBJECT_TYPE = :objType
            ORDER BY OBJECT_NAME`,
          [objType, schema, schema, objType],
        );

        if (rows.length === 0) continue;

        const filePath = path.join(ddlDir, `${objType}.sql`);
        const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

        for (const row of rows) {
          stream.write(`-- ${objType}: ${row.OBJECT_NAME}\n`);
          stream.write(`${String(row.DDL_TEXT).trim()};\n\n`);
        }

        stream.end();
        await this.waitForStream(stream);

        this.logger.log(`DDL 추출 완료: ${objType} ${rows.length}건`);
      } catch (error: unknown) {
        this.logger.warn(
          `DDL 추출 실패 (${objType}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  // =============================================
  // 테이블 데이터 덤프
  // =============================================

  /**
   * 테이블의 모든 행을 INSERT INTO 구문으로 변환하여 .sql 파일에 기록한다.
   * @param schema Oracle 스키마명
   * @param tableName 테이블명
   * @param dataDir 데이터 파일 저장 디렉토리
   */
  async dumpTableData(
    schema: string,
    tableName: string,
    dataDir: string,
  ): Promise<void> {
    const batchSize = 1000;

    // 컬럼 메타데이터 조회
    const columns = await this.dataSource.query<OracleColumnMeta[]>(
      `SELECT COLUMN_NAME, DATA_TYPE
         FROM ALL_TAB_COLUMNS
        WHERE OWNER = :schema AND TABLE_NAME = :tableName
        ORDER BY COLUMN_ID`,
      [schema, tableName],
    );

    if (columns.length === 0) return;

    const columnNames = columns.map((c) => c.COLUMN_NAME);
    const columnTypes = columns.map((c) => c.DATA_TYPE);
    const columnList = columnNames.map((c) => `"${c}"`).join(', ');

    const filePath = path.join(dataDir, `${tableName}.sql`);
    const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });
    let offset = 0;
    let totalRows = 0;

    try {
      while (true) {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          `SELECT * FROM "${schema}"."${tableName}"
            ORDER BY ROWID
            OFFSET :offset ROWS FETCH NEXT :batchSize ROWS ONLY`,
          [offset, batchSize],
        );

        if (rows.length === 0) break;

        for (const row of rows) {
          const values = columnNames.map((col, i) =>
            this.formatValue(row[col], columnTypes[i]),
          );
          stream.write(
            `INSERT INTO "${tableName}" (${columnList}) VALUES (${values.join(', ')});\n`,
          );
        }

        totalRows += rows.length;
        offset += batchSize;

        if (rows.length < batchSize) break;
      }
    } finally {
      stream.end();
      await this.waitForStream(stream);
    }

    // 빈 테이블이면 파일 삭제
    if (totalRows === 0) {
      fs.unlinkSync(filePath);
    } else {
      this.logger.debug(`데이터 덤프: ${tableName} ${totalRows}행`);
    }
  }

  // =============================================
  // 값 포맷팅
  // =============================================

  /**
   * Oracle INSERT 구문에 맞는 값 포맷팅을 수행한다.
   * @param value 컬럼 값
   * @param dataType Oracle 데이터 타입
   * @returns SQL 값 문자열
   */
  formatValue(value: unknown, dataType: string): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    const upperType = dataType.toUpperCase();

    // 날짜/타임스탬프 타입
    if (upperType.includes('TIMESTAMP') || upperType === 'DATE') {
      if (value instanceof Date) {
        const iso = value.toISOString().replace('T', ' ').replace('Z', '');
        return `TO_TIMESTAMP('${iso}', 'YYYY-MM-DD HH24:MI:SS.FF')`;
      }
      const strVal = String(value);
      return `TO_TIMESTAMP('${strVal}', 'YYYY-MM-DD HH24:MI:SS.FF')`;
    }

    // 숫자 타입
    if (
      upperType === 'NUMBER' ||
      upperType.startsWith('FLOAT') ||
      upperType.startsWith('BINARY')
    ) {
      return String(value);
    }

    // CLOB 타입
    if (upperType === 'CLOB' || upperType === 'NCLOB') {
      const escaped = String(value).replace(/'/g, "''");
      return `TO_CLOB('${escaped}')`;
    }

    // BLOB 타입 — 건너뜀
    if (upperType === 'BLOB' || upperType === 'RAW' || upperType === 'LONG RAW') {
      return 'NULL';
    }

    // 문자열 타입 (VARCHAR2, NVARCHAR2, CHAR 등)
    const escaped = String(value).replace(/'/g, "''");
    return `'${escaped}'`;
  }

  // =============================================
  // 복원 스크립트 생성
  // =============================================

  /**
   * 복원 스크립트(restore.sql)를 생성한다.
   * FK 비활성화 → TRUNCATE(역순) → 데이터 로드 → FK 활성화 순서.
   * @param schema Oracle 스키마명
   * @param backupDir 백업 디렉토리
   * @param tableNames 테이블명 목록
   */
  async generateRestoreScript(
    schema: string,
    backupDir: string,
    tableNames: string[],
  ): Promise<void> {
    // FK 제약조건 목록 조회
    const fkRows = await this.dataSource.query<FkConstraintRow[]>(
      `SELECT CONSTRAINT_NAME, TABLE_NAME
         FROM ALL_CONSTRAINTS
        WHERE OWNER = :schema
          AND CONSTRAINT_TYPE = 'R'
        ORDER BY TABLE_NAME`,
      [schema],
    );

    const lines: string[] = [];
    lines.push('-- ============================================');
    lines.push('-- HANES MES 복원 스크립트 (자동 생성)');
    lines.push(`-- 스키마: ${schema}`);
    lines.push(`-- 생성일시: ${new Date().toISOString()}`);
    lines.push('-- ============================================');
    lines.push('');

    // 1단계: FK 비활성화
    lines.push('-- [1단계] FK 제약조건 비활성화');
    for (const fk of fkRows) {
      lines.push(
        `ALTER TABLE "${schema}"."${fk.TABLE_NAME}" DISABLE CONSTRAINT "${fk.CONSTRAINT_NAME}";`,
      );
    }
    lines.push('');

    // 2단계: TRUNCATE (역순)
    lines.push('-- [2단계] 테이블 TRUNCATE (역순)');
    const reversed = [...tableNames].reverse();
    for (const tbl of reversed) {
      lines.push(`TRUNCATE TABLE "${schema}"."${tbl}";`);
    }
    lines.push('');

    // 3단계: 데이터 로드
    lines.push('-- [3단계] 데이터 로드');
    for (const tbl of tableNames) {
      const dataFile = path.join('02_data', `${tbl}.sql`).replace(/\\/g, '/');
      lines.push(`@${dataFile}`);
    }
    lines.push('');

    // 4단계: FK 활성화
    lines.push('-- [4단계] FK 제약조건 활성화');
    for (const fk of fkRows) {
      lines.push(
        `ALTER TABLE "${schema}"."${fk.TABLE_NAME}" ENABLE CONSTRAINT "${fk.CONSTRAINT_NAME}";`,
      );
    }
    lines.push('');
    lines.push('COMMIT;');

    fs.writeFileSync(
      path.join(backupDir, 'restore.sql'),
      lines.join('\n'),
      'utf8',
    );
    this.logger.log(`복원 스크립트 생성 완료 (FK ${fkRows.length}건)`);
  }

  // =============================================
  // ZIP 압축
  // =============================================

  /**
   * 백업 디렉토리를 ZIP으로 압축한다 (zlib level 9).
   * @param sourceDir 압축 대상 디렉토리
   * @param zipPath 출력 ZIP 파일 경로
   */
  async compressBackup(sourceDir: string, zipPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver.create('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        this.logger.log(
          `ZIP 압축 완료: ${zipPath} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`,
        );
        resolve();
      });

      archive.on('error', (err: Error) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourceDir, path.basename(sourceDir));
      archive.finalize().catch(reject);
    });
  }

  // =============================================
  // 구 백업 정리
  // =============================================

  /**
   * 보관 기간 초과된 이전 백업 ZIP 파일을 삭제한다.
   * @param backupRoot 백업 루트 디렉토리
   * @param retentionDays 보관 일수
   */
  async cleanOldBackups(
    backupRoot: string,
    retentionDays: number,
  ): Promise<void> {
    if (!fs.existsSync(backupRoot)) return;

    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(backupRoot);

    for (const file of files) {
      if (!file.startsWith('HANES_MES_') || !file.endsWith('.zip')) continue;

      const filePath = path.join(backupRoot, file);
      const stat = fs.statSync(filePath);

      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        this.logger.log(`구 백업 삭제: ${file}`);
      }
    }
  }

  // =============================================
  // 유틸리티
  // =============================================

  /**
   * WriteStream의 finish 이벤트를 기다린다.
   * @param stream 대기할 WriteStream
   */
  private waitForStream(stream: fs.WriteStream): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }
}

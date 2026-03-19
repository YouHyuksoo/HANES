/**
 * @file src/modules/scheduler/services/db-backup.service.spec.ts
 * @description DbBackupService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mockDataSource: 모킹된 DataSource
 * - 임시 디렉토리(fs.mkdtempSync)를 사용하여 실제 파일시스템 부작용을 격리한다
 * - 실행: `pnpm test -- -t "DbBackupService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DbBackupService } from './db-backup.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('DbBackupService', () => {
  let target: DbBackupService;
  let mockDataSource: DeepMocked<DataSource>;
  let tmpDir: string;

  beforeEach(async () => {
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbBackupService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<DbBackupService>(DbBackupService);

    // 테스트마다 독립적인 임시 디렉토리 생성
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-backup-test-'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    // 임시 디렉토리 정리
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── formatValue ───
  describe('formatValue', () => {
    it('NULL/undefined 값은 "NULL"을 반환해야 한다', () => {
      expect(target.formatValue(null, 'VARCHAR2')).toBe('NULL');
      expect(target.formatValue(undefined, 'NUMBER')).toBe('NULL');
    });

    it('DATE/TIMESTAMP 타입 - Date 객체는 TO_TIMESTAMP로 포맷해야 한다', () => {
      // Arrange
      const date = new Date('2026-03-20T10:30:00.000Z');

      // Act
      const result = target.formatValue(date, 'DATE');

      // Assert
      expect(result).toContain('TO_TIMESTAMP(');
      expect(result).toContain('2026-03-20 10:30:00.000');
      expect(result).toContain('YYYY-MM-DD HH24:MI:SS.FF');
    });

    it('DATE/TIMESTAMP 타입 - 문자열 값도 TO_TIMESTAMP로 포맷해야 한다', () => {
      // Arrange
      const strDate = '2026-01-15 08:00:00.000';

      // Act
      const result = target.formatValue(strDate, 'TIMESTAMP');

      // Assert
      expect(result).toBe(`TO_TIMESTAMP('${strDate}', 'YYYY-MM-DD HH24:MI:SS.FF')`);
    });

    it('NUMBER 타입은 숫자 문자열 그대로 반환해야 한다', () => {
      expect(target.formatValue(42, 'NUMBER')).toBe('42');
      expect(target.formatValue(3.14, 'FLOAT')).toBe('3.14');
      expect(target.formatValue(0, 'BINARY_DOUBLE')).toBe('0');
    });

    it('CLOB 타입은 TO_CLOB()로 감싸고 작은따옴표를 이스케이프해야 한다', () => {
      // Arrange
      const clobVal = "It's a test";

      // Act
      const result = target.formatValue(clobVal, 'CLOB');

      // Assert
      expect(result).toBe("TO_CLOB('It''s a test')");
    });

    it('NCLOB 타입도 TO_CLOB()로 감싸야 한다', () => {
      expect(target.formatValue('내용', 'NCLOB')).toBe("TO_CLOB('내용')");
    });

    it('BLOB/RAW 타입은 NULL을 반환해야 한다', () => {
      expect(target.formatValue(Buffer.from('data'), 'BLOB')).toBe('NULL');
      expect(target.formatValue('hex', 'RAW')).toBe('NULL');
      expect(target.formatValue('hex', 'LONG RAW')).toBe('NULL');
    });

    it('문자열 타입(VARCHAR2 등)은 작은따옴표로 감싸고 이스케이프해야 한다', () => {
      expect(target.formatValue('hello', 'VARCHAR2')).toBe("'hello'");
      expect(target.formatValue("it's", 'NVARCHAR2')).toBe("'it''s'");
      expect(target.formatValue('ABC', 'CHAR')).toBe("'ABC'");
    });
  });

  // ─── runBackup ───
  describe('runBackup', () => {
    it('올바른 디렉토리 구조를 생성하고 ZIP 파일을 만들어야 한다', async () => {
      // Arrange — DDL 쿼리들은 빈 결과 반환
      mockDataSource.query.mockImplementation(async (sql: string) => {
        // DDL 추출 쿼리 (ALL_OBJECTS)
        if (typeof sql === 'string' && sql.includes('ALL_OBJECTS')) {
          return [];
        }
        // 테이블 목록 쿼리
        if (typeof sql === 'string' && sql.includes('ALL_TABLES')) {
          return [{ TABLE_NAME: 'TEST_TABLE' }];
        }
        // 컬럼 메타데이터 쿼리
        if (typeof sql === 'string' && sql.includes('ALL_TAB_COLUMNS')) {
          return [
            { COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER' },
            { COLUMN_NAME: 'NAME', DATA_TYPE: 'VARCHAR2' },
          ];
        }
        // 데이터 조회 — 1행 반환 후 두번째 호출은 빈 배열
        if (typeof sql === 'string' && sql.includes('OFFSET')) {
          return [{ ID: 1, NAME: 'test' }];
        }
        // FK 제약조건
        if (typeof sql === 'string' && sql.includes('ALL_CONSTRAINTS')) {
          return [{ CONSTRAINT_NAME: 'FK_TEST', TABLE_NAME: 'TEST_TABLE' }];
        }
        return [];
      });

      // 데이터 배치 — 첫 호출은 데이터 반환, 두번째는 빈 배열 (루프 종료)
      let dataCallCount = 0;
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('ALL_OBJECTS')) return [];
        if (typeof sql === 'string' && sql.includes('ALL_TABLES')) {
          return [{ TABLE_NAME: 'TEST_TABLE' }];
        }
        if (typeof sql === 'string' && sql.includes('ALL_TAB_COLUMNS')) {
          return [
            { COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER' },
            { COLUMN_NAME: 'NAME', DATA_TYPE: 'VARCHAR2' },
          ];
        }
        if (typeof sql === 'string' && sql.includes('OFFSET')) {
          dataCallCount++;
          if (dataCallCount === 1) return [{ ID: 1, NAME: 'test' }];
          return [];
        }
        if (typeof sql === 'string' && sql.includes('ALL_CONSTRAINTS')) {
          return [{ CONSTRAINT_NAME: 'FK_TEST', TABLE_NAME: 'TEST_TABLE' }];
        }
        return [];
      });

      const backupDir = path.join(tmpDir, 'backups');

      // Act
      const result = await target.runBackup({
        backupDir,
        retentionDays: 7,
        schema: 'TEST_SCHEMA',
      });

      // Assert
      expect(result.affectedRows).toBe(1);

      // ZIP 파일이 생성되었는지 확인
      const zipFiles = fs.readdirSync(backupDir).filter((f) => f.endsWith('.zip'));
      expect(zipFiles.length).toBe(1);
      expect(zipFiles[0]).toMatch(/^HANES_MES_.*\.zip$/);
    });

    it('빈 테이블만 있을 때도 정상 동작해야 한다', async () => {
      // Arrange
      let dataCallCount = 0;
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('ALL_OBJECTS')) return [];
        if (typeof sql === 'string' && sql.includes('ALL_TABLES')) {
          return [{ TABLE_NAME: 'EMPTY_TABLE' }];
        }
        if (typeof sql === 'string' && sql.includes('ALL_TAB_COLUMNS')) {
          return [{ COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER' }];
        }
        // 데이터 없음 — 빈 테이블
        if (typeof sql === 'string' && sql.includes('OFFSET')) {
          return [];
        }
        if (typeof sql === 'string' && sql.includes('ALL_CONSTRAINTS')) {
          return [];
        }
        return [];
      });

      const backupDir = path.join(tmpDir, 'backups');

      // Act
      const result = await target.runBackup({
        backupDir,
        retentionDays: 7,
        schema: 'TEST_SCHEMA',
      });

      // Assert
      expect(result.affectedRows).toBe(1);

      // ZIP 파일 존재 확인
      const zipFiles = fs.readdirSync(backupDir).filter((f) => f.endsWith('.zip'));
      expect(zipFiles.length).toBe(1);
    });
  });

  // ─── generateRestoreScript ───
  describe('generateRestoreScript', () => {
    it('복원 스크립트에 FK 비활성화/활성화, TRUNCATE, 데이터 로드가 포함되어야 한다', async () => {
      // Arrange
      const backupDir = path.join(tmpDir, 'restore-test');
      fs.mkdirSync(backupDir, { recursive: true });

      mockDataSource.query.mockResolvedValue([
        { CONSTRAINT_NAME: 'FK_ORDER', TABLE_NAME: 'ORDERS' },
        { CONSTRAINT_NAME: 'FK_ITEM', TABLE_NAME: 'ORDER_ITEMS' },
      ]);

      const tableNames = ['PRODUCTS', 'ORDERS', 'ORDER_ITEMS'];

      // Act
      await target.generateRestoreScript('MY_SCHEMA', backupDir, tableNames);

      // Assert
      const content = fs.readFileSync(
        path.join(backupDir, 'restore.sql'),
        'utf8',
      );

      // 헤더 확인
      expect(content).toContain('HANES MES 복원 스크립트');
      expect(content).toContain('MY_SCHEMA');

      // 1단계: FK 비활성화
      expect(content).toContain('DISABLE CONSTRAINT "FK_ORDER"');
      expect(content).toContain('DISABLE CONSTRAINT "FK_ITEM"');

      // 2단계: TRUNCATE (역순 — ORDER_ITEMS → ORDERS → PRODUCTS)
      const truncateSection = content.split('[2단계]')[1].split('[3단계]')[0];
      const truncateLines = truncateSection
        .split('\n')
        .filter((l) => l.startsWith('TRUNCATE'));
      expect(truncateLines).toHaveLength(3);
      expect(truncateLines[0]).toContain('ORDER_ITEMS');
      expect(truncateLines[1]).toContain('ORDERS');
      expect(truncateLines[2]).toContain('PRODUCTS');

      // 3단계: 데이터 로드
      expect(content).toContain('@02_data/PRODUCTS.sql');
      expect(content).toContain('@02_data/ORDERS.sql');
      expect(content).toContain('@02_data/ORDER_ITEMS.sql');

      // 4단계: FK 활성화
      expect(content).toContain('ENABLE CONSTRAINT "FK_ORDER"');
      expect(content).toContain('ENABLE CONSTRAINT "FK_ITEM"');

      // COMMIT
      expect(content).toContain('COMMIT;');
    });
  });

  // ─── dumpTableData ───
  describe('dumpTableData', () => {
    it('데이터가 있는 테이블은 INSERT 구문이 포함된 .sql 파일을 생성해야 한다', async () => {
      // Arrange
      const dataDir = path.join(tmpDir, 'data');
      fs.mkdirSync(dataDir, { recursive: true });

      let offsetCallCount = 0;
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('ALL_TAB_COLUMNS')) {
          return [
            { COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER' },
            { COLUMN_NAME: 'NAME', DATA_TYPE: 'VARCHAR2' },
            { COLUMN_NAME: 'CREATED_AT', DATA_TYPE: 'TIMESTAMP' },
          ];
        }
        if (typeof sql === 'string' && sql.includes('OFFSET')) {
          offsetCallCount++;
          if (offsetCallCount === 1) {
            return [
              { ID: 1, NAME: "it's a test", CREATED_AT: new Date('2026-03-20T00:00:00Z') },
              { ID: 2, NAME: null, CREATED_AT: null },
            ];
          }
          return [];
        }
        return [];
      });

      // Act
      await target.dumpTableData('SCHEMA', 'MY_TABLE', dataDir);

      // Assert
      const filePath = path.join(dataDir, 'MY_TABLE.sql');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');

      // 첫 번째 행 — 작은따옴표 이스케이프 확인
      expect(content).toContain('INSERT INTO "MY_TABLE"');
      expect(content).toContain("'it''s a test'");
      expect(content).toContain('TO_TIMESTAMP(');

      // 두 번째 행 — NULL 값 확인
      expect(content).toContain('2, NULL, NULL');
    });

    it('빈 테이블이면 .sql 파일을 삭제해야 한다', async () => {
      // Arrange
      const dataDir = path.join(tmpDir, 'data-empty');
      fs.mkdirSync(dataDir, { recursive: true });

      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('ALL_TAB_COLUMNS')) {
          return [{ COLUMN_NAME: 'ID', DATA_TYPE: 'NUMBER' }];
        }
        // 데이터 없음
        return [];
      });

      // Act
      await target.dumpTableData('SCHEMA', 'EMPTY_TABLE', dataDir);

      // Assert — 파일이 삭제되었는지 확인
      expect(fs.existsSync(path.join(dataDir, 'EMPTY_TABLE.sql'))).toBe(false);
    });

    it('컬럼 메타데이터가 없으면 아무것도 하지 않아야 한다', async () => {
      // Arrange
      const dataDir = path.join(tmpDir, 'data-nocol');
      fs.mkdirSync(dataDir, { recursive: true });

      mockDataSource.query.mockResolvedValue([]);

      // Act
      await target.dumpTableData('SCHEMA', 'NO_COLUMNS_TABLE', dataDir);

      // Assert
      expect(fs.existsSync(path.join(dataDir, 'NO_COLUMNS_TABLE.sql'))).toBe(false);
    });
  });

  // ─── cleanOldBackups ───
  describe('cleanOldBackups', () => {
    it('보관 기간 초과된 백업 ZIP만 삭제해야 한다', async () => {
      // Arrange
      const backupRoot = path.join(tmpDir, 'clean-test');
      fs.mkdirSync(backupRoot, { recursive: true });

      // 오래된 파일 (8일 전)
      const oldFile = path.join(backupRoot, 'HANES_MES_2026-03-01.zip');
      fs.writeFileSync(oldFile, 'old-backup');
      const oldTime = Date.now() - 8 * 24 * 60 * 60 * 1000;
      fs.utimesSync(oldFile, new Date(oldTime), new Date(oldTime));

      // 최근 파일 (1일 전)
      const recentFile = path.join(backupRoot, 'HANES_MES_2026-03-19.zip');
      fs.writeFileSync(recentFile, 'recent-backup');

      // HANES_MES_ 접두사가 아닌 파일 — 삭제 대상 아님
      const otherFile = path.join(backupRoot, 'other_backup.zip');
      fs.writeFileSync(otherFile, 'other');

      // Act
      await target.cleanOldBackups(backupRoot, 7);

      // Assert
      expect(fs.existsSync(oldFile)).toBe(false); // 삭제됨
      expect(fs.existsSync(recentFile)).toBe(true); // 유지
      expect(fs.existsSync(otherFile)).toBe(true); // 유지 (패턴 불일치)
    });

    it('존재하지 않는 디렉토리에서 호출해도 에러가 발생하지 않아야 한다', async () => {
      // Act & Assert
      await expect(
        target.cleanOldBackups('/non/existent/path', 7),
      ).resolves.not.toThrow();
    });
  });

  // ─── extractDdl ───
  describe('extractDdl', () => {
    it('DDL 결과가 있으면 타입별 .sql 파일을 생성해야 한다', async () => {
      // Arrange
      const ddlDir = path.join(tmpDir, 'ddl');
      fs.mkdirSync(ddlDir, { recursive: true });

      mockDataSource.query.mockImplementation(async (sql: string, params?: unknown[]) => {
        // TABLE DDL만 결과 반환, 나머지는 빈 배열
        if (Array.isArray(params) && params[0] === 'TABLE') {
          return [
            { OBJECT_NAME: 'MY_TABLE', DDL_TEXT: 'CREATE TABLE MY_TABLE (ID NUMBER)' },
          ];
        }
        return [];
      });

      // Act
      await target.extractDdl('TEST', ddlDir);

      // Assert
      const tableFile = path.join(ddlDir, 'TABLE.sql');
      expect(fs.existsSync(tableFile)).toBe(true);

      const content = fs.readFileSync(tableFile, 'utf8');
      expect(content).toContain('-- TABLE: MY_TABLE');
      expect(content).toContain('CREATE TABLE MY_TABLE (ID NUMBER);');
    });

    it('DDL 추출 실패 시 에러를 로그만 남기고 계속 진행해야 한다', async () => {
      // Arrange
      const ddlDir = path.join(tmpDir, 'ddl-fail');
      fs.mkdirSync(ddlDir, { recursive: true });

      mockDataSource.query.mockRejectedValue(new Error('ORA-31603: object not found'));

      // Act & Assert — 에러가 전파되지 않아야 함
      await expect(target.extractDdl('TEST', ddlDir)).resolves.not.toThrow();
    });
  });

  // ─── compressBackup ───
  describe('compressBackup', () => {
    it('소스 디렉토리를 ZIP 파일로 압축해야 한다', async () => {
      // Arrange
      const sourceDir = path.join(tmpDir, 'compress-src');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'test.sql'), 'SELECT 1;');

      const zipPath = path.join(tmpDir, 'output.zip');

      // Act
      await target.compressBackup(sourceDir, zipPath);

      // Assert
      expect(fs.existsSync(zipPath)).toBe(true);
      const stat = fs.statSync(zipPath);
      expect(stat.size).toBeGreaterThan(0);
    });
  });
});

/**
 * @file database/migrate-postgres-to-oracle.ts
 * @description PostgreSQL (Prisma) → Oracle (MYDBPDB) 데이터 마이그레이션 스크립트
 *
 * 사용법:
 * npx ts-node src/database/migrate-postgres-to-oracle.ts
 */

import { PrismaClient } from '@prisma/client';
import * as oracledb from 'oracledb';

// PostgreSQL Prisma 클라이언트
const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

// Oracle 연결 설정
const ORACLE_CONFIG = {
  user: 'HNSMES',
  password: 'your-oracle-password',
  connectString: 'localhost:1521/XEPDB',
};

// 마이그레이션할 테이블 목록 (순서 중요 - FK 의존성 고려)
const TABLE_ORDER = [
  // 마스터 데이터 (의존성 없음)
  { name: 'com_codes', pk: 'id' },
  { name: 'company_masters', pk: 'id' },
  { name: 'department_masters', pk: 'id' },
  { name: 'partner_masters', pk: 'id' },
  { name: 'num_rule_masters', pk: 'id' },
  { name: 'plants', pk: 'id' },
  { name: 'prod_line_masters', pk: 'id' },
  { name: 'process_masters', pk: 'id' },
  { name: 'vendor_masters', pk: 'id' },
  { name: 'worker_masters', pk: 'id' },
  { name: 'part_masters', pk: 'id' },
  { name: 'equip_masters', pk: 'id' },
  { name: 'consumable_masters', pk: 'id' },
  { name: 'label_templates', pk: 'id' },
  { name: 'comm_configs', pk: 'id' },
  
  // BOM (part_masters 의존)
  { name: 'bom_masters', pk: 'id' },
  { name: 'process_maps', pk: 'id' },
  { name: 'work_instructions', pk: 'id' },
  { name: 'iqc_item_masters', pk: 'id' },
  { name: 'equip_inspect_item_masters', pk: 'id' },
  
  // 사용자/권한
  { name: 'users', pk: 'id' },
  { name: 'user_auths', pk: 'id' },
  
  // 창고/LOT
  { name: 'warehouses', pk: 'id' },
  { name: 'lots', pk: 'id' },
  { name: 'mat_lots', pk: 'id' },
  { name: 'stocks', pk: 'id' },
  { name: 'mat_stocks', pk: 'id' },
  
  // 구매/외주
  { name: 'purchase_orders', pk: 'id' },
  { name: 'purchase_order_items', pk: 'id' },
  { name: 'subcon_orders', pk: 'id' },
  { name: 'subcon_deliveries', pk: 'id' },
  { name: 'subcon_receives', pk: 'id' },
  
  // 작업지시/생산
  { name: 'job_orders', pk: 'id' },
  { name: 'prod_results', pk: 'id' },
  { name: 'inspect_results', pk: 'id' },
  { name: 'defect_logs', pk: 'id' },
  { name: 'repair_logs', pk: 'id' },
  
  // 자재/재고
  { name: 'stock_transactions', pk: 'id' },
  { name: 'mat_issues', pk: 'id' },
  { name: 'consumable_logs', pk: 'id' },
  { name: 'inv_adj_logs', pk: 'id' },
  
  // 출하
  { name: 'box_masters', pk: 'id' },
  { name: 'pallet_masters', pk: 'id' },
  { name: 'shipment_logs', pk: 'id' },
  { name: 'shipment_orders', pk: 'id' },
  { name: 'shipment_order_items', pk: 'id' },
  { name: 'shipment_returns', pk: 'id' },
  { name: 'shipment_return_items', pk: 'id' },
  { name: 'customer_orders', pk: 'id' },
  { name: 'customer_order_items', pk: 'id' },
  
  // 추적/인터페이스
  { name: 'trace_logs', pk: 'id' },
  { name: 'inter_logs', pk: 'id' },
  
  // 보세
  { name: 'customs_entries', pk: 'id' },
  { name: 'customs_lots', pk: 'id' },
  { name: 'customs_usage_reports', pk: 'id' },
  
  // 설비점검
  { name: 'equip_inspect_logs', pk: 'id' },
  { name: 'warehouse_transfer_rules', pk: 'id' },
];

const BATCH_SIZE = 500;

class PostgresToOracleMigrator {
  private oracleConn: oracledb.Connection | null = null;
  private stats: Map<string, { source: number; target: number; errors: number }> = new Map();

  async initialize() {
    console.log('🔌 Connecting to databases...\n');

    // PostgreSQL 연결 확인
    await prisma.$connect();
    console.log('✅ PostgreSQL connected');

    // Oracle 연결
    this.oracleConn = await oracledb.getConnection(ORACLE_CONFIG);
    console.log('✅ Oracle MYDBPDB connected\n');
  }

  async migrateTable(tableInfo: { name: string; pk: string }): Promise<void> {
    const { name: tableName, pk } = tableInfo;
    console.log(`\n📦 Migrating: ${tableName}`);
    console.log('-'.repeat(60));

    const startTime = Date.now();
    let migratedCount = 0;
    let errorCount = 0;

    try {
      // PostgreSQL에서 데이터 조회
      const sourceData = await prisma.$queryRawUnsafe(`
        SELECT * FROM "${tableName}" 
        ORDER BY "${pk}" ASC
      `);

      const sourceRows = sourceData as any[];
      console.log(`   Source records: ${sourceRows.length}`);

      if (sourceRows.length === 0) {
        console.log(`   ⏭️  No data to migrate`);
        this.stats.set(tableName, { source: 0, target: 0, errors: 0 });
        return;
      }

      // Oracle 테이블 컬럼 정보 조회
      const columnInfo = await this.getOracleColumns(tableName);
      if (columnInfo.length === 0) {
        console.log(`   ❌ Table ${tableName} does not exist in Oracle`);
        this.stats.set(tableName, { source: sourceRows.length, target: 0, errors: sourceRows.length });
        return;
      }

      // 컬럼명 매핑 (snake_case → UPPER_CASE)
      const oracleColumns = columnInfo.map(col => col.name);

      // 배치 처리
      for (let i = 0; i < sourceRows.length; i += BATCH_SIZE) {
        const batch = sourceRows.slice(i, i + BATCH_SIZE);
        
        try {
          await this.insertBatch(tableName, batch, oracleColumns);
          migratedCount += batch.length;
          process.stdout.write(`   Progress: ${migratedCount}/${sourceRows.length}\r`);
        } catch (error: any) {
          console.error(`\n   ❌ Batch error: ${error.message}`);
          
          // 개별 행 재시도
          for (const row of batch) {
            try {
              await this.insertBatch(tableName, [row], oracleColumns);
              migratedCount++;
            } catch (innerError) {
              errorCount++;
            }
          }
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n   ✅ Completed: ${migratedCount} rows in ${duration}s`);
      
      this.stats.set(tableName, {
        source: sourceRows.length,
        target: migratedCount,
        errors: errorCount,
      });

    } catch (error: any) {
      console.error(`   ❌ Migration failed: ${error.message}`);
      this.stats.set(tableName, { source: 0, target: 0, errors: 1 });
    }
  }

  private async getOracleColumns(tableName: string): Promise<{ name: string; type: string }[]> {
    if (!this.oracleConn) return [];

    const upperTableName = tableName.toUpperCase();
    const result = await this.oracleConn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE 
       FROM USER_TAB_COLUMNS 
       WHERE TABLE_NAME = :tableName`,
      [upperTableName]
    );

    return (result.rows || []).map((row: any) => ({
      name: row[0],
      type: row[1],
    }));
  }

  private async insertBatch(
    tableName: string, 
    rows: any[], 
    oracleColumns: string[]
  ): Promise<void> {
    if (rows.length === 0 || !this.oracleConn) return;

    const upperTableName = tableName.toUpperCase();
    
    // 동적 INSERT 쿼리 생성
    const placeholders = oracleColumns.map((_, i) => `:${i + 1}`).join(', ');
    const sql = `INSERT INTO ${upperTableName} (${oracleColumns.join(', ')}) VALUES (${placeholders})`;

    // 각 행 삽입
    for (const row of rows) {
      const values = oracleColumns.map((col) => {
        // PostgreSQL 컬럼명으로 변환 (UPPER_CASE → snake_case)
        const pgCol = col.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        const value = row[pgCol] ?? row[col.toLowerCase()] ?? null;
        
        // 값 변환
        if (value instanceof Date) {
          return value;
        } else if (typeof value === 'object' && value !== null) {
          // JSON → 문자열
          return JSON.stringify(value);
        } else if (typeof value === 'boolean') {
          // boolean → number
          return value ? 1 : 0;
        }
        return value;
      });

      await this.oracleConn.execute(sql, values, { autoCommit: true });
    }
  }

  async migrateAll(): Promise<void> {
    console.log('\n🚀 Starting PostgreSQL → Oracle migration...\n');
    console.log('=' .repeat(60));

    const totalStartTime = Date.now();

    for (const tableInfo of TABLE_ORDER) {
      await this.migrateTable(tableInfo);
    }

    const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(2);

    this.printStats(totalDuration);
  }

  private printStats(duration: string): void {
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 Migration Statistics');
    console.log('='.repeat(60));
    console.log(`\nTotal Duration: ${duration}s\n`);
    
    console.log('Table Name                 | Source | Target | Errors | Status');
    console.log('-'.repeat(70));
    
    let totalSource = 0;
    let totalTarget = 0;
    let totalErrors = 0;

    for (const [tableName, stat] of this.stats) {
      totalSource += stat.source;
      totalTarget += stat.target;
      totalErrors += stat.errors;
      
      const status = stat.errors === 0 && stat.source === stat.target ? 'OK' : 
                    stat.errors > 0 ? 'WARN' : 'SKIP';
      
      console.log(
        `${tableName.padEnd(26)} | ${String(stat.source).padStart(6)} | ${String(stat.target).padStart(6)} | ${String(stat.errors).padStart(6)} | ${status}`
      );
    }
    
    console.log('-'.repeat(70));
    console.log(
      `${'TOTAL'.padEnd(26)} | ${String(totalSource).padStart(6)} | ${String(totalTarget).padStart(6)} | ${String(totalErrors).padStart(6)} |`
    );
    console.log('\n' + '='.repeat(60));
    console.log(totalErrors === 0 ? '✅ Migration completed successfully!' : `⚠️ Migration completed with ${totalErrors} errors`);
    console.log('='.repeat(60) + '\n');
  }

  async close(): Promise<void> {
    await prisma.$disconnect();
    if (this.oracleConn) {
      await this.oracleConn.close();
    }
    console.log('🔌 Connections closed');
  }
}

// 메인 실행
async function main() {
  const migrator = new PostgresToOracleMigrator();

  try {
    await migrator.initialize();
    await migrator.migrateAll();
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await migrator.close();
  }
}

// 직접 실행
if (require.main === module) {
  main();
}

export { PostgresToOracleMigrator };

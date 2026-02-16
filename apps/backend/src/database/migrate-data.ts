/**
 * @file database/migrate-data.ts
 * @description PostgreSQL → Oracle 데이터 마이그레이션 스크립트
 *
 * 사용법:
 * npx ts-node src/database/migrate-data.ts
 */

import { DataSource } from 'typeorm';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// 병렬 처리 설정
const BATCH_SIZE = 1000;
const CONCURRENCY = 5;

interface MigrationConfig {
  source: DataSource; // PostgreSQL (Prisma)
  target: DataSource; // Oracle (TypeORM)
}

// 마이그레이션할 테이블 목록 (순서 중요 - FK 의존성 고려)
const TABLE_ORDER = [
  // 마스터 데이터 (의존성 없음)
  'com_codes',
  'company_masters',
  'department_masters',
  'partner_masters',
  'num_rule_masters',
  'plants',
  'prod_line_masters',
  'process_masters',
  'vendor_masters',
  'worker_masters',
  'part_masters',
  'equip_masters',
  'consumable_masters',
  'label_templates',
  'comm_configs',
  
  // BOM (part_masters 의존)
  'bom_masters',
  'process_maps',
  'work_instructions',
  'iqc_item_masters',
  'equip_inspect_item_masters',
  
  // 사용자/권한
  'users',
  'user_auths',
  
  // 창고/LOT
  'warehouses',
  'lots',
  'mat_lots',
  'stocks',
  'mat_stocks',
  
  // 구매/외주
  'purchase_orders',
  'purchase_order_items',
  'subcon_orders',
  'subcon_deliveries',
  'subcon_receives',
  
  // 작업지시/생산
  'job_orders',
  'prod_results',
  'inspect_results',
  'defect_logs',
  'repair_logs',
  
  // 자재/재고
  'stock_transactions',
  'mat_issues',
  'consumable_logs',
  'inv_adj_logs',
  
  // 출하
  'box_masters',
  'pallet_masters',
  'shipment_logs',
  'shipment_orders',
  'shipment_order_items',
  'shipment_returns',
  'shipment_return_items',
  'customer_orders',
  'customer_order_items',
  
  // 추적/인터페이스
  'trace_logs',
  'inter_logs',
  
  // 보세
  'customs_entries',
  'customs_lots',
  'customs_usage_reports',
  
  // 설비점검
  'equip_inspect_logs',
  'warehouse_transfer_rules',
];

class DataMigrator {
  private prisma: PrismaClient;
  private oracleDataSource: DataSource;
  private stats: Map<string, { source: number; target: number; errors: number }> = new Map();

  constructor() {
    this.prisma = new PrismaClient({
      log: ['warn', 'error'],
    });
  }

  async initialize() {
    console.log('🔌 Initializing database connections...\n');

    // Oracle 연결
    this.oracleDataSource = new DataSource({
      type: 'oracle',
      host: process.env.ORACLE_HOST || 'localhost',
      port: parseInt(process.env.ORACLE_PORT || '1521', 10),
      username: process.env.ORACLE_USER || 'MES_USER',
      password: process.env.ORACLE_PASSWORD || '',
      sid: process.env.ORACLE_SID || 'ORCL',
      synchronize: false,
      logging: false,
      entities: [],
    });

    await this.oracleDataSource.initialize();
    console.log('✅ Oracle connection established');

    // PostgreSQL 연결 테스트
    await this.prisma.$connect();
    console.log('✅ PostgreSQL connection established\n');
  }

  async migrateTable(tableName: string): Promise<void> {
    console.log(`\n📦 Migrating table: ${tableName}`);
    console.log('-'.repeat(50));

    const startTime = Date.now();
    let migratedCount = 0;
    let errorCount = 0;

    try {
      // PostgreSQL에서 데이터 조회
      const sourceData = await this.prisma.$queryRawUnsafe(`
        SELECT * FROM "${tableName}" 
        WHERE "deleted_at" IS NULL 
        ORDER BY "created_at" ASC
      `);

      const sourceRows = sourceData as any[];
      console.log(`   Source records: ${sourceRows.length}`);

      if (sourceRows.length === 0) {
        console.log(`   ⏭️  Skipping (no data)`);
        this.stats.set(tableName, { source: 0, target: 0, errors: 0 });
        return;
      }

      // 컬럼명 매핑 (snake_case → UPPER_CASE)
      const mappedRows = sourceRows.map((row) => this.mapColumns(row));

      // 배치 처리
      for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
        const batch = mappedRows.slice(i, i + BATCH_SIZE);
        
        try {
          await this.insertBatch(tableName, batch);
          migratedCount += batch.length;
          process.stdout.write(`   Progress: ${migratedCount}/${sourceRows.length}\r`);
        } catch (error: any) {
          console.error(`\n   ❌ Batch error: ${error.message}`);
          errorCount += batch.length;
          
          // 개별 행 재시도
          for (const row of batch) {
            try {
              await this.insertBatch(tableName, [row]);
              migratedCount++;
              errorCount--;
            } catch (innerError) {
              // 개별 오류는 무시하고 계속
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

  private mapColumns(row: any): any {
    const mapped: any = {};
    
    for (const [key, value] of Object.entries(row)) {
      // snake_case → UPPER_CASE 변환
      const upperKey = key.toUpperCase();
      
      // 값 변환
      if (value instanceof Date) {
        mapped[upperKey] = value;
      } else if (typeof value === 'object' && value !== null) {
        // JSON → 문자열 (CLOB)
        mapped[upperKey] = JSON.stringify(value);
      } else {
        mapped[upperKey] = value;
      }
    }
    
    return mapped;
  }

  private async insertBatch(tableName: string, rows: any[]): Promise<void> {
    if (rows.length === 0) return;

    const upperTableName = tableName.toUpperCase();
    const columns = Object.keys(rows[0]);
    
    // 동적 INSERT 쿼리 생성
    const placeholders = columns.map((_, i) => `:${i + 1}`).join(', ');
    const sql = `INSERT INTO ${upperTableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    // 배치 실행
    for (const row of rows) {
      const values = columns.map((col) => row[col]);
      await this.oracleDataSource.query(sql, values);
    }
  }

  async migrateAll(): Promise<void> {
    console.log('\n🚀 Starting data migration...\n');
    console.log('=' .repeat(60));

    const totalStartTime = Date.now();

    for (const tableName of TABLE_ORDER) {
      await this.migrateTable(tableName);
    }

    const totalDuration = ((Date.now() - totalStartTime) / 1000).toFixed(2);

    // 통계 출력
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
      
      const status = stat.errors === 0 && stat.source === stat.target ? '✅' : 
                    stat.errors > 0 ? '⚠️' : '⏭️';
      
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
    await this.prisma.$disconnect();
    if (this.oracleDataSource.isInitialized) {
      await this.oracleDataSource.destroy();
    }
    console.log('🔌 Connections closed');
  }
}

// 메인 실행
async function main() {
  const migrator = new DataMigrator();

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

export { DataMigrator };

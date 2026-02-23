/**
 * @file src/seeds/seed-roles.ts
 * @description 기본 역할(Role) 4개 + 역할별 메뉴 권한 매핑 시드 스크립트
 *
 * 초보자 가이드:
 * 1. **목적**: ADMIN, MANAGER, OPERATOR, VIEWER 4개 기본 역할과
 *    각 역할이 접근 가능한 메뉴 권한을 ROLES / ROLE_MENU_PERMISSIONS 테이블에 삽입
 * 2. **UPSERT 방식**: code 기준으로 이미 존재하면 건너뛰어 기존 데이터를 보존
 * 3. **ADMIN**: 별도 권한 행 없음 (코드에서 전체 허용 처리)
 * 4. **MANAGER**: SYSTEM/SYS_* 제외 전체 메뉴
 * 5. **OPERATOR**: DASHBOARD + PRODUCTION/QUALITY/EQUIPMENT/INSPECTION 하위 전체
 * 6. **VIEWER**: DASHBOARD만
 *
 * 실행 방법:
 *   cd apps/backend
 *   npx ts-node src/seeds/seed-roles.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// 환경 변수 로드 (.env.local 우선)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// ---------------------------------------------------------------------------
// 메뉴 코드 하드코딩 (프론트엔드 menuConfig.ts 기준 — 백엔드에서 직접 import 불가)
// ---------------------------------------------------------------------------

/** 최상위 메뉴 코드 (부모) */
const TOP_MENU_CODES = [
  'DASHBOARD',
  'MONITORING',
  'MASTER',
  'INVENTORY',
  'PRODUCT_INVENTORY',
  'MATERIAL',
  'PURCHASING',
  'PRODUCTION',
  'INSPECTION',
  'QUALITY',
  'EQUIPMENT',
  'SHIPPING',
  'CUSTOMS',
  'CONSUMABLES',
  'OUTSOURCING',
  'INTERFACE',
  'SYSTEM',
] as const;

/** 하위 메뉴 코드 (부모 그룹별) */
const CHILD_MENU_CODES: Record<string, string[]> = {
  MONITORING: ['MON_EQUIP_STATUS'],
  MASTER: [
    'MST_PART', 'MST_BOM', 'MST_PARTNER', 'MST_PROD_LINE',
    'MST_WORKER', 'MST_WORK_INST', 'MST_WAREHOUSE', 'MST_LABEL',
    'MST_VENDOR_BARCODE',
  ],
  INVENTORY: [
    'INV_MAT_STOCK', 'INV_TRANSACTION', 'INV_LOT',
    'INV_MAT_PHYSICAL_INV', 'INV_MAT_PHYSICAL_INV_HISTORY',
    'INV_ARRIVAL_STOCK',
  ],
  PRODUCT_INVENTORY: [
    'INV_PRODUCT_STOCK', 'INV_PRODUCT_PHYSICAL_INV',
    'INV_PRODUCT_PHYSICAL_INV_HISTORY',
  ],
  MATERIAL: [
    'MAT_ARRIVAL', 'MAT_RECEIVE_LABEL', 'MAT_RECEIVE',
    'MAT_REQUEST', 'MAT_ISSUE', 'MAT_LOT', 'MAT_LOT_SPLIT',
    'MAT_LOT_MERGE', 'MAT_SHELF_LIFE', 'MAT_HOLD', 'MAT_SCRAP',
    'MAT_ADJUSTMENT', 'MAT_MISC_RECEIPT', 'MAT_RECEIPT_CANCEL',
  ],
  PURCHASING: ['PUR_PO', 'PUR_PO_STATUS'],
  PRODUCTION: [
    'PROD_ORDER', 'PROD_RESULT', 'PROD_PROGRESS',
    'PROD_INPUT_MANUAL', 'PROD_INPUT_MACHINE', 'PROD_INPUT_INSPECT',
    'PROD_INPUT_EQUIP', 'PROD_SAMPLE_INSPECT', 'PROD_RESULT_SUMMARY',
    'PROD_PACK_RESULT', 'PROD_WIP_STOCK',
  ],
  INSPECTION: ['INSP_RESULT', 'INSP_EQUIP'],
  QUALITY: [
    'QC_IQC', 'QC_IQC_HISTORY', 'QC_DEFECT', 'QC_INSPECT',
    'QC_TRACE', 'QC_IQC_ITEM', 'QC_OQC', 'QC_OQC_HISTORY',
  ],
  EQUIPMENT: [
    'EQUIP_MASTER', 'EQUIP_PM_PLAN', 'EQUIP_PM', 'EQUIP_PM_CALENDAR',
    'EQUIP_INSPECT_CALENDAR', 'EQUIP_PERIODIC_CALENDAR',
    'EQUIP_DAILY', 'EQUIP_PERIODIC', 'EQUIP_HISTORY',
    'EQUIP_MOLD', 'EQUIP_INSPECT_ITEM',
  ],
  SHIPPING: [
    'SHIP_PACK', 'SHIP_PALLET', 'SHIP_CONFIRM', 'SHIP_ORDER',
    'SHIP_HISTORY', 'SHIP_RETURN', 'SHIP_CUST_PO', 'SHIP_CUST_PO_STATUS',
  ],
  CUSTOMS: ['CUST_ENTRY', 'CUST_STOCK', 'CUST_USAGE'],
  CONSUMABLES: [
    'CONS_MASTER', 'CONS_RECEIVING', 'CONS_ISSUING',
    'CONS_STOCK', 'CONS_LIFE',
  ],
  OUTSOURCING: ['OUT_VENDOR', 'OUT_ORDER', 'OUT_RECEIVE'],
  INTERFACE: ['IF_DASHBOARD', 'IF_LOG', 'IF_MANUAL'],
  SYSTEM: [
    'SYS_COMPANY', 'SYS_DEPT', 'SYS_USER', 'SYS_ROLE',
    'SYS_COMM', 'SYS_CONFIG', 'SYS_CODE',
  ],
};

// ---------------------------------------------------------------------------
// 역할 정의
// ---------------------------------------------------------------------------

interface RoleSeed {
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  sortOrder: number;
}

const ROLE_SEEDS: RoleSeed[] = [
  { code: 'ADMIN',    name: '관리자',    description: '전체 시스템 관리 권한',       isSystem: true, sortOrder: 1 },
  { code: 'MANAGER',  name: '관리자급',  description: '대부분의 메뉴 접근 가능',     isSystem: true, sortOrder: 2 },
  { code: 'OPERATOR', name: '작업자',    description: '생산/작업 관련 메뉴만 접근',  isSystem: true, sortOrder: 3 },
  { code: 'VIEWER',   name: '조회자',    description: '조회만 가능',                 isSystem: true, sortOrder: 4 },
];

// ---------------------------------------------------------------------------
// 역할별 허용 메뉴 코드 생성
// ---------------------------------------------------------------------------

/**
 * 특정 부모 그룹에 속한 모든 메뉴 코드(부모 + 하위)를 반환
 */
function getGroupCodes(parentCode: string): string[] {
  const children = CHILD_MENU_CODES[parentCode] ?? [];
  return [parentCode, ...children];
}

/**
 * 모든 메뉴 코드를 플랫하게 반환 (최상위 + 하위)
 */
function getAllMenuCodes(): string[] {
  const codes: string[] = [];
  for (const top of TOP_MENU_CODES) {
    codes.push(top);
    const children = CHILD_MENU_CODES[top];
    if (children) {
      codes.push(...children);
    }
  }
  return codes;
}

/**
 * MANAGER 허용 메뉴: SYSTEM, SYS_* 제외 전체
 */
function getManagerMenuCodes(): string[] {
  return getAllMenuCodes().filter(
    (code) => code !== 'SYSTEM' && !code.startsWith('SYS_'),
  );
}

/**
 * OPERATOR 허용 메뉴:
 * - DASHBOARD
 * - PRODUCTION 하위 전체 (PROD_*)
 * - QUALITY 하위 전체 (QC_*)
 * - EQUIPMENT 하위 전체 (EQUIP_*)
 * - INSPECTION 하위 전체 (INSP_*)
 */
function getOperatorMenuCodes(): string[] {
  return [
    ...getGroupCodes('DASHBOARD'),
    ...getGroupCodes('PRODUCTION'),
    ...getGroupCodes('QUALITY'),
    ...getGroupCodes('EQUIPMENT'),
    ...getGroupCodes('INSPECTION'),
  ];
}

/**
 * VIEWER 허용 메뉴: DASHBOARD만
 */
function getViewerMenuCodes(): string[] {
  return ['DASHBOARD'];
}

// ---------------------------------------------------------------------------
// 메인 시드 실행
// ---------------------------------------------------------------------------

async function seedRoles(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  HARNESS MES - Role & Menu Permission Seed');
  console.log('='.repeat(60));
  console.log();

  // Oracle DataSource 생성 (기존 data-source.ts 패턴 참조)
  const dataSource = new DataSource({
    type: 'oracle',
    host: process.env.ORACLE_HOST || 'localhost',
    port: parseInt(process.env.ORACLE_PORT || '1521', 10),
    username: process.env.ORACLE_USER || 'HNSMES',
    password: process.env.ORACLE_PASSWORD || '',
    ...(process.env.ORACLE_SID
      ? { sid: process.env.ORACLE_SID }
      : { serviceName: process.env.ORACLE_SERVICE_NAME || 'JSHNSMES' }),
    synchronize: false,
    logging: false,
    entities: [],
  });

  try {
    console.log('  Connecting to Oracle...');
    await dataSource.initialize();
    console.log('  Connected successfully.\n');

    // ------------------------------------------------------------------
    // 1) 역할(Role) UPSERT
    // ------------------------------------------------------------------
    console.log('[1/2] Seeding roles...');
    const roleIdMap: Record<string, number> = {};

    for (const role of ROLE_SEEDS) {
      // code 기준 존재 여부 확인
      const existing = await dataSource.query(
        `SELECT "ID" FROM "ROLES" WHERE "CODE" = :1 AND "DELETED_AT" IS NULL`,
        [role.code],
      );

      if (existing.length > 0) {
        roleIdMap[role.code] = Number(existing[0].ID);
        console.log(`  [SKIP] ${role.code} - already exists (id: ${existing[0].ID})`);
      } else {
        // 새 역할 삽입 (시퀀스 사용)
        await dataSource.query(
          `INSERT INTO "ROLES" ("ID", "CODE", "NAME", "DESCRIPTION", "IS_SYSTEM", "SORT_ORDER", "CREATED_BY", "UPDATED_BY", "CREATED_AT", "UPDATED_AT")
           VALUES (SEQ_ROLES.NEXTVAL, :1, :2, :3, :4, :5, 'SEED', 'SEED', SYSTIMESTAMP, SYSTIMESTAMP)`,
          [role.code, role.name, role.description, role.isSystem ? 'Y' : 'N', role.sortOrder],
        );

        // 삽입 후 ID 조회
        const inserted = await dataSource.query(
          `SELECT "ID" FROM "ROLES" WHERE "CODE" = :1 AND "DELETED_AT" IS NULL`,
          [role.code],
        );
        roleIdMap[role.code] = Number(inserted[0].ID);
        console.log(`  [INSERT] ${role.code} (id: ${inserted[0].ID})`);
      }
    }

    console.log();

    // ------------------------------------------------------------------
    // 2) 역할-메뉴 권한 매핑 (ADMIN은 생략 — 코드에서 전체 허용)
    // ------------------------------------------------------------------
    console.log('[2/2] Seeding role-menu permissions...');

    const permissionMap: Record<string, string[]> = {
      MANAGER: getManagerMenuCodes(),
      OPERATOR: getOperatorMenuCodes(),
      VIEWER: getViewerMenuCodes(),
    };

    let insertedCount = 0;
    let skippedCount = 0;

    for (const [roleCode, menuCodes] of Object.entries(permissionMap)) {
      const roleId = roleIdMap[roleCode];
      if (!roleId) {
        console.log(`  [WARN] Role ${roleCode} not found, skipping permissions.`);
        continue;
      }

      console.log(`  ${roleCode} (${menuCodes.length} menus):`);

      for (const menuCode of menuCodes) {
        // 중복 확인 (roleId + menuCode)
        const existing = await dataSource.query(
          `SELECT "ID" FROM "ROLE_MENU_PERMISSIONS" WHERE "ROLE_ID" = :1 AND "MENU_CODE" = :2`,
          [roleId, menuCode],
        );

        if (existing.length > 0) {
          skippedCount++;
        } else {
          await dataSource.query(
            `INSERT INTO "ROLE_MENU_PERMISSIONS" ("ID", "ROLE_ID", "MENU_CODE", "CAN_ACCESS", "CREATED_AT", "UPDATED_AT")
             VALUES (SEQ_ROLE_MENU_PERMS.NEXTVAL, :1, :2, 'Y', SYSTIMESTAMP, SYSTIMESTAMP)`,
            [roleId, menuCode],
          );
          insertedCount++;
        }
      }
    }

    console.log();
    console.log('-'.repeat(60));
    console.log(`  Permissions inserted: ${insertedCount}`);
    console.log(`  Permissions skipped:  ${skippedCount}`);
    console.log('-'.repeat(60));
    console.log();
    console.log('  Seed completed successfully!');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n  Seed failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('  Connection closed.');
    }
  }
}

// 직접 실행
if (require.main === module) {
  seedRoles();
}

export { seedRoles };

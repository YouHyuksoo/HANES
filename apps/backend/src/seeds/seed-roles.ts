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
// 메뉴 코드 설정 (외부 JSON 파일 기반)
// ---------------------------------------------------------------------------
import * as menuConfig from './menu-config.json';

/** 최상위 메뉴 코드 (부모) */
const TOP_MENU_CODES: string[] = menuConfig.topMenuCodes;

/** 하위 메뉴 코드 (부모 그룹별) */
const CHILD_MENU_CODES: Record<string, string[]> = menuConfig.childMenuCodes;

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

const seedCompany = process.env.SEED_COMPANY || process.env.DEFAULT_COMPANY || 'HANES';
const seedPlant = process.env.SEED_PLANT || process.env.DEFAULT_PLANT || 'P01';

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
    // 1) 역할(Role) UPSERT — COMPANY + PLANT_CD + CODE 가 PK (자연키)
    // ------------------------------------------------------------------
    console.log('[1/2] Seeding roles...');

    for (const role of ROLE_SEEDS) {
      const existing = await dataSource.query(
        `SELECT "CODE" FROM "ROLES" WHERE "COMPANY" = :1 AND "PLANT_CD" = :2 AND "CODE" = :3`,
        [seedCompany, seedPlant, role.code],
      );

      if (existing.length > 0) {
        console.log(`  [SKIP] ${role.code} - already exists`);
      } else {
        await dataSource.query(
          `INSERT INTO "ROLES" ("COMPANY", "PLANT_CD", "CODE", "NAME", "DESCRIPTION", "IS_SYSTEM", "SORT_ORDER", "CREATED_BY", "UPDATED_BY", "CREATED_AT", "UPDATED_AT")
           VALUES (:1, :2, :3, :4, :5, :6, :7, 'SEED', 'SEED', SYSTIMESTAMP, SYSTIMESTAMP)`,
          [seedCompany, seedPlant, role.code, role.name, role.description, role.isSystem ? 'Y' : 'N', role.sortOrder],
        );
        console.log(`  [INSERT] ${role.code}`);
      }
    }

    console.log();

    // ------------------------------------------------------------------
    // 2) 역할-메뉴 권한 매핑 (ADMIN은 생략 — 코드에서 전체 허용)
    //    (COMPANY, PLANT_CD, ROLE_CODE, MENU_CODE) 복합 PK
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
      console.log(`  ${roleCode} (${menuCodes.length} menus):`);

      for (const menuCode of menuCodes) {
        const existing = await dataSource.query(
          `SELECT "ROLE_CODE" FROM "ROLE_MENU_PERMISSIONS" WHERE "COMPANY" = :1 AND "PLANT_CD" = :2 AND "ROLE_CODE" = :3 AND "MENU_CODE" = :4`,
          [seedCompany, seedPlant, roleCode, menuCode],
        );

        if (existing.length > 0) {
          skippedCount++;
        } else {
          await dataSource.query(
            `INSERT INTO "ROLE_MENU_PERMISSIONS" ("COMPANY", "PLANT_CD", "ROLE_CODE", "MENU_CODE", "CAN_ACCESS", "CREATED_AT", "UPDATED_AT")
             VALUES (:1, :2, :3, :4, 'Y', SYSTIMESTAMP, SYSTIMESTAMP)`,
            [seedCompany, seedPlant, roleCode, menuCode],
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

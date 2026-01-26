/**
 * @file apps/backend/prisma/seed.ts
 * @description 데이터베이스 초기 시드 데이터
 *
 * 초보자 가이드:
 * 1. **공통코드**: 시스템 전반에서 사용하는 코드성 데이터
 * 2. **사용자**: 테스트용 관리자/운영자 계정
 * 3. **실행 방법**: pnpm db:seed 또는 npx prisma db seed
 *
 * 주의사항:
 * - 운영 환경에서는 실행하지 마세요
 * - 기존 데이터와 중복될 수 있으니 확인 후 실행하세요
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 공통코드 시드 데이터
 */
const comCodeSeeds = [
  // 상태 코드 그룹
  {
    group_code: 'STATUS',
    detail_code: 'WAITING',
    code_name: '대기',
    code_desc: '작업 대기 상태',
    sort_order: 1,
  },
  {
    group_code: 'STATUS',
    detail_code: 'RUNNING',
    code_name: '진행중',
    code_desc: '작업 진행 상태',
    sort_order: 2,
  },
  {
    group_code: 'STATUS',
    detail_code: 'COMPLETED',
    code_name: '완료',
    code_desc: '작업 완료 상태',
    sort_order: 3,
  },
  {
    group_code: 'STATUS',
    detail_code: 'STOPPED',
    code_name: '중단',
    code_desc: '작업 중단 상태',
    sort_order: 4,
  },

  // 사용자 역할 그룹
  {
    group_code: 'ROLE',
    detail_code: 'ADMIN',
    code_name: '관리자',
    code_desc: '시스템 관리자',
    sort_order: 1,
  },
  {
    group_code: 'ROLE',
    detail_code: 'MANAGER',
    code_name: '매니저',
    code_desc: '현장 관리자',
    sort_order: 2,
  },
  {
    group_code: 'ROLE',
    detail_code: 'OPERATOR',
    code_name: '작업자',
    code_desc: '현장 작업자',
    sort_order: 3,
  },
  {
    group_code: 'ROLE',
    detail_code: 'VIEWER',
    code_name: '조회자',
    code_desc: '조회만 가능',
    sort_order: 4,
  },

  // 설비 유형 그룹
  {
    group_code: 'EQUIP_TYPE',
    detail_code: 'CUTTING',
    code_name: '절단기',
    code_desc: '전선 절단 설비',
    sort_order: 1,
  },
  {
    group_code: 'EQUIP_TYPE',
    detail_code: 'STRIPPING',
    code_name: '탈피기',
    code_desc: '피복 탈피 설비',
    sort_order: 2,
  },
  {
    group_code: 'EQUIP_TYPE',
    detail_code: 'CRIMPING',
    code_name: '압착기',
    code_desc: '터미널 압착 설비',
    sort_order: 3,
  },
  {
    group_code: 'EQUIP_TYPE',
    detail_code: 'ASSEMBLY',
    code_name: '조립대',
    code_desc: '수작업 조립 설비',
    sort_order: 4,
  },
  {
    group_code: 'EQUIP_TYPE',
    detail_code: 'INSPECTION',
    code_name: '검사기',
    code_desc: '품질 검사 설비',
    sort_order: 5,
  },

  // 자재 유형 그룹
  {
    group_code: 'PART_TYPE',
    detail_code: 'WIRE',
    code_name: '전선',
    code_desc: '전선류 자재',
    sort_order: 1,
  },
  {
    group_code: 'PART_TYPE',
    detail_code: 'TERMINAL',
    code_name: '터미널',
    code_desc: '터미널 자재',
    sort_order: 2,
  },
  {
    group_code: 'PART_TYPE',
    detail_code: 'CONNECTOR',
    code_name: '커넥터',
    code_desc: '커넥터 자재',
    sort_order: 3,
  },
  {
    group_code: 'PART_TYPE',
    detail_code: 'TUBE',
    code_name: '튜브',
    code_desc: '수축튜브/코르게이트',
    sort_order: 4,
  },
  {
    group_code: 'PART_TYPE',
    detail_code: 'TAPE',
    code_name: '테이프',
    code_desc: '테이핑 자재',
    sort_order: 5,
  },

  // 불량 유형 그룹
  {
    group_code: 'DEFECT_TYPE',
    detail_code: 'CUT_LENGTH',
    code_name: '절단길이불량',
    code_desc: '절단 길이 규격 미달/초과',
    sort_order: 1,
  },
  {
    group_code: 'DEFECT_TYPE',
    detail_code: 'STRIP_DAMAGE',
    code_name: '탈피손상',
    code_desc: '심선 손상, 피복 손상',
    sort_order: 2,
  },
  {
    group_code: 'DEFECT_TYPE',
    detail_code: 'CRIMP_HEIGHT',
    code_name: '압착높이불량',
    code_desc: '압착 높이 규격 미달/초과',
    sort_order: 3,
  },
  {
    group_code: 'DEFECT_TYPE',
    detail_code: 'CRIMP_PULL',
    code_name: '인장력불량',
    code_desc: '인장 강도 미달',
    sort_order: 4,
  },
  {
    group_code: 'DEFECT_TYPE',
    detail_code: 'APPEARANCE',
    code_name: '외관불량',
    code_desc: '육안 검사 불량',
    sort_order: 5,
  },

  // 단위 그룹
  {
    group_code: 'UNIT',
    detail_code: 'EA',
    code_name: '개',
    code_desc: '개수 단위',
    sort_order: 1,
  },
  {
    group_code: 'UNIT',
    detail_code: 'M',
    code_name: '미터',
    code_desc: '길이 단위',
    sort_order: 2,
  },
  {
    group_code: 'UNIT',
    detail_code: 'MM',
    code_name: '밀리미터',
    code_desc: '길이 단위',
    sort_order: 3,
  },
  {
    group_code: 'UNIT',
    detail_code: 'KG',
    code_name: '킬로그램',
    code_desc: '무게 단위',
    sort_order: 4,
  },
  {
    group_code: 'UNIT',
    detail_code: 'ROLL',
    code_name: '롤',
    code_desc: '전선 롤 단위',
    sort_order: 5,
  },
];

/**
 * 테스트 사용자 시드 데이터
 */
const userSeeds = [
  {
    email: 'admin@hanes.com',
    name: '시스템관리자',
    role: 'admin',
  },
  {
    email: 'manager@hanes.com',
    name: '현장관리자',
    role: 'manager',
  },
  {
    email: 'operator1@hanes.com',
    name: '작업자1',
    role: 'operator',
  },
  {
    email: 'operator2@hanes.com',
    name: '작업자2',
    role: 'operator',
  },
];

/**
 * 메인 시드 함수
 */
async function main() {
  console.log('Starting database seeding...');

  // 공통코드 시드
  console.log('Seeding com_codes...');
  for (const code of comCodeSeeds) {
    await prisma.com_codes.upsert({
      where: {
        // group_code와 detail_code 조합으로 unique 처리
        id: `${code.group_code}_${code.detail_code}`,
      },
      update: code,
      create: {
        id: `${code.group_code}_${code.detail_code}`,
        ...code,
        use_yn: 'Y',
      },
    });
  }
  console.log(`Seeded ${comCodeSeeds.length} com_codes`);

  // 사용자 시드
  console.log('Seeding users...');
  for (const user of userSeeds) {
    await prisma.users.upsert({
      where: {
        email: user.email,
      },
      update: user,
      create: user,
    });
  }
  console.log(`Seeded ${userSeeds.length} users`);

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

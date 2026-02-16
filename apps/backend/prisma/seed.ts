/**
 * @file apps/backend/prisma/seed.ts
 * @description 데이터베이스 초기 시드 데이터
 *
 * 초보자 가이드:
 * 1. **공통코드**: seed-com-codes.ts에서 모든 상태/유형 코드 관리
 * 2. **실행 방법**: pnpm db:seed 또는 npx prisma db seed
 *
 * 주의사항:
 * - upsert로 중복 삽입 방지됨 (안전하게 재실행 가능)
 */

import { PrismaClient } from '@prisma/client';
import { seedComCodes } from './seed-com-codes';
import { seedCompanies } from './seed-company';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 공통코드 시드 (중앙 관리)
  await seedComCodes();

  // 회사마스터 시드
  await seedCompanies();

  // 기본 관리자 계정 시드
  await prisma.user.upsert({
    where: { email: 'admin@harness.com' },
    update: {},
    create: {
      email: 'admin@harness.com',
      password: 'admin123',
      name: '관리자',
      empNo: 'ADM001',
      dept: '시스템관리',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('Admin user seeded: admin@harness.com / admin123');

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

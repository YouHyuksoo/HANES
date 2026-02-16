/**
 * @file apps/backend/prisma/seed-company.ts
 * @description 기본 회사 시드 데이터
 *
 * 사용법: seed.ts에서 호출하거나 단독 실행
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedCompanies() {
  const companies = [
    {
      companyCode: '40',
      companyName: '동방 ESS HNS MES',
      address: 'China',
      useYn: 'Y',
    },
  ];

  for (const comp of companies) {
    await prisma.companyMaster.upsert({
      where: { companyCode: comp.companyCode },
      update: {},
      create: comp,
    });
    console.log(`Company seeded: ${comp.companyCode} - ${comp.companyName}`);
  }
}

// 단독 실행 지원
if (require.main === module) {
  seedCompanies()
    .then(() => console.log('Company seeding completed!'))
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

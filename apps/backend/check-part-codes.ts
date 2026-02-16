/**
 * PartMaster 코드 체계 확인 스크립트
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== PartMaster 코드 체계 확인 ===\n');

  // 1. 숫자 코드 확인
  console.log('1. 숫자 코드 (1044, 1586 등) 검색:');
  const numericParts = await prisma.partMaster.findMany({
    where: {
      partCode: { in: ['1044', '1586', '2120', '1162'] },
      deletedAt: null,
    },
    select: { partCode: true, partName: true, partNo: true },
  });
  console.log(`  결과: ${numericParts.length}건`);
  numericParts.forEach(p => console.log(`    ${p.partCode} | ${p.partName} | partNo: ${p.partNo || 'null'}`));

  // 2. 영문 코드 확인
  console.log('\n2. 영문 코드 (ECW로 시작) 검색:');
  const alphaParts = await prisma.partMaster.findMany({
    where: {
      partCode: { startsWith: 'ECW' },
      deletedAt: null,
    },
    take: 5,
    select: { partCode: true, partName: true, partNo: true },
  });
  console.log(`  결과: ${alphaParts.length}건`);
  alphaParts.forEach(p => console.log(`    ${p.partCode} | ${p.partName} | partNo: ${p.partNo || 'null'}`));

  // 3. partNo 필드 확인 (혹시 숫자코드가 여기 있나?)
  console.log('\n3. partNo에 숫자 코드가 있는지 확인:');
  const partsWithNo = await prisma.partMaster.findMany({
    where: {
      partNo: { in: ['1044', '1586', '2120', '1162'] },
      deletedAt: null,
    },
    select: { partCode: true, partName: true, partNo: true },
  });
  console.log(`  결과: ${partsWithNo.length}건`);
  partsWithNo.forEach(p => console.log(`    partCode: ${p.partCode} | partNo: ${p.partNo} | ${p.partName}`));

  // 4. 전체 통계
  const total = await prisma.partMaster.count({ where: { deletedAt: null } });
  const withPartNo = await prisma.partMaster.count({ where: { deletedAt: null, partNo: { not: null } } });
  console.log(`\n4. 통계:`);
  console.log(`  전체 품목: ${total}건`);
  console.log(`  partNo 있음: ${withPartNo}건`);

  console.log('\n=== 확인 완료 ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

/**
 * BOM 데이터 확인 스크립트
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== BOM 데이터 확인 ===\n');

  // 1. BOM 총 개수
  const bomCount = await prisma.bomMaster.count({ where: { deletedAt: null } });
  console.log(`BOM 총 개수: ${bomCount}건\n`);

  // 2. 샘플 BOM 데이터 (JOIN으로 품목코드 확인)
  const samples = await prisma.bomMaster.findMany({
    where: { deletedAt: null },
    take: 10,
    include: {
      parentPart: { select: { partCode: true, partName: true } },
      childPart: { select: { partCode: true, partName: true } },
    },
  });

  console.log('샘플 BOM 데이터:');
  console.log('부모품목코드 | 부모품목명 | 자품목코드 | 자품목명 | 소요량 | 리비전');
  console.log('-'.repeat(80));
  samples.forEach((bom) => {
    console.log(
      `${bom.parentPart.partCode.padEnd(12)} | ${bom.parentPart.partName.slice(0, 15).padEnd(15)} | ` +
      `${bom.childPart.partCode.padEnd(10)} | ${bom.childPart.partName.slice(0, 15).padEnd(15)} | ` +
      `${String(bom.qtyPer).padEnd(6)} | ${bom.revision}`
    );
  });

  console.log('\n=== 확인 완료 ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

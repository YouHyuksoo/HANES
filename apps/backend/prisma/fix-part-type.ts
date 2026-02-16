/**
 * @file prisma/fix-part-type.ts
 * @description partType 복원: 마지막 잘못된 회전 되돌리기
 * 현재: FG=365(원자재), RAW=894(HNS ASSY), WIP=56(Cable Assy)
 * 목표: FG=56, WIP=894, RAW=365
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  const before = await prisma.partMaster.groupBy({ by: ['partType'], _count: { id: true } });
  console.log('수정 전:', JSON.stringify(before, null, 2));

  // 현재 잘못된 상태: FG=365, RAW=894, WIP=56
  // 목표: FG=56, WIP=894, RAW=365
  // 역회전: WIP→FG, FG→RAW, RAW→WIP

  const r1 = await prisma.partMaster.updateMany({ where: { partType: 'WIP' }, data: { partType: 'TEMP_FG' } });
  console.log('WIP(56) -> TEMP_FG:', r1.count);

  const r2 = await prisma.partMaster.updateMany({ where: { partType: 'FG' }, data: { partType: 'TEMP_RAW' } });
  console.log('FG(365) -> TEMP_RAW:', r2.count);

  const r3 = await prisma.partMaster.updateMany({ where: { partType: 'RAW' }, data: { partType: 'WIP' } });
  console.log('RAW(894) -> WIP:', r3.count);

  const r4 = await prisma.partMaster.updateMany({ where: { partType: 'TEMP_FG' }, data: { partType: 'FG' } });
  console.log('TEMP_FG -> FG:', r4.count);

  const r5 = await prisma.partMaster.updateMany({ where: { partType: 'TEMP_RAW' }, data: { partType: 'RAW' } });
  console.log('TEMP_RAW -> RAW:', r5.count);

  const after = await prisma.partMaster.groupBy({ by: ['partType'], _count: { id: true } });
  console.log('수정 후:', JSON.stringify(after, null, 2));
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

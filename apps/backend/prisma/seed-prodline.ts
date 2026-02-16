/**
 * @file prisma/seed-prodline.ts
 * @description Oracle TM_PRODLINE → Supabase prod_line_masters 마이그레이션
 *
 * 실행: npx tsx prisma/seed-prodline.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const prodLineData = [
  { lineCode: 'NONE', lineName: 'NONE', whLoc: 'LOC002', oper: '#0000', lineType: null },
  { lineCode: 'P2001', lineName: '压接1生产线', whLoc: 'LOC002', oper: '#0100', lineType: null },
  { lineCode: 'P2002', lineName: '(手动)压接1生产线', whLoc: 'LOC002', oper: '#0150', lineType: null },
  { lineCode: 'P2003', lineName: '组装1生产线', whLoc: 'LOC002', oper: '#0200', lineType: null },
  { lineCode: 'P2004', lineName: '排板1生产线', whLoc: 'LOC002', oper: '#0300', lineType: null },
  { lineCode: 'P2005', lineName: '通电1生产线', whLoc: 'LOC002', oper: '#0400', lineType: null },
  { lineCode: 'P2006', lineName: '包装1生产线', whLoc: 'LOC002', oper: '#0500', lineType: 'PACKING' },
  { lineCode: 'P2007', lineName: '外观检查', whLoc: 'LOC002', oper: 'NONE', lineType: null },
  { lineCode: 'P2008', lineName: 'SUB排板1生产线', whLoc: 'LOC002', oper: '#0202', lineType: null },
  { lineCode: 'P2009', lineName: '(手动)脱皮1生产线', whLoc: 'LOC002', oper: '#0151', lineType: null },
  { lineCode: 'P2010', lineName: 'GP12检查', whLoc: 'LOC002', oper: '#0800', lineType: null },
];

async function main() {
  console.log('=== Oracle TM_PRODLINE → Supabase prod_line_masters 마이그레이션 ===');

  const { count: deleted } = await prisma.prodLineMaster.deleteMany({});
  console.log(`기존 삭제: ${deleted}건`);

  const result = await prisma.prodLineMaster.createMany({
    data: prodLineData.map((p) => ({
      lineCode: p.lineCode,
      lineName: p.lineName,
      whLoc: p.whLoc,
      oper: p.oper,
      lineType: p.lineType || undefined,
      useYn: 'Y',
    })),
    skipDuplicates: true,
  });

  console.log(`삽입 완료: ${result.count}건`);

  const all = await prisma.prodLineMaster.findMany({ orderBy: { lineCode: 'asc' } });
  console.log('\n=== 결과 ===');
  all.forEach((p) => console.log(`  ${p.lineCode} | ${p.lineName} | oper=${p.oper} | type=${p.lineType || '-'}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

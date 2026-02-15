/**
 * @file prisma/seed-bom-from-oracle.ts
 * @description Oracle TM_BOM → Supabase bom_masters 마이그레이션 (배치 방식)
 *
 * 실행: npx tsx prisma/seed-bom-from-oracle.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface OracleBom {
  BOMGRP: string;
  REV: number;
  SEQ: number;
  UPRITEM: number;
  ITEMCODE: number;
  ASSYUSAGE: number;
  OPER: string | null;
  SIDE: string | null;
  USEFLAG: string;
  STARTDATE: string | null;
  ENDDATE: string | null;
  REMARKS: string | null;
}

function parseOracleDate(dateStr: string | null): Date | undefined {
  if (!dateStr || dateStr === '99991231') return undefined;
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  return new Date(`${y}-${m}-${d}`);
}

async function main() {
  console.log('=== Oracle TM_BOM → Supabase bom_masters 배치 마이그레이션 ===');

  // 1. 기존 BOM 데이터 삭제
  const { count: deleted } = await prisma.bomMaster.deleteMany({});
  console.log(`기존 BOM 삭제: ${deleted}건`);

  // 2. oracle_bom.json 로드
  const filePath = path.join(__dirname, 'oracle_bom.json');
  const bomData: OracleBom[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Oracle BOM 로드: ${bomData.length}건`);

  // 3. PartMaster에서 partCode → id 맵 생성
  const parts = await prisma.partMaster.findMany({
    where: { deletedAt: null },
    select: { id: true, partCode: true },
  });
  const partMap = new Map<string, string>();
  parts.forEach((p) => partMap.set(p.partCode, p.id));
  console.log(`PartMaster 맵: ${partMap.size}건`);

  // 4. 배치 데이터 준비
  const seen = new Set<string>();
  const batchData: any[] = [];
  let skipped = 0;
  const missingCodes = new Set<string>();

  for (const bom of bomData) {
    const parentPartCode = String(bom.UPRITEM);
    const childPartCode = String(bom.ITEMCODE);
    const parentId = partMap.get(parentPartCode);
    const childId = partMap.get(childPartCode);

    if (!parentId) { skipped++; missingCodes.add(`UPR:${parentPartCode}`); continue; }
    if (!childId) { skipped++; missingCodes.add(`ITEM:${childPartCode}`); continue; }
    if (parentId === childId) { skipped++; continue; }

    const revision = String(bom.REV);
    const key = `${parentId}-${childId}-${revision}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);

    batchData.push({
      parentPartId: parentId,
      childPartId: childId,
      qtyPer: bom.ASSYUSAGE,
      seq: bom.SEQ,
      revision,
      bomGrp: bom.BOMGRP,
      oper: bom.OPER || undefined,
      side: bom.SIDE || undefined,
      validFrom: parseOracleDate(bom.STARTDATE),
      validTo: parseOracleDate(bom.ENDDATE),
      remark: bom.REMARKS || undefined,
      useYn: bom.USEFLAG === 'Y' ? 'Y' : 'N',
    });
  }

  console.log(`매핑 완료: ${batchData.length}건 준비, ${skipped}건 건너뜀`);

  // 5. 배치 삽입 (500건씩)
  const BATCH_SIZE = 500;
  let totalInserted = 0;

  for (let i = 0; i < batchData.length; i += BATCH_SIZE) {
    const chunk = batchData.slice(i, i + BATCH_SIZE);
    try {
      const result = await prisma.bomMaster.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      totalInserted += result.count;
      console.log(`  배치 ${Math.floor(i / BATCH_SIZE) + 1}: ${result.count}건 삽입`);
    } catch (e: any) {
      console.error(`  배치 오류 (${i}~${i + chunk.length}):`, e.message);
    }
  }

  console.log(`\n=== 결과 ===`);
  console.log(`삽입 성공: ${totalInserted}건`);
  console.log(`건너뜀: ${skipped}건`);
  if (missingCodes.size > 0) {
    console.log(`매핑 실패 코드 (${missingCodes.size}개): ${[...missingCodes].slice(0, 15).join(', ')}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

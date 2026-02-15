/**
 * @file prisma/seed-parts-from-oracle.ts
 * @description Oracle TM_ITEMS → Supabase part_masters 데이터 이관 스크립트
 *
 * 실행 방법:
 *   npx ts-node prisma/seed-parts-from-oracle.ts
 *
 * 매핑 규칙:
 *   ITEMTYPE 1 → RAW (원자재)
 *   ITEMTYPE 2 → FG  (완제품/하네스 ASSY)
 *   ITEMTYPE 3 → WIP (반제품/부자재)
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

/** Oracle ITEMTYPE → PartMaster partType 매핑 */
const ITEM_TYPE_MAP: Record<string, string> = {
  "1": "RAW",
  "2": "FG",
  "3": "WIP",
};

interface OracleItem {
  ITEMCODE: number;
  ITEMNAME: string;
  PARTNO: string | null;
  CUSTPARTNO: string | null;
  ITEMTYPE: string | null;
  PRODUCTTYPE: string | null;
  SPEC: string | null;
  REV: string | null;
  UNITCODE: string | null;
  SAFTYQTY: number | null;
  LOTUNITQTY: number | null;
  BOXQTY: number | null;
  IQCFLAG: string | null;
  TACTTIME: number | null;
  EXPIRYDATE: number | null;
  REMARKS: string | null;
  USEFLAG: string | null;
}

async function main() {
  // 1. Oracle 추출 데이터 로드
  const jsonPath = path.join(__dirname, "oracle_items.json");
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  if (!raw.success || !raw.data) {
    console.error("Oracle 데이터 파일이 유효하지 않습니다.");
    process.exit(1);
  }

  const items: OracleItem[] = raw.data;
  console.log(`\n📦 Oracle TM_ITEMS 로드 완료: ${items.length}건`);

  // 2. 기존 part_masters 데이터 삭제
  // 외래키 제약이 있을 수 있으므로 관련 테이블 먼저 정리
  console.log("\n🗑️  기존 part_masters 데이터 삭제 중...");

  // 자식 테이블들 먼저 정리 (외래키 참조)
  const delCounts = await prisma.$transaction([
    prisma.customerOrderItem.deleteMany({}),
    prisma.shipmentReturnItem.deleteMany({}),
    prisma.shipmentOrderItem.deleteMany({}),
    prisma.purchaseOrderItem.deleteMany({}),
    prisma.iqcLog.deleteMany({}),
    prisma.iqcItemMaster.deleteMany({}),
    prisma.workInstruction.deleteMany({}),
    prisma.boxMaster.deleteMany({}),
    prisma.subconResult.deleteMany({}),
    prisma.processMap.deleteMany({}),
    prisma.matStock.deleteMany({}),
    prisma.matLot.deleteMany({}),
    prisma.stockTransaction.deleteMany({}),
    prisma.stock.deleteMany({}),
    prisma.lot.deleteMany({}),
    prisma.jobOrder.deleteMany({}),
    prisma.bomMaster.deleteMany({}),
    prisma.partMaster.deleteMany({}),
  ]);

  console.log(`   ✅ part_masters 및 관련 테이블 초기화 완료`);

  // 3. 데이터 변환 및 삽입
  console.log("\n📥 데이터 이관 중...");

  let successCount = 0;
  let skipCount = 0;
  const errors: string[] = [];

  // 배치 처리 (100건씩)
  const batchSize = 100;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const records = batch.map((item) => ({
      partCode: String(item.ITEMCODE),
      partName: item.ITEMNAME || "이름없음",
      partNo: item.PARTNO || null,
      custPartNo: item.CUSTPARTNO || null,
      partType: ITEM_TYPE_MAP[item.ITEMTYPE || "1"] || "RAW",
      productType: item.PRODUCTTYPE || null,
      spec: item.SPEC || null,
      rev: item.REV || null,
      unit: item.UNITCODE || "EA",
      safetyStock: item.SAFTYQTY ? Math.round(item.SAFTYQTY) : 0,
      lotUnitQty: item.LOTUNITQTY ? Math.round(item.LOTUNITQTY) : null,
      boxQty: item.BOXQTY ? Math.round(item.BOXQTY) : 0,
      iqcFlag: item.IQCFLAG || "Y",
      tactTime: item.TACTTIME ? Math.round(item.TACTTIME) : 0,
      expiryDate: item.EXPIRYDATE ? Math.round(item.EXPIRYDATE) : 0,
      remarks: item.REMARKS || null,
      useYn: item.USEFLAG || "Y",
    }));

    try {
      await prisma.partMaster.createMany({
        data: records,
        skipDuplicates: true,
      });
      successCount += records.length;
    } catch (err: any) {
      // 배치 실패 시 개별 삽입 시도
      for (const rec of records) {
        try {
          await prisma.partMaster.create({ data: rec });
          successCount++;
        } catch (e: any) {
          skipCount++;
          errors.push(`ITEMCODE=${rec.partCode}: ${e.message?.slice(0, 80)}`);
        }
      }
    }

    // 진행률 표시
    const progress = Math.min(i + batchSize, items.length);
    process.stdout.write(`\r   진행: ${progress}/${items.length} (${Math.round(progress / items.length * 100)}%)`);
  }

  console.log("\n");
  console.log("=" .repeat(50));
  console.log(`✅ 이관 완료!`);
  console.log(`   - 성공: ${successCount}건`);
  console.log(`   - 스킵: ${skipCount}건`);
  if (errors.length > 0) {
    console.log(`   - 에러 상세 (상위 10건):`);
    errors.slice(0, 10).forEach((e) => console.log(`     ${e}`));
  }
  console.log("=" .repeat(50));

  // 4. 검증
  const totalInDb = await prisma.partMaster.count();
  const byType = await prisma.partMaster.groupBy({
    by: ["partType"],
    _count: true,
  });

  console.log(`\n📊 이관 검증:`);
  console.log(`   DB 총 건수: ${totalInDb}`);
  byType.forEach((g) => console.log(`   - ${g.partType}: ${g._count}건`));
}

main()
  .catch((e) => {
    console.error("이관 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

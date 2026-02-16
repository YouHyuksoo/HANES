/**
 * @file prisma/seed-company-from-oracle.ts
 * @description Oracle TM_COMPANY → Supabase company_masters 데이터 이관 스크립트
 *
 * 실행 방법:
 *   npx ts-node prisma/seed-company-from-oracle.ts
 *
 * 매핑 규칙:
 *   CLIENT + COMPANY → companyCode (예: "1060-40" 또는 COMPANY 단독)
 *   COMPANYNAME → companyName
 *   USEFLAG → useYn
 *   REMARKS → remark
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface OracleCompany {
  CLIENT: string;
  COMPANY: string;
  COMPANYNAME: string;
  USEFLAG: string | null;
  REMARKS: string | null;
  CREATETIMEKEY: string | null;
  CREATEUSER: string | null;
}

async function main() {
  // 1. Oracle 추출 데이터 로드
  const jsonPath = path.join(__dirname, "oracle_companies.json");
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  if (!raw.success || !raw.data) {
    console.error("Oracle 데이터 파일이 유효하지 않습니다.");
    process.exit(1);
  }

  const companies: OracleCompany[] = raw.data;
  console.log(`\n🏢 Oracle TM_COMPANY 로드 완료: ${companies.length}건`);

  // 2. 데이터 변환 및 upsert
  console.log("\n📥 데이터 이관 중...");

  let successCount = 0;
  const errors: string[] = [];

  for (const comp of companies) {
    const companyCode = comp.COMPANY.trim();
    const companyName = comp.COMPANYNAME.trim();

    try {
      await prisma.companyMaster.upsert({
        where: { companyCode },
        update: {
          companyName,
          useYn: comp.USEFLAG || "Y",
          remark: comp.REMARKS || null,
          updatedBy: "ORACLE_IMPORT",
        },
        create: {
          companyCode,
          companyName,
          useYn: comp.USEFLAG || "Y",
          remark: comp.REMARKS || null,
          createdBy: comp.CREATEUSER || "ORACLE_IMPORT",
        },
      });
      successCount++;
      console.log(`   ✅ ${companyCode} - ${companyName}`);
    } catch (err: any) {
      errors.push(`${companyCode}: ${err.message?.slice(0, 80)}`);
      console.log(`   ❌ ${companyCode} - ${err.message?.slice(0, 80)}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ 이관 완료! 성공: ${successCount}건, 실패: ${errors.length}건`);
  if (errors.length > 0) {
    console.log("에러 상세:");
    errors.forEach((e) => console.log(`   ${e}`));
  }
  console.log("=".repeat(50));

  // 3. 검증
  const totalInDb = await prisma.companyMaster.count({ where: { deletedAt: null } });
  const allCompanies = await prisma.companyMaster.findMany({
    where: { deletedAt: null },
    select: { companyCode: true, companyName: true, useYn: true },
  });

  console.log(`\n📊 이관 검증: DB 총 ${totalInDb}건`);
  allCompanies.forEach((c) =>
    console.log(`   - ${c.companyCode}: ${c.companyName} (${c.useYn})`),
  );
}

main()
  .catch((e) => {
    console.error("이관 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

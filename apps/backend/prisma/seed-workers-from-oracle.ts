/**
 * @file prisma/seed-workers-from-oracle.ts
 * @description Oracle TM_EHR → Supabase worker_masters 데이터 이관 스크립트
 *
 * 실행 방법:
 *   npx ts-node prisma/seed-workers-from-oracle.ts
 *
 * 매핑 규칙:
 *   EHRCODE      → workerCode
 *   LOCUSERNAME  → workerName
 *   ENGUSERNAME  → engName
 *   DEPARTMENT   → dept
 *   POSITION     → position
 *   PHONE        → phone
 *   EMAIL        → email
 *   HIREDATE     → hireDate
 *   QUITDATE     → quitDate
 *   USEFLAG      → useYn
 *   REMARKS      → remark
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface OracleEhr {
  EHRCODE: string;
  LOCUSERNAME: string;
  ENGUSERNAME: string | null;
  PHONE: string | null;
  EMAIL: string | null;
  DEPARTMENT: string | null;
  POSITION: string | null;
  HIREDATE: string | null;
  QUITDATE: string | null;
  USEFLAG: string;
  REMARKS: string | null;
}

async function main() {
  const jsonPath = path.join(__dirname, "oracle_ehr.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("oracle_ehr.json not found. Run Oracle query first.");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const rows: OracleEhr[] = raw.data ?? raw;
  console.log(`📋 Total EHR records: ${rows.length}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const workerCode = String(row.EHRCODE).trim();
    if (!workerCode) {
      skipped++;
      continue;
    }

    const data = {
      workerName: row.LOCUSERNAME?.trim() || workerCode,
      engName: row.ENGUSERNAME?.trim() || undefined,
      dept: row.DEPARTMENT?.trim() || undefined,
      position: row.POSITION?.trim() || undefined,
      phone: row.PHONE?.trim() || undefined,
      email: row.EMAIL?.trim() || undefined,
      hireDate: row.HIREDATE?.trim() || undefined,
      quitDate: row.QUITDATE?.trim() || undefined,
      remark: row.REMARKS?.trim() || undefined,
      useYn: row.USEFLAG === "Y" ? "Y" : "N",
    };

    const existing = await prisma.workerMaster.findFirst({
      where: { workerCode, deletedAt: null },
    });

    if (existing) {
      await prisma.workerMaster.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.workerMaster.create({
        data: { workerCode, ...data },
      });
      created++;
    }
  }

  console.log(`✅ Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log(`📊 Total worker_masters: ${await prisma.workerMaster.count()}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

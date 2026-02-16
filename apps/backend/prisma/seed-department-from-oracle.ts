/**
 * @file prisma/seed-department-from-oracle.ts
 * @description Oracle TM_DEPARTMENT → Supabase department_masters 데이터 이관 스크립트
 *
 * 실행 방법:
 *   npx ts-node prisma/seed-department-from-oracle.ts
 *
 * 매핑 규칙:
 *   DEPARTMENT → deptCode (부서코드)
 *   DEPARTMENTNAME → deptName (부서명)
 *   COMPANY → company
 *   PLANT → plant
 *   USEFLAG → useYn
 *   REMARKS → remark
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface OracleDepartment {
  CLIENT: string;
  COMPANY: string;
  PLANT: string;
  DEPARTMENT: string;
  DEPARTMENTNAME: string;
  USEFLAG: string | null;
  REMARKS: string | null;
  CREATETIMEKEY: string | null;
  CREATEUSER: string | null;
}

async function main() {
  // 1. Oracle 추출 데이터 로드
  const jsonPath = path.join(__dirname, "oracle_departments.json");
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  if (!raw.success || !raw.data) {
    console.error("Oracle 데이터 파일이 유효하지 않습니다.");
    process.exit(1);
  }

  const departments: OracleDepartment[] = raw.data;
  console.log(`\n🏢 Oracle TM_DEPARTMENT 로드 완료: ${departments.length}건`);

  // 2. 데이터 변환 및 upsert
  console.log("\n📥 데이터 이관 중...");

  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < departments.length; i++) {
    const dept = departments[i];
    const deptCode = dept.DEPARTMENT.trim();
    const deptName = dept.DEPARTMENTNAME.trim();

    try {
      await prisma.departmentMaster.upsert({
        where: { deptCode },
        update: {
          deptName,
          company: dept.COMPANY?.trim() || null,
          plant: dept.PLANT?.trim() || null,
          useYn: dept.USEFLAG || "Y",
          remark: dept.REMARKS || null,
          sortOrder: i * 10,
          updatedBy: "ORACLE_IMPORT",
        },
        create: {
          deptCode,
          deptName,
          company: dept.COMPANY?.trim() || null,
          plant: dept.PLANT?.trim() || null,
          useYn: dept.USEFLAG || "Y",
          remark: dept.REMARKS || null,
          sortOrder: i * 10,
          createdBy: dept.CREATEUSER || "ORACLE_IMPORT",
        },
      });
      successCount++;
      console.log(`   ✅ ${deptCode} - ${deptName}`);
    } catch (err: any) {
      errors.push(`${deptCode}: ${err.message?.slice(0, 80)}`);
      console.log(`   ❌ ${deptCode} - ${err.message?.slice(0, 80)}`);
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
  const totalInDb = await prisma.departmentMaster.count({ where: { deletedAt: null } });
  const allDepts = await prisma.departmentMaster.findMany({
    where: { deletedAt: null },
    select: { deptCode: true, deptName: true, useYn: true },
    orderBy: { sortOrder: "asc" },
  });

  console.log(`\n📊 이관 검증: DB 총 ${totalInDb}건`);
  allDepts.forEach((d) =>
    console.log(`   - ${d.deptCode}: ${d.deptName} (${d.useYn})`),
  );
}

main()
  .catch((e) => {
    console.error("이관 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

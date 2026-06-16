import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 작업지도서 샘플 이미지(SVG) 생성기.
 * - 활성 작업지시의 (품목, 공정) 조합별로 "작업지도서 시트" 형태 SVG를 생성한다.
 * - apps/backend/uploads/work-instructions/ 에 저장 → /uploads/... 로 정적 서빙.
 * - WORK_INSTRUCTIONS.IMAGE_URL 을 연결하는 마이그레이션 SQL 도 함께 생성한다.
 */

const outDir = join(process.cwd(), "apps", "backend", "uploads", "work-instructions");
const migrationPath = join(
  process.cwd(),
  "apps",
  "backend",
  "src",
  "migrations",
  "2026-06-17_work_instruction_image_seed.sql",
);

// [ITEM_CODE, PROCESS_CODE, PROCESS_NAME]
const rows = [
  ["HNS02", "MASSY", "메인조립"],
  ["HNS02", "SASSY", "서브조립"],
  ["HNS02-SCA", "CRMPB", "양단압착"],
  ["HNS02-SCA_1", "STRPB", "양단탈피"],
  ["HNS02-SCA_2", "ATCUT", "자동절단"],
  ["HNS02C1", "WELDR", "후단융착"],
  ["HNS02C1A", "MTASY", "자재장착"],
  ["HNS02C1AB", "CRMPF", "전단압착"],
  ["HNS02C1ABC", "STRPB", "양단탈피"],
  ["HNS02C1ABCD", "ATCUT", "자동절단"],
  ["HNS02C2", "TUBHT", "튜브열처리"],
  ["HNS02C2A", "CRMPR", "후단압착"],
  ["HNS02C2AB", "HEXCP", "육각압착"],
  ["HNS02C2ABC", "MTASY", "자재장착"],
  ["HNS02C2ABCD", "SHDRM", "편조제거"],
  ["HNS02C2ABCDE", "ATCNS", "자동절단탈피"],
  ["HNS02_FA", "TAPPN", "배판작업(테이핑)"],
  ["HNS02_FB", "SASSY", "서브조립"],
];

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function svgFor([itemCode, processCode, processName]) {
  const steps = [
    `작업지시와 품목 ${itemCode} 을(를) 확인한다.`,
    `${processName}(${processCode}) 공정의 설비 상태와 투입 자재를 확인한다.`,
    `작업표준에 따라 ${processName} 을(를) 수행하고 규격·외관을 확인한다.`,
    `이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.`,
  ];
  const stepSvg = steps
    .map((text, i) => {
      const y = 250 + i * 78;
      return `  <circle cx="92" cy="${y - 6}" r="20" fill="#2563eb"/>
  <text x="92" y="${y + 1}" fill="#ffffff" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="22" font-weight="700" text-anchor="middle">${i + 1}</text>
  <text x="130" y="${y + 1}" fill="#0f172a" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="22">${escapeXml(text)}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${escapeXml(itemCode)} ${escapeXml(processName)} 작업지도서">
  <rect width="1280" height="720" fill="#f1f5f9"/>
  <rect x="40" y="40" width="1200" height="640" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="40" y="40" width="1200" height="120" rx="24" fill="#1e3a8a"/>
  <rect x="40" y="136" width="1200" height="24" fill="#1e3a8a"/>
  <text x="80" y="104" fill="#ffffff" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="40" font-weight="800">${escapeXml(processName)} 작업지도서</text>
  <text x="80" y="146" fill="#bfdbfe" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="20">${escapeXml(itemCode)} · ${escapeXml(processCode)} · Rev A</text>
  <rect x="900" y="64" width="300" height="72" rx="14" fill="#ffffff" fill-opacity="0.12" stroke="#bfdbfe" stroke-width="1.5"/>
  <text x="1050" y="100" fill="#ffffff" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="18" text-anchor="middle">품목 ${escapeXml(itemCode)}</text>
  <text x="1050" y="124" fill="#bfdbfe" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="16" text-anchor="middle">공정 ${escapeXml(processName)}</text>
  <text x="80" y="210" fill="#1e3a8a" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="26" font-weight="700">표준 작업 순서</text>
${stepSvg}
  <rect x="80" y="590" width="1120" height="60" rx="12" fill="#fff7ed" stroke="#fdba74" stroke-width="2"/>
  <text x="104" y="628" fill="#9a3412" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="20" font-weight="700">※ 본 작업지도서는 샘플입니다. 실제 이미지/PDF/PPTX 파일을 업로드하면 교체됩니다.</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });

const updates = [];
for (const row of rows) {
  const [itemCode, processCode] = row;
  const filename = `wi-seed-${slug(itemCode)}-${slug(processCode)}.svg`;
  writeFileSync(join(outDir, filename), svgFor(row), "utf8");
  updates.push(
    `UPDATE WORK_INSTRUCTIONS
   SET IMAGE_URL = '/uploads/work-instructions/${filename}',
       UPDATED_BY = 'claude',
       UPDATED_AT = SYSTIMESTAMP
 WHERE COMPANY = '40'
   AND PLANT_CD = '1000'
   AND ITEM_CODE = '${itemCode}'
   AND PROCESS_CODE = '${processCode}'
   AND REVISION = 'A';`,
  );
}

writeFileSync(migrationPath, `-- 작업지도서 샘플 SVG 이미지 IMAGE_URL 연결 (generate-work-instruction-seed-images.mjs 생성)\n\n${updates.join("\n/\n\n")}\n/\n\nCOMMIT;\n/\n`, "utf8");

console.log(`generated ${rows.length} SVG files -> ${outDir}`);
console.log(migrationPath);

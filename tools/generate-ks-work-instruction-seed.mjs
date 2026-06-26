import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * KS 라인 작업지도서 시드 생성기.
 * - input-kiosk 작업지도서가 HNS02 계열만 등록되어 있고 KS 라인은 누락 → 키오스크에 표시되지 않던 문제 보정.
 * - 작업지시가 걸린 KS 완제품/반제품의 라우팅 전 공정에 대해 작업지도서 SVG + WORK_INSTRUCTIONS 행을 생성한다.
 * - SVG: apps/backend/uploads/work-instructions/ 저장 → /uploads/... 정적 서빙.
 * - 신규 행이므로 MERGE(멱등) INSERT 마이그레이션 SQL 도 함께 생성한다.
 *
 * 참고: generate-work-instruction-seed-images.mjs(HNS02 계열, UPDATE 방식)와 동일한 SVG 레이아웃.
 */

const outDir = join(process.cwd(), "apps", "backend", "uploads", "work-instructions");
const migrationPath = join(
  process.cwd(),
  "apps",
  "backend",
  "src",
  "migrations",
  "2026-06-26_ks_work_instruction_seed.sql",
);

// [ITEM_CODE, PROCESS_CODE, PROCESS_NAME] — KS 라우팅 전 공정 (ROUTING_PROCESSES 기준)
const rows = [
  // 완제품 KS_L1_ACOMP_N91H00-X9800 (KS_RT_L1_ACOMP)
  ["KS_L1_ACOMP_N91H00-X9800", "KS_ASPRP", "조립자재준비"],
  ["KS_L1_ACOMP_N91H00-X9800", "KS_CONAS", "커넥터체결"],
  ["KS_L1_ACOMP_N91H00-X9800", "KS_EXTAS", "외장재조립"],
  ["KS_L1_ACOMP_N91H00-X9800", "KS_CIRCK", "통합회로검사"],
  // 반제품 KS_L2_SHLDCABLE (KS_RT_L2_SHLDCABLE)
  ["KS_L2_SHLDCABLE", "KS_CUTST", "전선절단탈피"],
  ["KS_L2_SHLDCABLE", "KS_SHDCT", "차폐선절단"],
  ["KS_L2_SHLDCABLE", "KS_CRPRP", "압착준비"],
  ["KS_L2_SHLDCABLE", "KS_HEXCP", "육각압착"],
  ["KS_L2_SHLDCABLE", "KS_GCRMP", "일반압착"],
  ["KS_L2_SHLDCABLE", "KS_TUBIN", "열수축튜브삽입"],
  ["KS_L2_SHLDCABLE", "KS_TUBHT", "열수축접착"],
  ["KS_L2_SHLDCABLE", "KS_SEMIN", "반제품검사"],
];

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const sqlStr = (s) => `'${String(s).replaceAll("'", "''")}'`;

/** 작업 표준 순서 4단계 (CONTENT/SVG 공용) */
function stepsFor(itemCode, processCode, processName) {
  return [
    `작업지시와 품목 ${itemCode} 을(를) 확인한다.`,
    `${processName}(${processCode}) 공정의 설비 상태와 투입 자재를 확인한다.`,
    `작업표준에 따라 ${processName} 을(를) 수행하고 규격·외관을 확인한다.`,
    `이상 발생 시 설비를 정지하고 작업자설비점검 및 품질 담당자에게 알린다.`,
  ];
}

function svgFor([itemCode, processCode, processName]) {
  const steps = stepsFor(itemCode, processCode, processName);
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

const merges = [];
for (const row of rows) {
  const [itemCode, processCode, processName] = row;
  const filename = `wi-seed-${slug(itemCode)}-${slug(processCode)}.svg`;
  writeFileSync(join(outDir, filename), svgFor(row), "utf8");

  const title = `${itemCode} ${processName} 작업지도서`;
  const content = stepsFor(itemCode, processCode, processName)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");
  const imageUrl = `/uploads/work-instructions/${filename}`;

  merges.push(
    `MERGE INTO WORK_INSTRUCTIONS wi
USING (SELECT ${sqlStr(itemCode)} AS ITEM_CODE, ${sqlStr(processCode)} AS PROCESS_CODE, 'A' AS REVISION FROM DUAL) src
ON (wi.ITEM_CODE = src.ITEM_CODE AND wi.PROCESS_CODE = src.PROCESS_CODE AND wi.REVISION = src.REVISION)
WHEN MATCHED THEN UPDATE SET
  wi.TITLE = ${sqlStr(title)},
  wi.CONTENT = ${sqlStr(content)},
  wi.IMAGE_URL = ${sqlStr(imageUrl)},
  wi.USE_YN = 'Y',
  wi.UPDATED_BY = 'claude',
  wi.UPDATED_AT = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT
  (ITEM_CODE, PROCESS_CODE, REVISION, TITLE, CONTENT, IMAGE_URL, USE_YN, COMPANY, PLANT_CD, CREATED_BY, CREATED_AT, UPDATED_AT)
VALUES
  (src.ITEM_CODE, src.PROCESS_CODE, src.REVISION, ${sqlStr(title)}, ${sqlStr(content)}, ${sqlStr(imageUrl)}, 'Y', '40', '1000', 'claude', SYSTIMESTAMP, SYSTIMESTAMP);`,
  );
}

writeFileSync(
  migrationPath,
  `-- KS 라인 작업지도서 시드 (generate-ks-work-instruction-seed.mjs 생성)\n-- 키오스크 작업지도서 누락 보정: KS_L1_ACOMP_N91H00-X9800 / KS_L2_SHLDCABLE 라우팅 전 공정\n\n${merges.join("\n/\n\n")}\n/\n\nCOMMIT;\n/\n`,
  "utf8",
);

console.log(`generated ${rows.length} SVG files -> ${outDir}`);
console.log(migrationPath);

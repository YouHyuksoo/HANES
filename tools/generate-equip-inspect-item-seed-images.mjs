import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "apps", "backend", "uploads", "equip-inspect-items");
const migrationPath = join(
  process.cwd(),
  "apps",
  "backend",
  "src",
  "migrations",
  "2026-06-16_equip_inspect_item_image_seed.sql",
);

const typeLabels = {
  AUTO_CRIMP: "자동압착기",
  COMMON: "공통 설비",
  HOUSING: "하우징 삽입기",
  INSPECTION: "검사 설비",
  LABEL_PRINTER: "라벨 프린터",
  MULTI_CUT: "다선 절단기",
  OTHER: "기타 설비",
  PACKING: "포장 설비",
  SINGLE_CUT: "단선 절단기",
  SOLDER: "납땜 설비",
  TESTER: "검사기",
  TWIST: "트위스트기",
};

const items = [
  ["EI-ATC-001", "AUTO_CRIMP", "압착력 설정 패널"],
  ["EI-ATC-002", "AUTO_CRIMP", "압착 단자 배출부"],
  ["EI-ATC-003", "AUTO_CRIMP", "압착 높이 측정 위치"],
  ["EI-ATC-004", "AUTO_CRIMP", "단자 공급 릴"],
  ["EI-ATC-P01", "AUTO_CRIMP", "압착 다이 마모부"],
  ["EI-ATC-PM1", "AUTO_CRIMP", "압착 다이 교체부"],
  ["EI-CMN-001", "COMMON", "전원 스위치/램프"],
  ["EI-CMN-002", "COMMON", "비상 정지 버튼"],
  ["EI-CMN-003", "COMMON", "안전 커버/가드"],
  ["EI-CMN-004", "COMMON", "구동부 주변"],
  ["EI-CMN-P01", "COMMON", "구동부 윤활 위치"],
  ["EI-CMN-P02", "COMMON", "에어 필터"],
  ["EI-HSG-001", "HOUSING", "하우징 공급 호퍼"],
  ["EI-HSG-002", "HOUSING", "하우징 체결부"],
  ["EI-HSG-003", "HOUSING", "삽입 압력 확인부"],
  ["EI-INS-001", "INSPECTION", "검사 지그 고정부"],
  ["EI-INS-002", "INSPECTION", "조명 헤드"],
  ["EI-INS-003", "INSPECTION", "카메라 렌즈"],
  ["EI-INS-P01", "INSPECTION", "기준 샘플 판정부"],
  ["EI-LBP-001", "LABEL_PRINTER", "라벨 인쇄 배출부"],
  ["EI-LBP-002", "LABEL_PRINTER", "라벨 롤 잔량부"],
  ["EI-LBP-P01", "LABEL_PRINTER", "인쇄 헤드"],
  ["EI-MCT-001", "MULTI_CUT", "채널별 절단부"],
  ["EI-MCT-002", "MULTI_CUT", "전선 공급 장력부"],
  ["EI-MCT-P01", "MULTI_CUT", "다선 가이드"],
  ["EI-OTH-001", "OTHER", "설비 외관/주변"],
  ["EI-OTH-P01", "OTHER", "접지 단자"],
  ["EI-PKG-001", "PACKING", "열 밀봉 온도부"],
  ["EI-PKG-002", "PACKING", "포장 밀봉 배출부"],
  ["EI-PKG-P01", "PACKING", "히터 바"],
  ["EI-SCT-001", "SINGLE_CUT", "절단 길이 기준부"],
  ["EI-SCT-002", "SINGLE_CUT", "커터 날"],
  ["EI-SCT-003", "SINGLE_CUT", "탈피 길이 기준부"],
  ["EI-SCT-P01", "SINGLE_CUT", "커터 날 교체부"],
  ["EI-SLD-001", "SOLDER", "납조 온도계"],
  ["EI-SLD-002", "SOLDER", "납 잔량 확인부"],
  ["EI-SLD-003", "SOLDER", "납 외관 샘플부"],
  ["EI-SLD-P01", "SOLDER", "납조 슬래그 제거부"],
  ["EI-TST-001", "TESTER", "기준 하네스 연결부"],
  ["EI-TST-002", "TESTER", "저항 측정 단자"],
  ["EI-TST-003", "TESTER", "프로브 접촉부"],
  ["EI-TST-P01", "TESTER", "검사 지그 핀"],
  ["EI-TST-PM1", "TESTER", "캘리브레이션 포트"],
  ["EI-TWS-001", "TWIST", "피치 설정 패널"],
  ["EI-TWS-002", "TWIST", "트위스트 배출부"],
  ["EI-TWS-P01", "TWIST", "스핀들 베어링"],
  ["EI-WRK-001", "COMMON", "작업 전 주변 정리 구역"],
  ["EI-WRK-002", "COMMON", "보호구 착용 확인 위치"],
  ["EI-WRK-003", "COMMON", "작업지시서 거치대"],
  ["EI-WRK-004", "COMMON", "가동 전 이상음 확인 구역"],
];

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slug = (code) => code.toLowerCase().replaceAll("-", "_");

function svgFor([code, equipType, location]) {
  const typeLabel = typeLabels[equipType] ?? equipType;
  const focusX = code.includes("P02") || location.includes("필터") || location.includes("접지") ? 430 : 320;
  const focusY = code.includes("WRK") || location.includes("주변") ? 238 : 168;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420" role="img" aria-label="${escapeXml(code)} ${escapeXml(location)}">
  <rect width="720" height="420" fill="#f8fafc"/>
  <rect x="32" y="30" width="656" height="360" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="68" y="112" width="470" height="170" rx="18" fill="#e2e8f0" stroke="#64748b" stroke-width="3"/>
  <rect x="96" y="142" width="126" height="88" rx="12" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/>
  <rect x="252" y="136" width="110" height="98" rx="12" fill="#cbd5e1" stroke="#64748b" stroke-width="2"/>
  <rect x="392" y="126" width="110" height="118" rx="12" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/>
  <path d="M112 288h386" stroke="#475569" stroke-width="10" stroke-linecap="round"/>
  <circle cx="${focusX}" cy="${focusY}" r="42" fill="#f97316" fill-opacity="0.2" stroke="#ea580c" stroke-width="6"/>
  <path d="M596 95 L${focusX + 28} ${focusY - 26}" stroke="#ea580c" stroke-width="8" stroke-linecap="round"/>
  <path d="M${focusX + 28} ${focusY - 26} l25 -7 l-8 24 z" fill="#ea580c"/>
  <text x="64" y="72" fill="#0f172a" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="28" font-weight="700">${escapeXml(typeLabel)}</text>
  <text x="64" y="100" fill="#475569" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="18">${escapeXml(code)}</text>
  <rect x="470" y="284" width="184" height="58" rx="14" fill="#fff7ed" stroke="#fdba74" stroke-width="2"/>
  <text x="492" y="307" fill="#9a3412" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="16" font-weight="700">점검 위치</text>
  <text x="492" y="331" fill="#0f172a" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="20" font-weight="700">${escapeXml(location)}</text>
  <text x="72" y="348" fill="#334155" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="15">작업자는 주황색 표시 위치를 확인한 뒤 점검 결과를 입력합니다.</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });

const updates = [];
for (const item of items) {
  const [code] = item;
  const filename = `${slug(code)}.svg`;
  writeFileSync(join(outDir, filename), svgFor(item), "utf8");
  updates.push(
    `UPDATE EQUIP_INSPECT_ITEM_MASTERS
   SET IMAGE_URL = '/uploads/equip-inspect-items/${filename}',
       UPDATED_BY = 'codex',
       UPDATED_AT = SYSTIMESTAMP
 WHERE COMPANY = '40'
   AND PLANT_CD = '1000'
   AND ITEM_CODE = '${code}';`,
  );
}

writeFileSync(`${migrationPath}`, `${updates.join("\n/\n\n")}\n/\n\nCOMMIT;\n/\n`, "utf8");

console.log(`generated ${items.length} SVG files`);
console.log(migrationPath);

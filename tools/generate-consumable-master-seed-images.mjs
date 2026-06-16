import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "apps", "backend", "uploads", "consumables");
const migrationPath = join(
  process.cwd(),
  "apps",
  "backend",
  "src",
  "migrations",
  "2026-06-16_consumable_master_image_seed.sql",
);

const categoryMeta = {
  JIG: {
    label: "JIG",
    name: "검사/고정 지그",
    fill: "#dbeafe",
    stroke: "#2563eb",
    accent: "#1d4ed8",
  },
  MOLD: {
    label: "MOLD",
    name: "압착 금형",
    fill: "#fef3c7",
    stroke: "#d97706",
    accent: "#92400e",
  },
  TOOL: {
    label: "TOOL",
    name: "공구/소모품",
    fill: "#dcfce7",
    stroke: "#16a34a",
    accent: "#166534",
  },
};

const items = [
  ["CM-JG-CT1", "통전검사 치구 A타입", "JIG", "지그실-E1"],
  ["CM-JG-CT2", "통전검사 치구 B타입", "JIG", "지그실-E2"],
  ["CM-JG-HV1", "내전압검사 치구", "JIG", "지그실-E3"],
  ["CM-JG-SL1", "쉴삽입 가이드 지그", "JIG", "지그실-E4"],
  ["CM-JG-TW1", "트위스트 고정 지그", "JIG", "지그실-E5"],
  ["JIGHD-A", "지그홀더A", "JIG", "지그 보관 위치"],
  ["JIGHD-B", "지그홀더B", "JIG", "지그 보관 위치"],
  ["JIGHD-C", "지그홀더C", "JIG", "지그 보관 위치"],
  ["JIGHD-D", "지그홀더D", "JIG", "지그 보관 위치"],
  ["CM-AP-040", "040단자 압착금형", "MOLD", "금형실-A3"],
  ["CM-AP-060", "060단자 압착금형", "MOLD", "금형실-A6"],
  ["CM-AP-090", "090단자 압착금형", "MOLD", "금형실-A5"],
  ["CM-AP-110", "110단자 압착금형", "MOLD", "금형실-A1"],
  ["CM-AP-187", "187단자 압착금형", "MOLD", "금형실-A4"],
  ["CM-AP-250", "250단자 압착금형", "MOLD", "금형실-A2"],
  ["APPCT-A", "어플리케이터A", "TOOL", "공구 보관 위치"],
  ["APPCT-B", "어플리케이터B", "TOOL", "공구 보관 위치"],
  ["APPCT-SE", "어플리케이터SE", "TOOL", "공구 보관 위치"],
  ["CM-BL-F01", "평블레이드 세트 (절단용)", "TOOL", "공구실-B2"],
  ["CM-BL-MC1", "다선절단 블레이드 세트", "TOOL", "공구실-B5"],
  ["CM-BL-S01", "탈피 블레이드 세트 (V타입)", "TOOL", "공구실-B3"],
  ["CM-BL-S02", "탈피 블레이드 세트 (로터리)", "TOOL", "공구실-B4"],
  ["CM-BL-V01", "V블레이드 세트 (절단용)", "TOOL", "공구실-B1"],
  ["CM-FL-A01", "에어 필터 엘리먼트", "TOOL", "공구실-F1"],
  ["CM-FL-D01", "집진 필터 백", "TOOL", "공구실-F2"],
  ["CM-IJ-I01", "잉크젯 잉크 카트리지", "TOOL", "공구실-D4"],
  ["CM-IJ-N01", "잉크젯 노즐 세트", "TOOL", "공구실-D3"],
  ["CM-PH-B01", "써멀 프린트헤드 (Brady)", "TOOL", "공구실-D2"],
  ["CM-PH-Z01", "써멀 프린트헤드 (Zebra)", "TOOL", "공구실-D1"],
  ["CM-ST-T01", "납땜 인두팁 (자동납땜용)", "TOOL", "공구실-C3"],
  ["CM-UW-A01", "초음파 앤빌", "TOOL", "공구실-C2"],
  ["CM-UW-H01", "초음파 혼 (Sonotrode)", "TOOL", "공구실-C1"],
  ["CUTBL001", "커터날1", "TOOL", "절단 공구 위치"],
  ["CUTBL002", "커터날2", "TOOL", "절단 공구 위치"],
  ["CUTBL003", "커터날3", "TOOL", "절단 공구 위치"],
  ["CUTBL004", "커터날4", "TOOL", "절단 공구 위치"],
  ["CUTBL009", "커터날9", "TOOL", "절단 공구 위치"],
];

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slug = (code) => code.toLowerCase().replaceAll("-", "_");

function partShape(category, meta) {
  if (category === "MOLD") {
    return `
  <rect x="178" y="132" width="158" height="146" rx="18" fill="#fbbf24" stroke="${meta.stroke}" stroke-width="5"/>
  <rect x="384" y="132" width="158" height="146" rx="18" fill="#fde68a" stroke="${meta.stroke}" stroke-width="5"/>
  <path d="M336 205h48" stroke="${meta.accent}" stroke-width="16" stroke-linecap="round"/>
  <circle cx="257" cy="205" r="38" fill="#fff7ed" stroke="${meta.accent}" stroke-width="6"/>
  <circle cx="463" cy="205" r="38" fill="#fff7ed" stroke="${meta.accent}" stroke-width="6"/>`;
  }

  if (category === "JIG") {
    return `
  <rect x="160" y="156" width="400" height="116" rx="18" fill="#bfdbfe" stroke="${meta.stroke}" stroke-width="5"/>
  <rect x="202" y="188" width="98" height="46" rx="10" fill="#eff6ff" stroke="${meta.accent}" stroke-width="4"/>
  <rect x="420" y="188" width="98" height="46" rx="10" fill="#eff6ff" stroke="${meta.accent}" stroke-width="4"/>
  <path d="M318 214h84" stroke="${meta.accent}" stroke-width="12" stroke-linecap="round"/>
  <circle cx="188" cy="272" r="16" fill="#1d4ed8"/>
  <circle cx="532" cy="272" r="16" fill="#1d4ed8"/>`;
  }

  return `
  <path d="M200 278l88-124 54 38-88 124c-13 19-39 23-58 10s-23-39-10-58z" fill="#86efac" stroke="${meta.stroke}" stroke-width="5"/>
  <rect x="338" y="130" width="158" height="58" rx="18" fill="#bbf7d0" stroke="${meta.stroke}" stroke-width="5"/>
  <path d="M484 188l44 84" stroke="${meta.accent}" stroke-width="18" stroke-linecap="round"/>
  <path d="M338 188l-44 84" stroke="${meta.accent}" stroke-width="18" stroke-linecap="round"/>
  <circle cx="417" cy="159" r="18" fill="#f0fdf4" stroke="${meta.accent}" stroke-width="5"/>`;
}

function svgFor([code, name, category, location]) {
  const meta = categoryMeta[category] ?? categoryMeta.TOOL;
  const safeName = escapeXml(name);
  const safeCode = escapeXml(code);
  const safeLocation = escapeXml(location || "소모품 보관 위치");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420" role="img" aria-label="${safeCode} ${safeName}">
  <rect width="720" height="420" fill="#f8fafc"/>
  <rect x="32" y="30" width="656" height="360" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="64" y="62" width="158" height="42" rx="21" fill="${meta.fill}" stroke="${meta.stroke}" stroke-width="2"/>
  <text x="92" y="90" fill="${meta.accent}" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="20" font-weight="700">${meta.label}</text>
  <text x="246" y="90" fill="#0f172a" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="26" font-weight="700">${escapeXml(meta.name)}</text>
  ${partShape(category, meta)}
  <rect x="70" y="306" width="580" height="54" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <text x="94" y="329" fill="#475569" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="15">${safeCode}</text>
  <text x="94" y="352" fill="#0f172a" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="22" font-weight="700">${safeName}</text>
  <text x="472" y="352" fill="#64748b" font-family="Arial, 'Malgun Gothic', sans-serif" font-size="16">${safeLocation}</text>
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
    `UPDATE CONSUMABLE_MASTERS
   SET IMAGE_URL = '/uploads/consumables/${filename}',
       UPDATED_BY = 'codex',
       UPDATED_AT = SYSTIMESTAMP
 WHERE COMPANY = '40'
   AND PLANT_CD = '1000'
   AND CONSUMABLE_CODE = '${code}';`,
  );
}

writeFileSync(migrationPath, `${updates.join("\n/\n\n")}\n/\n\nCOMMIT;\n/\n`, "utf8");

console.log(`generated ${items.length} SVG files`);
console.log(migrationPath);

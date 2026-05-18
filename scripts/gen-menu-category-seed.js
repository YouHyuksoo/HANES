#!/usr/bin/env node
/**
 * @file scripts/gen-menu-category-seed.js
 * @description menuConfig.ts를 파싱하여 MENU_CATEGORIES / MENU_CATEGORY_ITEMS 시드 SQL을 생성한다.
 *
 * 출력: scripts/2026-05-18_seed_menu_categories.sql
 * 사용: node scripts/gen-menu-category-seed.js
 */
const fs = require('fs');
const path = require('path');

const MENU_CONFIG_PATH = path.resolve(__dirname, '../apps/frontend/src/config/menuConfig.ts');
const OUTPUT_PATH = path.resolve(__dirname, '2026-05-18_seed_menu_categories.sql');

const SINGLE_TOP_MENUS = new Set(['DASHBOARD', 'WORKFLOW']);
const COMPANY = 'HANES';
const PLANT_CD = '-';
const SYSTEM_USER = 'system';

const source = fs.readFileSync(MENU_CONFIG_PATH, 'utf-8');

/**
 * menuConfig.ts 소스를 파싱하여 최상위 카테고리와 하위 메뉴 항목을 추출한다.
 *
 * 파싱 전략:
 *  1. 최상위 블록: `code: "XXX"` + `icon: YYY` 패턴으로 최상위 항목 추출
 *  2. children 블록: 최상위 항목 다음에 오는 `children: [...]` 내부에서
 *     `code: "LEAF_CODE"` 패턴으로 리프 코드 추출
 *
 * @param {string} source - menuConfig.ts 원본 소스 문자열
 * @returns {{ categories: Array<{code,labelKey,iconName}>, items: Array<{menuCode,categoryCode}> }}
 */
function extractMenuConfig(source) {
  const categories = [];
  const items = [];

  // 최상위 블록을 { ... } 단위로 추출하기 위해 menuConfig 배열 본문만 잘라냄
  const arrayMatch = source.match(/export const menuConfig[^=]+=\s*\[([\s\S]*)\];/);
  if (!arrayMatch) {
    throw new Error('menuConfig 배열을 찾을 수 없습니다.');
  }
  const arrayBody = arrayMatch[1];

  // 최상위 항목 경계 탐색 — 중첩 { } 카운팅으로 각 최상위 객체 추출
  let depth = 0;
  let start = -1;
  const topBlocks = [];

  for (let i = 0; i < arrayBody.length; i++) {
    const ch = arrayBody[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        topBlocks.push(arrayBody.slice(start, i + 1));
        start = -1;
      }
    }
  }

  for (const block of topBlocks) {
    // 최상위 code 추출
    const codeMatch = block.match(/^\s*\{\s*(?:\/\*[^*]*\*\/\s*)?code:\s*"([A-Z_][A-Z0-9_]*)"/m);
    if (!codeMatch) continue;
    const code = codeMatch[1];

    // labelKey 추출
    const labelMatch = block.match(/labelKey:\s*"([^"]+)"/);
    const labelKey = labelMatch ? labelMatch[1] : `menu.${code.toLowerCase()}`;

    // icon 추출 (아이콘 컴포넌트 이름)
    const iconMatch = block.match(/icon:\s*([A-Za-z][A-Za-z0-9]*)/);
    const iconName = iconMatch ? iconMatch[1] : null;

    categories.push({ code, labelKey, iconName });

    // children 블록 추출 — children: [ ... ] 내부를 중첩 브래킷 파싱으로 추출
    const childrenKeyIdx = block.indexOf('children:');
    if (childrenKeyIdx === -1) continue;

    const bracketStart = block.indexOf('[', childrenKeyIdx);
    if (bracketStart === -1) continue;

    let cdepth = 0;
    let cstart = bracketStart;
    let cend = -1;
    for (let i = bracketStart; i < block.length; i++) {
      if (block[i] === '[') cdepth++;
      else if (block[i] === ']') {
        cdepth--;
        if (cdepth === 0) { cend = i; break; }
      }
    }
    if (cend === -1) continue;

    const childrenBody = block.slice(cstart + 1, cend);

    // children 내부에서 각 리프 code 추출
    const leafCodeRegex = /code:\s*"([A-Z_][A-Z0-9_]*)"/g;
    let lm;
    while ((lm = leafCodeRegex.exec(childrenBody)) !== null) {
      items.push({ menuCode: lm[1], categoryCode: code });
    }
  }

  return { categories, items };
}

const { categories, items } = extractMenuConfig(source);

// ---- SQL 생성 ----
const lines = [];
lines.push('-- ============================================================================');
lines.push('-- 2026-05-18 좌측 메뉴 카테고리/순서 — 초기 시드');
lines.push('-- 생성: scripts/gen-menu-category-seed.js (자동 생성, 직접 편집 금지)');
lines.push('-- ============================================================================');
lines.push('');

// __ROOT__ 카테고리 시드
lines.push(`INSERT INTO MENU_CATEGORIES (CATEGORY_CODE, LABEL_KEY, ICON_NAME, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)`);
lines.push(`VALUES ('__ROOT__', 'menu.root', NULL, 0, 'Y', '${COMPANY}', '${PLANT_CD}', SYSTIMESTAMP, '${SYSTEM_USER}', SYSTIMESTAMP, '${SYSTEM_USER}');`);
lines.push('');

// 실제 카테고리 시드 (SINGLE_TOP_MENUS 제외)
let sortOrder = 10;
const realCategories = categories.filter((c) => !SINGLE_TOP_MENUS.has(c.code));
for (const c of realCategories) {
  lines.push(`INSERT INTO MENU_CATEGORIES (CATEGORY_CODE, LABEL_KEY, ICON_NAME, SORT_ORDER, IS_ACTIVE, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)`);
  lines.push(`VALUES ('${c.code}', '${c.labelKey}', '${c.iconName}', ${sortOrder}, 'Y', '${COMPANY}', '${PLANT_CD}', SYSTIMESTAMP, '${SYSTEM_USER}', SYSTIMESTAMP, '${SYSTEM_USER}');`);
  sortOrder += 10;
}
lines.push('');

// 메뉴 배치 시드
const orderInCategory = new Map();
const nextOrder = (cat) => {
  const v = (orderInCategory.get(cat) ?? 0) + 10;
  orderInCategory.set(cat, v);
  return v;
};

// 단독 메뉴(DASHBOARD, WORKFLOW)는 __ROOT__에 배치
for (const c of categories) {
  if (SINGLE_TOP_MENUS.has(c.code)) {
    const so = nextOrder('__ROOT__');
    lines.push(`INSERT INTO MENU_CATEGORY_ITEMS (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)`);
    lines.push(`VALUES ('${c.code}', '__ROOT__', ${so}, '${COMPANY}', '${PLANT_CD}', SYSTIMESTAMP, '${SYSTEM_USER}', SYSTIMESTAMP, '${SYSTEM_USER}');`);
  }
}

// children 항목은 각 카테고리에 배치
for (const i of items) {
  const so = nextOrder(i.categoryCode);
  lines.push(`INSERT INTO MENU_CATEGORY_ITEMS (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)`);
  lines.push(`VALUES ('${i.menuCode}', '${i.categoryCode}', ${so}, '${COMPANY}', '${PLANT_CD}', SYSTIMESTAMP, '${SYSTEM_USER}', SYSTIMESTAMP, '${SYSTEM_USER}');`);
}

lines.push('');
lines.push('COMMIT;');
lines.push('');

fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8');

// ---- 통계 보고 ----
const singleTopInConfig = Array.from(SINGLE_TOP_MENUS).filter((c) => categories.some((cc) => cc.code === c));
const totalItems = items.length + singleTopInConfig.length;

console.log(`Wrote: ${OUTPUT_PATH}`);
console.log(`Categories: ${realCategories.length + 1} (including __ROOT__)`);
console.log(`Items: ${totalItems}`);
console.log(`  - Single-top menus mapped to __ROOT__: ${singleTopInConfig.join(', ')}`);
console.log(`  - Leaf items in categories: ${items.length}`);

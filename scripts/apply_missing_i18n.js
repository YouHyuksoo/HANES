/**
 * missing_i18n.json(ko fallback) + i18n_translations.json(en/zh/vi)을 합쳐
 * ko/en/zh/vi 4개 locales에 점경로 중첩 삽입한다.
 * - 기존 키는 절대 덮어쓰지 않음(신규만 추가)
 * - 중간 경로가 기존 leaf 문자열이면 충돌로 보고하고 해당 키 스킵
 * - BOM 없는 UTF-8, 2-space indent
 */
const fs = require('fs');

const missing = JSON.parse(fs.readFileSync('scripts/missing_i18n.json', 'utf8'));
const trans = JSON.parse(fs.readFileSync('scripts/i18n_translations.json', 'utf8'));

const conflicts = [];
const noTrans = [];

function tryInsert(json, pathArr, val) {
  let o = json;
  for (let i = 0; i < pathArr.length - 1; i++) {
    const k = pathArr[i];
    if (o[k] === undefined) o[k] = {};
    else if (typeof o[k] !== 'object' || o[k] === null) return 'conflict'; // leaf가 막음
    o = o[k];
  }
  const last = pathArr[pathArr.length - 1];
  if (last in o) return 'exists';
  o[last] = val;
  return 'added';
}

const summary = {};
for (const lang of ['ko', 'en', 'zh', 'vi']) {
  const file = `apps/frontend/src/locales/${lang}.json`;
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  let added = 0, skipped = 0;
  for (const [key, info] of Object.entries(missing)) {
    const val = lang === 'ko' ? info.fallback : (trans[key] && trans[key][lang]);
    if (val == null) { if (lang === 'en') noTrans.push(key); continue; }
    const res = tryInsert(json, key.split('.'), val);
    if (res === 'added') added++;
    else if (res === 'exists') skipped++;
    else if (res === 'conflict' && lang === 'ko') conflicts.push(key);
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  summary[lang] = { added, skipped };
}

console.log('삽입 결과:', JSON.stringify(summary));
if (noTrans.length) console.log('번역 누락 키(en/zh/vi 없음):', noTrans.length, noTrans.slice(0, 10));
if (conflicts.length) console.log('경로 충돌(leaf가 막음):', conflicts);

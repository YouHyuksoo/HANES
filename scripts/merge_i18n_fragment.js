/**
 * i18n 조각 파일을 ko/en/zh/vi 4개 locale에 병합한다.
 *
 * 조각 형식(JSON):
 *   { "consumables.master.fieldHelp.consumableCode": { "ko": "...", "en": "...", "zh": "...", "vi": "..." }, ... }
 *
 * 사용: node scripts/merge_i18n_fragment.js <fragment.json> [<fragment2.json> ...]
 * - 기존 키는 --overwrite 를 주지 않는 한 덮어쓰지 않는다.
 * - 4개 언어가 모두 있어야 삽입한다(누락 시 해당 키 보고 후 스킵).
 * - BOM 없는 UTF-8, 2-space indent (apply_missing_i18n.js 와 같은 포맷).
 */
const fs = require('fs');
const path = require('path');

const LANGS = ['ko', 'en', 'zh', 'vi'];
const args = process.argv.slice(2);
const overwrite = args.includes('--overwrite');
const files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.error('usage: node scripts/merge_i18n_fragment.js <fragment.json> [...] [--overwrite]');
  process.exit(1);
}

const fragment = {};
for (const f of files) Object.assign(fragment, JSON.parse(fs.readFileSync(f, 'utf8')));

const incomplete = Object.entries(fragment).filter(([, v]) => !LANGS.every((l) => typeof v[l] === 'string' && v[l].trim()));
if (incomplete.length) {
  console.error('4개 언어가 모두 없는 키(스킵):', incomplete.map(([k]) => k));
}

function setPath(json, pathArr, val) {
  let o = json;
  for (let i = 0; i < pathArr.length - 1; i += 1) {
    const k = pathArr[i];
    if (o[k] === undefined) o[k] = {};
    else if (typeof o[k] !== 'object' || o[k] === null) return 'conflict';
    o = o[k];
  }
  const last = pathArr[pathArr.length - 1];
  if (last in o && !overwrite) return 'exists';
  o[last] = val;
  return 'added';
}

const summary = {};
for (const lang of LANGS) {
  const file = path.join('apps/frontend/src/locales', `${lang}.json`);
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) throw new Error(`${file} 에 BOM이 있습니다`);
  const json = JSON.parse(raw);
  let added = 0; let exists = 0; const conflicts = [];
  for (const [key, v] of Object.entries(fragment)) {
    if (!LANGS.every((l) => typeof v[l] === 'string' && v[l].trim())) continue;
    const r = setPath(json, key.split('.'), v[lang]);
    if (r === 'added') added += 1;
    else if (r === 'exists') exists += 1;
    else conflicts.push(key);
  }
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, { encoding: 'utf8' });
  summary[lang] = { added, exists, conflicts };
}
console.log(JSON.stringify(summary));

/**
 * 코드의 t('key','한글 fallback') 호출 중 locales(ko.json)에 키가 없는 것(=번역 누락) 추출.
 * 결과: scripts/missing_i18n.json
 */
const fs = require('fs');
const path = require('path');

const root = 'apps/frontend/src';
const ko = JSON.parse(fs.readFileSync('apps/frontend/src/locales/ko.json', 'utf8'));

const keys = new Set();
(function flat(o, p) {
  for (const k in o) {
    const np = p ? p + '.' + k : k;
    if (o[k] && typeof o[k] === 'object') flat(o[k], np);
    else keys.add(np);
  }
})(ko, '');

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const fp = path.join(d, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp);
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) files.push(fp);
  }
})(root);

// t('key', 'fallback') / t("key", "fallback") — 리터럴 2-arg만
const re = /\bt\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*?)['"]/g;
const missing = new Map();
for (const fp of files) {
  const c = fs.readFileSync(fp, 'utf8');
  let m;
  while ((m = re.exec(c))) {
    const key = m[1], fb = m[2];
    if (!keys.has(key) && /[가-힣]/.test(fb) && !missing.has(key)) {
      missing.set(key, { fallback: fb, file: path.relative(root, fp).replace(/\\/g, '/') });
    }
  }
}

const obj = Object.fromEntries(missing);
fs.writeFileSync('scripts/missing_i18n.json', JSON.stringify(obj, null, 2));
console.log('총 한글 fallback 호출 파일:', files.length);
console.log('locales에 없는 누락 키(한글 fallback):', missing.size);

// 최상위 네임스페이스별 분포
const byNs = {};
for (const k of missing.keys()) {
  const ns = k.split('.')[0] + '.' + (k.split('.')[1] || '');
  byNs[ns] = (byNs[ns] || 0) + 1;
}
console.log('네임스페이스별 분포:');
Object.entries(byNs).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

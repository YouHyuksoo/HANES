/**
 * T-COMCODE-SEMANTIC-FIX 후속: 잘못 추가됐다가 DB에서 제거된 3개 코드의 i18n dead 키 정리.
 * - comCode.ARRIVAL_PO_TYPE.PO        (그룹이 PO만 있으면 그룹째 제거)
 * - comCode.ARRIVAL_RESULT_STATUS.DONE (그룹이 DONE만 있으면 그룹째 제거)
 * - comCode.RECEIVE_STATUS.DONE       (그룹의 다른 코드는 보존, DONE만 제거)
 * 표시에 쓰이지 않는 dead 키만 제거. BOM 미사용, 2-space, trailing newline.
 * 실행: node tools/cleanup-comcode-i18n-deadkeys.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const REMOVE = {
  ARRIVAL_PO_TYPE: ['PO'],
  ARRIVAL_RESULT_STATUS: ['DONE'],
  RECEIVE_STATUS: ['DONE'],
};

const LOCALES = ['ko', 'en', 'zh', 'vi'];
const baseDir = 'apps/frontend/src/locales';
let total = 0;

for (const loc of LOCALES) {
  const path = `${baseDir}/${loc}.json`;
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const cc = json.comCode || {};
  let removed = 0;
  for (const [group, codes] of Object.entries(REMOVE)) {
    if (!cc[group]) continue;
    for (const code of codes) {
      if (cc[group][code] !== undefined) {
        delete cc[group][code];
        removed++;
      }
    }
    // 코드가 모두 사라진 그룹 객체는 제거
    if (Object.keys(cc[group]).length === 0) {
      delete cc[group];
    }
  }
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${loc}.json: -${removed} keys`);
  total += removed;
}
console.log(`TOTAL removed: ${total}`);

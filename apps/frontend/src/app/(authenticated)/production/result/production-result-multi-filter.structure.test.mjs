import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const multi = readFileSync(new URL('../../../../components/shared/MultiSelectFilter.tsx', import.meta.url), 'utf8');
const sharedIndex = readFileSync(new URL('../../../../components/shared/index.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../../../../../../backend/src/modules/production/services/prod-result.service.ts', import.meta.url), 'utf8');
const locales = Object.fromEntries(
  ['ko', 'en', 'zh', 'vi'].map((lang) => [lang, JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8'))]),
);

test('shared MultiSelectFilter exists, is exported, and takes string[] value/onChange', () => {
  assert.match(sharedIndex, /export \{ default as MultiSelectFilter \} from "\.\/MultiSelectFilter";/);
  assert.match(multi, /value:\s*string\[\];/);
  assert.match(multi, /onChange:\s*\(values:\s*string\[\]\)\s*=>\s*void;/);
  assert.match(multi, /createPortal\(/);
  assert.match(multi, /type="checkbox"/);
  assert.match(multi, /common\.selectAll/);
  assert.match(multi, /common\.deselectAll/);
  assert.match(multi, /common\.selectedCount/);
  assert.match(multi, /common\.clear/);
  // 코드성 값 자유 입력 금지 — 옵션 기반 체크 목록만 사용
  assert.doesNotMatch(multi, /<Input/);
});

test('/production/result uses MultiSelectFilter for process and equipment instead of single Select', () => {
  assert.match(page, /import \{ QtyInput, MultiSelectFilter \} from '@\/components\/shared';/);
  assert.doesNotMatch(page, /<Select /);
  assert.match(page, /const \[processTypeFilter, setProcessTypeFilter\] = useState<string\[\]>\(\[\]\);/);
  assert.match(page, /const \[equipFilter, setEquipFilter\] = useState<string\[\]>\(\[\]\);/);
  assert.match(page, /<MultiSelectFilter options=\{processTypeOptions\} value=\{processTypeFilter\} onChange=\{setProcessTypeFilter\}/);
  assert.match(page, /<MultiSelectFilter options=\{equipOptions\} value=\{equipFilter\} onChange=\{setEquipFilter\}/);
  // '' 전체 옵션을 옵션 목록에 섞지 않는다 (미선택 = 전체)
  assert.doesNotMatch(page, /value: '', label: t\('production\.order\.processAll'\)/);
  assert.doesNotMatch(page, /production\.result\.equipAll/);
  // PROD_RESULTS.PROCESS_CODE 는 공정 마스터 코드 → PROCESS_TYPE 공통코드/하드코딩 목록 금지
  assert.match(page, /const \{ options: processTypeOptions \} = useProcessOptions\(\);/);
  assert.doesNotMatch(page, /useComCodeOptions\('PROCESS_TYPE'\)/);
  assert.doesNotMatch(page, /\['CUT','CRIMP','ASSY','INSP','PACK'\]/);
});

test('/production/result sends multi values as comma separated params and backend expands them to IN', () => {
  assert.match(page, /if \(processTypeFilter\.length > 0\) params\.processCode = processTypeFilter\.join\(','\);/);
  assert.match(page, /if \(equipFilter\.length > 0\) params\.equipCode = equipFilter\.join\(','\);/);
  assert.match(service, /import \{ parseCsvList \} from '\.\.\/\.\.\/\.\.\/common\/utils\/csv-list\.util';/);
  assert.match(service, /pr\.processCode IN \(:\.\.\.processCodes\)/);
  assert.match(service, /pr\.equipCode IN \(:\.\.\.equipCodes\)/);
});

test('MultiSelectFilter i18n keys exist in all four locales', () => {
  for (const [lang, json] of Object.entries(locales)) {
    for (const key of ['all', 'selectAll', 'deselectAll', 'selectedCount', 'clear', 'close', 'searchPlaceholder', 'noData']) {
      assert.ok(json.common?.[key], `${lang} common.${key}`);
    }
    assert.ok(json.production.result.processCol, `${lang} processCol`);
    assert.ok(json.production.result.equipment, `${lang} equipment`);
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('IQC inspect method screens use the IQC-specific method code group', () => {
  const files = [
    'apps/frontend/src/app/(authenticated)/master/part/page.tsx',
    'apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx',
    'apps/frontend/src/app/(authenticated)/master/part/components/IqcSettingModal.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupTab.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupModal.tsx',
    'apps/frontend/src/app/(authenticated)/material/iqc/page.tsx',
    'apps/frontend/src/components/material/IqcTable.tsx',
  ];

  for (const file of files) {
    const source = read(file);
    assert.match(source, /IQC_INSPECT_METHOD/, `${file} should use IQC_INSPECT_METHOD`);
  }
});

test('IQC history inspect type uses IQC-specific type code group', () => {
  const source = read('apps/frontend/src/app/(authenticated)/material/iqc-history/page.tsx');
  assert.match(source, /IQC_INSPECT_TYPE/);
  assert.doesNotMatch(source, /groupCode="IQC_TYPE"/);
});

test('IQC inspect input no longer submits legacy NONE inspect class', () => {
  const source = read('apps/frontend/src/components/material/IqcModal.tsx');
  assert.doesNotMatch(source, /value:\s*"NONE"/);
  assert.doesNotMatch(source, /inspectClass:\s*extra\?\.inspectClass/);
  assert.doesNotMatch(source, /selectedItem\.inspectMethod/);
});

test('IQC inspect method labels are only inspection or no-inspection', () => {
  const files = [
    'apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql',
    'apps/frontend/src/app/(authenticated)/master/part/page.tsx',
    'apps/frontend/src/app/(authenticated)/master/part/components/IqcSettingModal.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupTab.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupModal.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcLinkModal.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcLinkTab.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcDetailPanel.tsx',
    'apps/frontend/src/components/material/IqcTable.tsx',
  ];

  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /전수검사|샘플검사|선별검사/, `${file} should not expose split IQC method labels`);
  }

  const ko = JSON.parse(read('apps/frontend/src/locales/ko.json'));
  assert.equal(ko.menu['master.part.iqc.methodFull'], '검사');
  assert.equal(ko.master.iqcGroup.methodFull, '검사');
});

test('IQC inspection/no-inspection field labels use one Korean term', () => {
  const ko = JSON.parse(read('apps/frontend/src/locales/ko.json'));
  const labels = [
    ko.menu['master.part.iqc.inspectMethod'],
    ko.master.part.inspectMethod,
    ko.master.iqcGroup.inspectMethod,
    ko.material.iqc.method,
  ];

  assert.deepEqual(labels, ['검사구분', '검사구분', '검사구분', '검사구분']);

  const files = [
    'apps/frontend/src/app/(authenticated)/master/part/page.tsx',
    'apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupTab.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupModal.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcLinkTab.tsx',
    'apps/frontend/src/app/(authenticated)/material/iqc/page.tsx',
    'apps/frontend/src/components/material/IqcTable.tsx',
    'apps/frontend/src/components/material/IqcModal.tsx',
  ];

  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /검사방법|검사형태|검사분류/, `${file} should not use mixed IQC field labels`);
  }
});

test('IQC inspection method axis no longer exposes SAMPLE', () => {
  const forbiddenFiles = [
    'apps/backend/src/modules/master/dto/iqc-group.dto.ts',
    'apps/backend/src/modules/master/services/iqc-group.service.ts',
    'apps/frontend/src/app/(authenticated)/master/part/page.tsx',
    'apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx',
    'apps/frontend/src/app/(authenticated)/master/part/components/IqcSettingModal.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/types.ts',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupTab.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcGroupModal.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcLinkModal.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcLinkTab.tsx',
    'apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcDetailPanel.tsx',
    'apps/frontend/src/components/material/IqcTable.tsx',
  ];

  for (const file of forbiddenFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /\bSAMPLE\b|methodSample|inspectSample/, `${file} should not expose SAMPLE as an IQC inspection method`);
  }

  const ko = JSON.parse(read('apps/frontend/src/locales/ko.json'));
  assert.equal(ko.menu['master.part.iqc.methodFull'], '검사');
  assert.equal(ko.menu['master.part.iqc.methodSkip'], '무검사');
  assert.equal(ko.master.iqcGroup.methodFull, '검사');
  assert.equal(ko.master.iqcGroup.methodSkip, '무검사');
  assert.equal(ko.menu['master.part.iqc.methodSample'], undefined);
  assert.equal(ko.master.iqcGroup.methodSample, undefined);

  const migration = read('apps/backend/src/migrations/2026-06-11_iqc_inspect_code_groups.sql');
  assert.doesNotMatch(migration, /SELECT 'IQC_INSPECT_METHOD', 'SAMPLE'/);
  assert.match(migration, /GROUP_CODE = 'IQC_INSPECT_METHOD'[\s\S]+DETAIL_CODE = 'SAMPLE'/);

  const sharedConstants = read('packages/shared/src/constants/com-code-values.ts');
  assert.match(sharedConstants, /IQC_INSPECT_METHOD_VALUES = \['FULL', 'SKIP'\]/);
});

test('IQC result modal does not map inspection method into INSPECT_CLASS', () => {
  const source = read('apps/frontend/src/components/material/IqcModal.tsx');

  assert.doesNotMatch(source, /selectedItem\.inspectMethod\s*\|\|\s*"SAMPLE"/);
  assert.doesNotMatch(source, /setInspectClass/);
  assert.doesNotMatch(source, /inspectClassOptions/);
  assert.doesNotMatch(source, /inspectClass,/);
});

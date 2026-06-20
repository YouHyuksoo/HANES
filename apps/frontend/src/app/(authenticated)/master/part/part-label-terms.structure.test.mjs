import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/page.tsx', 'utf8');
const panel = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx', 'utf8');
const modal = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormModal.tsx', 'utf8');
const fieldHelp = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFieldHelp.tsx', 'utf8');
const partDto = fs.readFileSync('apps/backend/src/modules/master/dto/part.dto.ts', 'utf8');
const implementationRules = fs.readFileSync('docs/standards/implementation-rules.md', 'utf8');
const ko = JSON.parse(fs.readFileSync('apps/frontend/src/locales/ko.json', 'utf8'));
const combined = [page, panel, modal].join('\n');

test('/master/part uses the revised Korean quantity labels', () => {
  assert.equal(ko.master.part.boxQty, '박스장입수량');
  assert.equal(ko.master.part.minPackQty, '최소불출단위수량(자재)');
  assert.equal(ko.master.part.lotUnitQty, '묶음단위수량(생산공정품)');

  assert.match(page, /t\("master\.part\.boxQty", "박스장입수량"\)/);
  assert.match(page, /t\("master\.part\.minPackQty", "최소불출단위수량\(자재\)"\)/);
  assert.match(page, /t\("master\.part\.lotUnitQty", "묶음단위수량\(생산공정품\)"\)/);
  assert.match(panel, /t\("master\.part\.boxQty", "박스장입수량"\)/);
  assert.match(panel, /t\("master\.part\.minPackQty", "최소불출단위수량\(자재\)"\)/);
  assert.match(panel, /t\("master\.part\.lotUnitQty", "묶음단위수량\(생산공정품\)"\)/);
  assert.match(modal, /t\("master\.part\.boxQty", "박스장입수량"\)/);
  assert.match(modal, /t\("master\.part\.lotUnitQty", "묶음단위수량\(생산공정품\)"\)/);
});

test('/master/part no longer renders the vendor quantity section heading', () => {
  assert.doesNotMatch(combined, /t\("master\.part\.sectionQty"/);
  assert.doesNotMatch(combined, /거래처 \/ 수량관리/);
  assert.notEqual(ko.master.part.sectionQty, '거래처 / 수량관리');
});

test('/master/part box quantity supports typed input with packaging unit suggestions', () => {
  for (const source of [panel, modal]) {
    assert.match(source, /const PACKAGING_QTY_OPTIONS = \[10, 20, 30, 40, 50, 60, 70, 80, 90, 100\]/);
  }

  assert.match(panel, /list="part-panel-box-qty-options"/);
  assert.match(panel, /<datalist id="part-panel-box-qty-options">/);
  assert.match(modal, /list="part-modal-box-qty-options"/);
  assert.match(modal, /<datalist id="part-modal-box-qty-options">/);
  assert.match(combined, /PACKAGING_QTY_OPTIONS\.map\(qty => <option key=\{qty\} value=\{qty\} \/>\)/);
});

test('/master/part renames fixed storage location label', () => {
  assert.equal(ko.master.part.storageLocation, '품목고정 적재로케이션');
  assert.match(page, /t\("master\.part\.storageLocation", "품목고정 적재로케이션"\)/);
  assert.match(panel, /t\("master\.part\.storageLocation", "품목고정 적재로케이션"\)/);
  assert.match(modal, /t\("master\.part\.storageLocation", "품목고정 적재로케이션"\)/);
  assert.doesNotMatch(combined, /"적재로케이션"/);
  assert.doesNotMatch(combined, /"적재위치"/);
});

test('/master/part input labels expose help icons with db column names', () => {
  const expectedFields = [
    'itemCode', 'itemNo', 'itemName', 'custPartNo', 'rev', 'markingText',
    'itemType', 'productType', 'spec', 'color', 'length', 'stripBefore',
    'stripAfter', 'unit', 'iqcYn', 'inspectMethod', 'useYn', 'boxQty', 'minPackQty',
    'lotUnitQty', 'safetyStock', 'expiryDate', 'expiryExtDays', 'packUnit',
    'storageLocation', 'remark',
  ];

  for (const field of expectedFields) {
    assert.match(fieldHelp, new RegExp(`${field}: \\{ db: "ITEM_MASTERS\\.[A-Z_]+", description: ".+" \\}`));
    assert.match(panel, new RegExp(`field="${field}"`));
    assert.match(modal, new RegExp(`field="${field}"`));
  }

  assert.match(fieldHelp, /<CircleHelp className="w-3\.5 h-3\.5" \/>/);
  assert.match(fieldHelp, /DB: \$\{help\.db\}/);
  assert.match(fieldHelp, /data-part-field-help=\{field\}/);
});

test('/master/part removes unused tact time from the management screen', () => {
  assert.doesNotMatch(combined, /tactTime/);
  assert.doesNotMatch(combined, /TACT_TIME/);
  assert.doesNotMatch(combined, /택타임/);
});

test('/master/part uses selection controls for IQC policy codes and decimal input for basic sample quantity', () => {
  for (const source of [panel, modal]) {
    for (const field of ['inspectionLevel', 'aqlCritical', 'aqlMajor', 'aqlMinor']) {
      assert.doesNotMatch(source, new RegExp(`<FieldInput field="${field}"`));
    }

    assert.match(source, /useComCodeOptions\("IQC_INSPECT_METHOD", false\)/);
    assert.doesNotMatch(source, /<FieldSelect field="sampleQty"/);
    assert.match(source, /<FieldInput field="sampleQty" label=\{t\("master\.part\.basicSampleQty", "기본시료수"\)\} type="number" step="0\.001"/);
    assert.match(source, /<FieldComCodeSelect field="inspectionLevel" groupCode="AQL_INSP_LEVEL"/);
    assert.match(source, /<FieldComCodeSelect field="aqlCritical" groupCode="AQL_VALUE"/);
    assert.match(source, /<FieldComCodeSelect field="aqlMajor" groupCode="AQL_VALUE"/);
    assert.match(source, /<FieldComCodeSelect field="aqlMinor" groupCode="AQL_VALUE"/);
  }

  assert.doesNotMatch(modal, /value: "FULL"/);
  assert.doesNotMatch(modal, /value: "SKIP"/);
  assert.match(partDto, /@ApiPropertyOptional\(\{ description: '샘플검사 수량', example: 0\.5 \}\)[\s\S]*?@IsNumber\(\)[\s\S]*?sampleQty\?: number;/);
  assert.doesNotMatch(partDto, /@ApiPropertyOptional\(\{ description: '샘플검사 수량'[\s\S]*?@IsInt\(\)[\s\S]*?sampleQty\?: number;/);
  assert.match(implementationRules, /코드성·기준정보성 값은 자유입력 대신 공통코드 또는 기준정보 선택 컴포넌트를 우선 사용한다/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/page.tsx', 'utf8');
const partColumns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/partColumns.tsx', 'utf8');
const types = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/types.ts', 'utf8');
const panel = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx', 'utf8');
const modal = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormModal.tsx', 'utf8');
const fieldHelp = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFieldHelp.tsx', 'utf8');
const partDto = fs.readFileSync('apps/backend/src/modules/master/dto/part.dto.ts', 'utf8');
const partEntity = fs.readFileSync('apps/backend/src/entities/item-master.entity.ts', 'utf8');
const partService = fs.readFileSync('apps/backend/src/modules/master/services/part.service.ts', 'utf8');
const implementationRules = fs.readFileSync('docs/standards/implementation-rules.md', 'utf8');
const ko = JSON.parse(fs.readFileSync('apps/frontend/src/locales/ko.json', 'utf8'));
const combined = [page, partColumns, panel, modal].join('\n');

test('/master/part uses the revised Korean quantity labels', () => {
  assert.equal(ko.master.part.boxQty, '박스장입수량');
  assert.equal(ko.master.part.minPackQty, '최소불출단위수량(자재)');
  assert.equal(ko.master.part.lotUnitQty, '묶음단위수량(생산공정품)');

  assert.match(partColumns, /t\("master\.part\.boxQty", "박스장입수량"\)/);
  assert.match(partColumns, /t\("master\.part\.minPackQty", "최소불출단위수량\(자재\)"\)/);
  assert.match(partColumns, /t\("master\.part\.lotUnitQty", "묶음단위수량\(생산공정품\)"\)/);
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
  assert.match(partColumns, /t\("master\.part\.storageLocation", "품목고정 적재로케이션"\)/);
  assert.match(panel, /t\("master\.part\.storageLocation", "품목고정 적재로케이션"\)/);
  assert.match(modal, /t\("master\.part\.storageLocation", "품목고정 적재로케이션"\)/);
  assert.doesNotMatch(combined, /"적재로케이션"/);
  assert.doesNotMatch(combined, /"적재위치"/);
});

test('/master/part input labels expose help icons with db column names', () => {
  const expectedFields = [
    'itemCode', 'itemNo', 'itemName', 'custPartNo', 'rev', 'markingText',
    'itemType', 'productType', 'spec', 'color', 'unit', 'iqcYn', 'inspectMethod', 'useYn', 'boxQty', 'minPackQty',
    'lotUnitQty', 'safetyStock', 'expiryDate', 'expiryExtDays', 'packUnit',
    'storageLocation', 'remark',
  ];

  for (const field of expectedFields) {
    assert.match(fieldHelp, new RegExp(`${field}: \\{ db: "ITEM_MASTERS\\.[A-Z_]+", description: ".+" \\}`));
    assert.match(panel, new RegExp(`field="${field}"`));
    assert.match(modal, new RegExp(`field="${field}"`));
  }

  // 도움말 아이콘은 공통 HelpTooltip(포털 카드형)으로 렌더한다.
  assert.match(fieldHelp, /HelpTooltip/);
  assert.match(fieldHelp, /description=\{t\(`master\.part\.fieldHelp\.\$\{field\}`, help\.description\)\} db=\{help\.db\} dataField=\{field\}/);
});

test('/master/part removes unused tact time from the management screen', () => {
  assert.doesNotMatch(combined, /tactTime/);
  assert.doesNotMatch(combined, /TACT_TIME/);
  assert.doesNotMatch(combined, /택타임/);
});

test('/master/part uses an IQC AQL policy code selector and decimal input for basic sample quantity', () => {
  for (const source of [panel, modal]) {
    for (const field of ['inspectionLevel', 'aqlCritical', 'aqlMajor', 'aqlMinor']) {
      assert.doesNotMatch(source, new RegExp(`<FieldInput field="${field}"`));
      assert.doesNotMatch(source, new RegExp(`field="${field}"`));
      assert.doesNotMatch(source, new RegExp(`${field}: editingPart`));
      assert.doesNotMatch(source, new RegExp(`${field}: form`));
    }

    assert.match(source, /useComCodeOptions\("IQC_INSPECT_METHOD", false\)/);
    assert.doesNotMatch(source, /<FieldSelect field="sampleQty"/);
    assert.match(source, /<FieldInput field="sampleQty" label=\{t\("master\.part\.basicSampleQty", "기본시료수"\)\} type="number" step="0\.001"/);
    assert.match(source, /api\.get\(["']\/quality\/aql\/policies["']/);
    assert.match(source, /<FieldSelect field="iqcAqlPolicyCode" label=\{t\("master\.part\.iqcAqlPolicyCode", "AQL 정책"\)\}/);
  }

  assert.doesNotMatch(modal, /value: "FULL"/);
  assert.doesNotMatch(modal, /value: "SKIP"/);
  assert.match(partDto, /@ApiPropertyOptional\(\{ description: '샘플검사 수량', example: 0\.5 \}\)[\s\S]*?@IsNumber\(\)[\s\S]*?sampleQty\?: number;/);
  assert.doesNotMatch(partDto, /@ApiPropertyOptional\(\{ description: '샘플검사 수량'[\s\S]*?@IsInt\(\)[\s\S]*?sampleQty\?: number;/);
  assert.match(types, /iqcAqlPolicyCode\?: string \| null; \/\/ IQC AQL 정책 코드/);
  assert.match(partColumns, /accessorKey: "iqcAqlPolicyCode"[\s\S]*header: t\("master\.part\.iqcAqlPolicyCode", "AQL 정책"\)/);
  assert.match(partDto, /@ApiPropertyOptional\(\{ description: 'IQC AQL 정책 코드', example: 'AQLP-II-1\.0-2\.5' \}\)[\s\S]*?iqcAqlPolicyCode\?: string;/);
  assert.match(partEntity, /@Column\(\{ type: 'varchar2', name: 'IQC_AQL_POLICY_CODE', length: 50, nullable: true \}\)[\s\S]*?iqcAqlPolicyCode: string \| null;/);
  assert.match(partService, /iqcAqlPolicyCode: dto\.iqcAqlPolicyCode \?\? null/);
  for (const source of [types, partColumns, fieldHelp, partDto, partEntity, partService]) {
    assert.doesNotMatch(source, /inspectionLevel\?: string \| null; \/\/ AQL 검사수준/);
    assert.doesNotMatch(source, /aqlCritical\?: number \| null/);
    assert.doesNotMatch(source, /aqlMajor\?: number \| null/);
    assert.doesNotMatch(source, /aqlMinor\?: number \| null/);
    assert.doesNotMatch(source, /ITEM_MASTERS\.INSPECTION_LEVEL/);
    assert.doesNotMatch(source, /ITEM_MASTERS\.AQL_CRITICAL/);
    assert.doesNotMatch(source, /ITEM_MASTERS\.AQL_MAJOR/);
    assert.doesNotMatch(source, /ITEM_MASTERS\.AQL_MINOR/);
  }
  assert.match(implementationRules, /코드성·기준정보성 값은 자유입력 대신 공통코드 또는 기준정보 선택 컴포넌트를 우선 사용한다/);
});

test('/master/part exposes vehicle model name from ITEM_MASTERS.MODEL_NAME', () => {
  assert.equal(ko.master.part.modelName, '차종');

  assert.match(types, /modelName\?: string \| null; \/\/ 차종/);
  assert.match(partColumns, /accessorKey: "modelName"[\s\S]*header: t\("master\.part\.modelName", "차종"\)/);
  assert.match(partService, /p\.modelName LIKE :searchRaw/);

  for (const source of [panel, modal]) {
    assert.match(source, /modelName: editingPart\?\.modelName \|\| ""/);
    assert.match(source, /modelName: form\.modelName \|\| undefined/);
    assert.match(source, /<FieldInput field="modelName" label=\{t\("master\.part\.modelName", "차종"\)\}/);
  }

  assert.match(fieldHelp, /modelName: \{ db: "ITEM_MASTERS\.MODEL_NAME", description: "차량 모델 또는 차종을 구분하는 품목 관리 특성입니다\." \}/);
  assert.match(partDto, /@ApiPropertyOptional\(\{ description: '차종', example: 'CN7' \}\)[\s\S]*?@MaxLength\(100\)[\s\S]*?modelName\?: string;/);
  assert.match(partEntity, /@Column\(\{ type: 'varchar2', name: 'MODEL_NAME', length: 100, nullable: true \}\)[\s\S]*?modelName: string \| null;/);
});

test('/master/part exposes defect model group from ITEM_MASTERS.DEFECT_MODEL_GROUP', () => {
  const types = read('apps/frontend/src/app/(authenticated)/master/part/types.ts');
  const page = read('apps/frontend/src/app/(authenticated)/master/part/page.tsx');
  const partColumns = read('apps/frontend/src/app/(authenticated)/master/part/partColumns.tsx');
  const panel = read('apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx');
  const fieldHelp = read('apps/frontend/src/app/(authenticated)/master/part/components/PartFieldHelp.tsx');
  const partDto = read('apps/backend/src/modules/master/dto/part.dto.ts');
  const partEntity = read('apps/backend/src/entities/item-master.entity.ts');
  const partService = read('apps/backend/src/modules/master/services/part.service.ts');
  const migration = read('apps/backend/src/migrations/2026-06-22_item_defect_model_group.sql');

  assert.match(types, /defectModelGroup\?: string \| null; \/\/ 불량 모델구분/);
  assert.match(page, /useComCodeOptions\("DEFECT_MODEL_GROUP"\)/);
  assert.match(partColumns, /accessorKey: "defectModelGroup"[\s\S]*header: t\("master\.part\.defectModelGroup", "모델구분"\)/);
  assert.match(panel, /const defectModelGroupOptions = useComCodeOptions\("DEFECT_MODEL_GROUP"\)/);
  assert.match(panel, /defectModelGroup: editingPart\?\.defectModelGroup \|\| ""/);
  assert.match(panel, /defectModelGroup: form\.defectModelGroup \|\| undefined/);
  assert.match(panel, /<FieldSelect field="defectModelGroup" label=\{t\("master\.part\.defectModelGroup", "모델구분"\)\}/);
  assert.match(fieldHelp, /defectModelGroup: \{ db: "ITEM_MASTERS\.DEFECT_MODEL_GROUP", description: "불량코드 적용 범위를 저전압\/고전압 같은 모델군으로 구분하는 기준입니다\." \}/);
  assert.match(partDto, /@ApiPropertyOptional\(\{ description: '불량 모델구분', example: 'LV' \}\)[\s\S]*?@MaxLength\(50\)[\s\S]*?defectModelGroup\?: string;/);
  assert.match(partEntity, /@Column\(\{ type: 'varchar2', name: 'DEFECT_MODEL_GROUP', length: 50, nullable: true \}\)[\s\S]*?defectModelGroup: string \| null;/);
  assert.match(partService, /defectModelGroup: dto\.defectModelGroup \?\? null/);
  assert.match(partService, /dto\.defectModelGroup !== undefined \? \{ defectModelGroup: dto\.defectModelGroup \|\| null \} : \{\}/);
  assert.match(migration, /ALTER TABLE ITEM_MASTERS ADD DEFECT_MODEL_GROUP VARCHAR2\(50\)/);
  assert.match(migration, /GROUP_CODE = 'DEFECT_MODEL_GROUP'/);
});

test('/master/part does not manage wire cut or stripping dimensions as item master fields', () => {
  for (const source of [page, partColumns, types, panel, modal, fieldHelp, partDto, partEntity, partService]) {
    assert.doesNotMatch(source, /accessorKey: "length"/);
    assert.doesNotMatch(source, /field="length"/);
    assert.doesNotMatch(source, /length\?: number/);
    assert.doesNotMatch(source, /length: dto\.length/);
    assert.doesNotMatch(source, /stripBefore/);
    assert.doesNotMatch(source, /stripAfter/);
    assert.doesNotMatch(source, /ITEM_MASTERS\.LENGTH/);
    assert.doesNotMatch(source, /STRIP_BEFORE/);
    assert.doesNotMatch(source, /STRIP_AFTER/);
  }
});

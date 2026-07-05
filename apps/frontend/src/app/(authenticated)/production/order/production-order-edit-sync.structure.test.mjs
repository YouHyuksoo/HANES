import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('./components/JobOrderFormPanel.tsx', import.meta.url), 'utf8');
const createModalSource = readFileSync(new URL('./components/JobOrderCreateModal.tsx', import.meta.url), 'utf8');

test('production order edit panel maps rows through a reusable form data helper', () => {
  assert.match(pageSource, /const\s+toJobOrderFormData\s*=\s*\(row:\s*JobOrderItem\):\s*JobOrderFormData\s*=>/);
  assert.match(pageSource, /orderNo:\s*row\.orderNo/);
  assert.match(pageSource, /planDate:\s*row\.planDate\s*\?\s*String\(row\.planDate\)\.slice\(0,\s*10\)\s*:\s*undefined/);
});

test('production order row click synchronizes an already-open edit panel', () => {
  assert.match(pageSource, /const\s+nextSelected\s*=\s*selectedRow\?\.orderNo\s*===\s*row\.orderNo\s*\?\s*null\s*:\s*row/);
  assert.match(pageSource, /setSelectedRow\(nextSelected\)/);
  assert.match(pageSource, /if\s*\(\s*nextSelected\s*&&\s*isPanelOpen\s*&&\s*editingOrder\s*\)/);
  assert.match(pageSource, /panelAnimateRef\.current\s*=\s*false/);
  assert.match(pageSource, /setEditingOrder\(toJobOrderFormData\(nextSelected\)\)/);
});

test('production order form places line and process controls in one row', () => {
  assert.match(panelSource, /<div className="grid grid-cols-2 gap-3">\s*<LineSelect[\s\S]*?<ProcessSelect/);
});

test('production order form shows equipment choices without a dropdown', () => {
  assert.doesNotMatch(panelSource, /<EquipSelect/);
  assert.match(panelSource, /equipOptions\.map\(\(option\)\s*=>/);
  assert.match(panelSource, /type="button"[\s\S]*onClick=\{\(\)\s*=>\s*setField\("equipCode",\s*option\.value\)\}/);
  assert.match(panelSource, /form\.equipCode\s*===\s*option\.value/);
});

test('production order form limits process and equipment choices to the selected item routing', () => {
  assert.match(panelSource, /routingProcessOptions/);
  assert.match(panelSource, /routingInfo\?\.processes[\s\S]*proc\.jobOrderYn/);
  assert.match(panelSource, /selectedRoutingProcess/);
  assert.match(panelSource, /useProcessEquipmentOptions\(\s*form\.processCode\s*\|\|\s*undefined,\s*selectedRoutingProcess\?\.equipType\s*\?\?\s*undefined,\s*!!form\.processCode,?\s*\)/);
  assert.match(panelSource, /options=\{routingProcessOptions\}/);
  assert.doesNotMatch(panelSource, /useEquipOptions\(form\.processCode \|\| undefined\)/);
});

test('production order create workflow uses a large modal with per-operation equipment assignments', () => {
  assert.match(pageSource, /import JobOrderCreateModal from "\.\/components\/JobOrderCreateModal"/);
  assert.match(pageSource, /const \[createModalOpen,\s*setCreateModalOpen\] = useState\(false\)/);
  assert.match(pageSource, /setCreateModalOpen\(true\)/);
  assert.match(pageSource, /<JobOrderCreateModal[\s\S]*isOpen=\{createModalOpen\}/);
  assert.doesNotMatch(pageSource, /const handleCreate = \(\) => \{\s*panelAnimateRef\.current = true/);
  assert.match(pageSource, /const handleCreate = \(\) => \{[\s\S]*setCreateModalOpen\(true\);[\s\S]*\};/);
  assert.match(createModalSource, /size="full"/);
  assert.match(createModalSource, /operationAssignments/);
  assert.match(createModalSource, /generatedOperationRows = useMemo/);
  assert.match(createModalSource, /generatedOperationRows\.map\(\(row\) =>/);
  assert.match(createModalSource, /processCode: row\.processCode/);
  assert.match(createModalSource, /setOperationAssignments/);
  assert.match(createModalSource, /api\.post\("\/production\/job-orders",\s*payload\)/);
});

test('production order create modal previews all generated item and operation orders with equipment assignment', () => {
  assert.match(createModalSource, /interface GeneratedJobOrderPreviewRow/);
  assert.match(createModalSource, /generatedJobOrderRows/);
  assert.match(createModalSource, /collectGeneratedJobOrderRows/);
  assert.match(createModalSource, /routingInfoByItem/);
  assert.match(createModalSource, /row\.orderKind === "OPERATION"/);
  assert.match(createModalSource, /value=\{operationAssignments\[row\.key\] \?\? ""\}/);
  assert.match(createModalSource, /setOperationEquip\(row\.key, value\)/);
  assert.match(createModalSource, /itemCode: row\.itemCode/);
  assert.match(createModalSource, /routingCode: row\.routingCode/);
});

test('production order create modal fetches and displays BOM hierarchy for generated child orders', () => {
  assert.match(createModalSource, /interface BomTreeItem/);
  assert.match(createModalSource, /fetchBomTree/);
  assert.match(createModalSource, /api\.get\(`\/master\/boms\/hierarchy\/\$\{encodeURIComponent\(itemCode\)\}`/);
  assert.match(createModalSource, /bomTreeWithRoot/);
  assert.match(createModalSource, /bomSemiProductCount/);
  assert.match(createModalSource, /BomTreeRows/);
  assert.match(createModalSource, /production\.order\.bomPreview/);
});

test('production order create modal shows dotted BOM depth and Korean item type badges', () => {
  assert.match(createModalSource, /import \{ Badge, Button, Input, Modal, Select \}/);
  assert.match(createModalSource, /getItemTypeLabel/);
  assert.match(createModalSource, /getItemTypeVariant/);
  assert.match(createModalSource, /FINISHED: t\("common\.finishedProduct", "완제품"\)/);
  assert.match(createModalSource, /SEMI_PRODUCT: t\("common\.semiProduct", "반제품"\)/);
  assert.match(createModalSource, /MATERIAL: t\("common\.rawMaterial", "원자재"\)/);
  assert.match(createModalSource, /const levelDots = "\."\.repeat\(path\.length\)/);
  assert.match(createModalSource, /const nextPath = \[\.\.\.path, item\.itemCode\]/);
  assert.match(createModalSource, /levelDots && <span className="font-mono text-primary\/70">\{levelDots\}<\/span>/);
  assert.match(createModalSource, /<Badge variant=\{getItemTypeVariant\(item\.itemType\)\}/);
  assert.match(createModalSource, /grid-cols-\[minmax\(210px,1fr\)_88px_88px_minmax\(110px,0\.8fr\)\] gap-3/);
  assert.doesNotMatch(createModalSource, /nextPath\.join\("\."\)/);
  assert.doesNotMatch(createModalSource, /paddingLeft: depth \* 18/);
});

test('production order create modal places BOM and routing preview side by side', () => {
  assert.match(createModalSource, /<div className="grid min-h-0 grid-cols-\[minmax\(360px,0\.95fr\)_minmax\(520px,1\.25fr\)\] gap-3">/);
  assert.match(createModalSource, /production\.order\.bomPreview[\s\S]*production\.order\.routingPreview/);
  assert.match(createModalSource, /max-h-\[46vh\] overflow-y-auto/);
  assert.match(createModalSource, /minmax\(520px,1\.25fr\)/);
});

test('production order create modal keeps summary badges beside the preview title and basic info compact', () => {
  assert.match(createModalSource, /grid min-h-\[62vh\] grid-cols-\[300px_minmax\(0,1fr\)\] gap-3/);
  assert.match(createModalSource, /production\.order\.createPreview[\s\S]*production\.order\.itemOrder[\s\S]*production\.order\.operationOrder[\s\S]*production\.order\.assignedEquip/);
  assert.match(createModalSource, /rounded border border-border bg-surface px-2 py-1 text-\[11px\] text-text-muted/);
  assert.match(createModalSource, /grid grid-cols-\[72px_minmax\(0,1fr\)\] gap-2/);
});

test('production order create modal links BOM selection to routing preview rows', () => {
  assert.match(createModalSource, /selectedBomItemCode/);
  assert.match(createModalSource, /setSelectedBomItemCode/);
  assert.match(createModalSource, /selectedRoutingRowRefs/);
  assert.match(createModalSource, /scrollIntoView\(\{ block: "nearest", behavior: "smooth" \}\)/);
  assert.match(createModalSource, /onSelectItem=\{setSelectedBomItemCode\}/);
  assert.match(createModalSource, /selectedItemCode=\{selectedBomItemCode\}/);
  assert.match(createModalSource, /onClick=\{\(\) => onSelectItem\(item\.itemCode\)\}/);
  assert.match(createModalSource, /row\.itemCode === selectedBomItemCode/);
  assert.match(createModalSource, /production\.order\.selectedItem/);
});

test('production order create form previews generated item and operation order kinds', () => {
  assert.match(panelSource, /jobOrderProcessCount/);
  assert.match(panelSource, /저장 시 생성 구조/);
  assert.match(panelSource, /품목지시/);
  assert.match(panelSource, /공정지시/);
  assert.match(panelSource, /routingInfo\.processes\.filter\(\(proc\) => \(proc\.jobOrderYn \?\? "Y"\) === "Y"\)\.length/);
  assert.match(panelSource, /!isEdit && routingInfo/);
});

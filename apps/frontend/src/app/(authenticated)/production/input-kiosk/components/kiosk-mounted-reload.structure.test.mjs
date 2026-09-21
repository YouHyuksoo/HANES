import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const materialListSource = readFileSync(new URL('./MaterialListPanel.tsx', import.meta.url), 'utf8');
const consumableScanSource = readFileSync(new URL('./ConsumableScanModal.tsx', import.meta.url), 'utf8');
const materialScanSource = readFileSync(new URL('./MaterialScanModal.tsx', import.meta.url), 'utf8');

test('material panel reloads mounted materials from equipment WIP using the selected kiosk equipment', () => {
  // 자재는 작업지시(material-lots)가 아니라 설비(equip-material/mounted) 귀속으로 조회한다
  assert.match(materialListSource, /\/production\/equip-material\/mounted/);
  assert.match(materialListSource, /params:\s*\{\s*equipCode:\s*selectedEquip\.equipCode\s*,?\s*\}/);
  assert.match(materialListSource, /\[selectedEquip\?\.equipCode,\s*materialMountRefreshSeq\]/);
  // 구 모델(작업지시 material-lots 재적재)이 남아있지 않아야 한다
  assert.doesNotMatch(materialListSource, /addScannedMaterialLot/);
});

test('material panel reloads mounted consumables from DB using the selected kiosk equipment', () => {
  assert.match(materialListSource, /selectedEquip/);
  assert.match(materialListSource, /\/production\/job-orders\/\$\{selectedJobOrder\.orderNo\}\/consumables/);
  assert.match(materialListSource, /params:\s*\{\s*equipCode:\s*selectedEquip\?\.equipCode,\s*includeMounted:\s*1\s*\}/);
  assert.match(materialListSource, /\[selectedJobOrder\?\.orderNo,\s*selectedEquip\?\.equipCode,\s*consumableRefreshSeq\]/);
});

test('consumable scan modal uses the same selected equipment for list reload and scan mount', () => {
  assert.match(consumableScanSource, /selectedEquip/);
  assert.match(consumableScanSource, /params:\s*\{\s*equipCode:\s*selectedEquip\?\.equipCode,\s*includeMounted:\s*1\s*\}/);
  assert.match(consumableScanSource, /\{\s*conUid,\s*equipCode:\s*selectedEquip\?\.equipCode\s*\}/);
  assert.match(consumableScanSource, /\[isOpen,\s*selectedJobOrder\?\.orderNo,\s*selectedEquip\?\.equipCode,\s*consumableRefreshSeq\]/);
});

test('material scan modal shows process waiting lots and selecting one reuses barcode scan mount flow', () => {
  assert.match(materialScanSource, /\/production\/equip-material\/proc-waiting/);
  assert.match(materialScanSource, /params:\s*\{\s*equipCode:\s*selectedEquip\.equipCode\s*,?\s*\}/);
  assert.match(materialScanSource, /waitingRowsToShow/);
  assert.match(materialScanSource, /unmountedBomCodes/);
  // 선택 클릭은 handlePick 을 거치지만 결국 handleScan(= 바코드 스캔과 같은 경로)을 호출한다.
  // handlePick 은 진행 중 스피너·중복 클릭 차단만 추가한 래퍼다(2026-09-21).
  assert.match(materialScanSource, /onClick=\{\(\)\s*=>\s*void handlePick\(row\.matUid\)\}/);
  assert.match(materialScanSource, /const handlePick = useCallback\(async \(matUid: string\)[\s\S]{0,300}await handleScan\(matUid\)/);
  // 진행 표시가 없으면 현장에서 처리 중인지 알 수 없다(2026-09-21 지적).
  assert.match(materialScanSource, /pendingUid/);
  assert.match(materialScanSource, /animate-spin/);
  assert.match(materialScanSource, /\/production\/job-orders\/\$\{selectedJobOrder\.orderNo\}\/material-mounts\/scan/);
});

test('scan modals do not unmount on close — 장착된 자재·소모품은 닫아도 장착 상태로 남는다', () => {
  // 장착은 실물을 설비에 물리는 행위라 모달을 닫는다고 빠지지 않는다. 화면만 해제하면
  // 서버 재고와 현장이 어긋난다. 해제는 자재/소모품 목록의 전용 경로가 맡는다(2026-09-21 지시).
  assert.doesNotMatch(materialScanSource, /equip-material\/unmount/);
  assert.doesNotMatch(consumableScanSource, /api\.delete\(/);
  assert.match(materialScanSource, /const handleCancel = useCallback\(\(\) => \{[\s\S]{0,120}onClose\(\)/);
  assert.match(consumableScanSource, /const handleCancel = useCallback\(\(\) => \{[\s\S]{0,120}onClose\(\)/);
});

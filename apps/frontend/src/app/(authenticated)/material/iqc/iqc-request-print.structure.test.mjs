import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const iqcPage = read('apps/frontend/src/app/(authenticated)/material/iqc/page.tsx');
const arrivalPage = read('apps/frontend/src/app/(authenticated)/material/arrival/page.tsx');
const labelModal = read('apps/frontend/src/app/(authenticated)/material/arrival/components/MatLabelPreviewModal.tsx');
const arrivalResultPage = read('apps/frontend/src/app/(authenticated)/material/arrival-result/page.tsx');
const modal = read('apps/frontend/src/components/material/IqcRequestPrintModal.tsx');
const hook = read('apps/frontend/src/hooks/material/useIqcRequestPrint.ts');
const iqcData = read('apps/frontend/src/hooks/material/useIqcData.ts');
const table = read('apps/frontend/src/components/material/IqcTable.tsx');
const controller = read('apps/backend/src/modules/material/controllers/iqc-history.controller.ts');

test('arrival page issues the IQC request form right after arrival and by barcode scan (primary issuance)', () => {
  assert.match(arrivalPage, /const iqcRequest = useIqcRequestPrint\(\);/);
  assert.match(arrivalPage, /<BarcodeScanInput[\s\S]*onScan=\{iqcRequest\.lookupByBarcode\}/);
  assert.match(arrivalPage, /onPrintIqcRequest=\{\(\) => \{[\s\S]*iqcRequest\.openFor\(itemCodes\.map\(\(itemCode\) => \(\{ arrivalNo: labelData\.arrivalNo, itemCode \}\)\)\)/);
  assert.match(arrivalPage, /<IqcRequestPrintModal targets=\{iqcRequest\.targets\} onClose=\{iqcRequest\.close\} \/>/);
  assert.match(labelModal, /onPrintIqcRequest\?: \(\) => void;/);
  assert.match(labelModal, /material\.iqc\.request\.printButton/);
});

test('IQC pending page reuses the same hook/modal for re-issuing per row and by barcode scan', () => {
  assert.match(iqcPage, /const requestPrint = useIqcRequestPrint\(\);/);
  assert.match(iqcPage, /<IqcRequestPrintModal targets=\{requestPrint\.targets\} onClose=\{requestPrint\.close\} \/>/);
  assert.match(iqcPage, /onPrintRequest=\{\(item\) => requestPrint\.openFor\(\[\{ arrivalNo: item\.arrivalNo, itemCode: item\.itemCode \}\]\)\}/);
  assert.match(iqcPage, /<BarcodeScanInput[\s\S]*onScan=\{requestPrint\.lookupByBarcode\}/);
  assert.match(table, /onPrintRequest\?\: \(item: IqcItem\) => void;/);
  assert.match(table, /<Printer className="w-4 h-4" \/>/);
  // 의뢰서 관련 상태는 useIqcData에 남기지 않는다(공용 훅으로 이동)
  assert.doesNotMatch(iqcData, /requestPrintItem|lookupByBarcode/);
});

test('arrival-result page re-issues the request form for a selected arrival, even after inspection', () => {
  assert.match(arrivalResultPage, /const iqcRequest = useIqcRequestPrint\(\);/);
  assert.match(arrivalResultPage, /iqcRequest\.openFor\(\[\{ arrivalNo: selected\.arrivalNo, itemCode: selected\.itemCode, iqcStatus: selected\.iqcStatus \}\]\)/);
  assert.match(arrivalResultPage, /<IqcRequestPrintModal targets=\{iqcRequest\.targets\} onClose=\{iqcRequest\.close\} \/>/);
});

test('barcode lookup resolves serial / arrival / PO regardless of inspection status through one backend endpoint', () => {
  assert.match(hook, /\/material\/iqc-history\/request-lookup/);
  assert.match(hook, /params: \{ barcode: code \}/);
  assert.match(controller, /@Get\('request-lookup'\)/);
  assert.match(controller, /resolveRequestTargetsByBarcode\(query\.barcode, company, plant\)/);
  // 재발행: 검사 완료 건도 대상 — PENDING 제한 없음
  assert.doesNotMatch(modal, /pending-serials/);
  assert.match(modal, /\/material\/arrivals\/results\/\$\{encodeURIComponent\(target\.arrivalNo\)\}\/serials/);
  assert.match(modal, /material\.iqc\.request\.reissue/);
});

test('request form reuses single-source APIs/mapping, prints scannable barcodes, one sheet per group', () => {
  assert.match(modal, /mapPendingGroupToIqcItem/);
  assert.match(iqcData, /export function mapPendingGroupToIqcItem/);
  assert.match(modal, /\/material\/iqc-history\/pending-arrivals/);
  assert.match(modal, /\/master\/iqc-part-specs\/\$\{encodeURIComponent\(target\.itemCode\)\}\/resolve-items/);
  assert.match(modal, /\/quality\/aql\/resolve-iqc-items/);
  assert.match(modal, /<BarcodeCanvas value=\{target\.arrivalNo\} format="code128" \/>/);
  assert.match(modal, /<BarcodeCanvas value=\{s\.matUid\} format="code128" \/>/);
  assert.match(modal, /break-after-page/);
  assert.match(modal, /@page \{ size: A4 portrait; margin: 15mm; \}/);
  assert.match(modal, /window\.print\(\)/);
});

test('request-form i18n keys exist in all 4 locales', () => {
  for (const lang of ['ko', 'en', 'zh', 'vi']) {
    const json = JSON.parse(read(`apps/frontend/src/locales/${lang}.json`));
    const req = json.material?.iqc?.request;
    assert.ok(req, `${lang}: material.iqc.request`);
    for (const key of ['modalTitle', 'title', 'print', 'printButton', 'scanPlaceholder', 'lookupNotFound', 'serials', 'inspectItems', 'requester', 'sheetCount', 'nothingToPrint', 'groupNotFound', 'reissue', 'noSerials', 'canceledArrival']) {
      assert.equal(typeof req[key], 'string', `${lang}: material.iqc.request.${key}`);
    }
  }
});

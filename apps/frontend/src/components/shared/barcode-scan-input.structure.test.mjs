import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const componentPath = path.resolve("apps/frontend/src/components/shared/BarcodeScanInput.tsx");

test("BarcodeScanInput centralizes scanner input behavior", () => {
  assert.ok(fs.existsSync(componentPath), "BarcodeScanInput.tsx should exist");

  const source = fs.readFileSync(componentPath, "utf8");

  assert.match(source, /forwardRef<HTMLInputElement/);
  assert.match(source, /useScanInputFocus/);
  assert.match(source, /useSerialStore/);
  assert.match(source, /onScan:\s*\(value:\s*string\)\s*=>\s*(?:void|Promise<void>)/);
  assert.match(source, /replace\(\s*\/\\r\?\\n\|\\r\/g/);
  assert.match(source, /event\.key === ["']Enter["']/);
  assert.match(source, /autoClear/);
  assert.match(source, /serialEnabled/);
  assert.match(source, /refocusAfterScan\?:\s*boolean/);
  assert.match(source, /refocusAfterScan = true/);
});

test("BarcodeScanInput shows a visible blinking scan cue by default", () => {
  const source = fs.readFileSync(componentPath, "utf8");

  assert.match(source, /blinkIndicator\?:\s*boolean/);
  assert.match(source, /blinkIndicator = true/);
  assert.match(source, /animate-pulse/);
  assert.match(source, /ring-primary\/20/);
  assert.match(source, /text-primary/);
});

test("BarcodeScanInput accepts both manual key-in Enter and connected serial scans", () => {
  const source = fs.readFileSync(componentPath, "utf8");

  assert.match(source, /onChange=\{handleChange\}/);
  assert.match(source, /onKeyDown=\{handleKeyDown\}/);
  assert.match(source, /submitValue\(event\.currentTarget\.value\)/);
  assert.match(source, /subscribeSerialScan\(\(rawValue\) =>/);
  assert.match(source, /submitValue\(rawValue\)/);
});

test("known scanner inputs use BarcodeScanInput instead of local Enter handlers", () => {
  // 스캐너 입력을 '직접' 그리는 파일만 넣는다. 화면(page.tsx)이 스캔칸을 자식 컴포넌트에
  // 위임하면 그 자식만 넣는다 — page 를 넣으면 배치 리팩터 때마다 낡아서 깨진다(2026-09-21 정리).
  //   조립 page    -> SgScanPanel / EquipMaterialMountPanel / AssemblyActionBar (아래 목록에 있음)
  //   서브공정 page -> InputSgScanPanel / SubKitActionBar (아래 목록에 있음)
  //   WorkerInspectModal 은 스캔 입력이 없다.
  const scannerFiles = [
    "apps/frontend/src/app/(authenticated)/inspection/integrated/page.tsx",
    "apps/frontend/src/app/(authenticated)/inspection/result/components/ConsumablePanel.tsx",
    "apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPanel.tsx",
    "apps/frontend/src/app/(authenticated)/inspection/structure/page.tsx",
    "apps/frontend/src/app/(authenticated)/material/concession/page.tsx",
    "apps/frontend/src/app/(authenticated)/material/issue/components/IssueScanPanel.tsx",
    "apps/frontend/src/app/(authenticated)/material/lot-merge/page.tsx",
    "apps/frontend/src/app/(authenticated)/material/receive/components/ReceiveScanModal.tsx",
    "apps/frontend/src/app/(authenticated)/material/receive/components/ReceiveScanPanel.tsx",
    "apps/frontend/src/app/(authenticated)/product/receive/components/ReceivablePanel.tsx",
    "apps/frontend/src/app/(authenticated)/production/input-assembly/components/AssemblyActionBar.tsx",
    "apps/frontend/src/app/(authenticated)/production/input-assembly/components/EquipMaterialMountPanel.tsx",
    "apps/frontend/src/app/(authenticated)/production/input-assembly/components/SgScanPanel.tsx",
    "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/ConsumableScanModal.tsx",
    "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/EquipSelectModal.tsx",
    "apps/frontend/src/app/(authenticated)/production/input-kiosk/components/MaterialScanModal.tsx",
    "apps/frontend/src/app/(authenticated)/production/repair/components/RepairFormModal.tsx",
    "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/InputSgScanPanel.tsx",
    "apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/SubKitActionBar.tsx",
    "apps/frontend/src/app/(authenticated)/quality/defect/components/DefectFormPanel.tsx",
    "apps/frontend/src/app/(authenticated)/quality/inspect/components/VisualInspectPanel.tsx",
    "apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx",
    "apps/frontend/src/app/(authenticated)/shipping/pallet-ship/page.tsx",
    "apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx",
    "apps/frontend/src/components/consumables/BarcodeScanPanel.tsx",
    "apps/frontend/src/components/consumables/IssueScanPanel.tsx",
    "apps/frontend/src/components/material/BarcodeScanTab.tsx",
    "apps/frontend/src/components/material/IqcModal.tsx",
    "apps/frontend/src/components/shipping/BoxScanShipModal.tsx",
    "apps/frontend/src/components/shipping/ShipmentScanModal.tsx",
    "apps/frontend/src/components/worker/WorkerSelectModal.tsx",
    "apps/frontend/src/components/worker/WorkerSelector.tsx",
  ];

  // 첫 실패에서 멈추면 뒤쪽 항목은 검사조차 안 돼 낡은 항목이 숨는다(2026-09-21 실제로 2건이 가려져 있었다).
  // 전부 모아서 한 번에 보고한다.
  const problems = [];
  for (const file of scannerFiles) {
    const source = fs.readFileSync(path.resolve(file), "utf8");
    if (!/<BarcodeScanInput\b/.test(source)) problems.push(`${file}: should render BarcodeScanInput`);
    if (/leftIcon=\{<Scan(?:Line|Barcode|\b)/.test(source)) problems.push(`${file}: should not wire scan icons through raw Input`);
    if (/onKeyDown=\{[^}]*Enter/.test(source)) problems.push(`${file}: should not keep local Enter scan handlers`);
  }
  assert.deepEqual(problems, [], problems.join(" | "));
});

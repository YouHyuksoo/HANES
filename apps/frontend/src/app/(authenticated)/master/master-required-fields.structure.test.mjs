import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function assertRequired(source, field, fileLabel) {
  const refs = [...source.matchAll(new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))].map((match) => match.index ?? -1);
  assert.ok(refs.length > 0, `${fileLabel}: ${field} field reference should exist`);
  const matchingWindows = refs
    .map((idx) => {
      const tagStart = source.lastIndexOf("<", idx);
      if (tagStart < 0) return "";
      return source.slice(tagStart, idx + 900);
    })
    .filter((window) => /^<(?:Input|Select|ComCodeSelect|LineSelect|ProcessSelect|PartSelect|select)\b/.test(window));
  assert.ok(matchingWindows.length > 0, `${fileLabel}: ${field} input/select should exist`);
  assert.ok(
    matchingWindows.some((window) => /\srequired(?:\s|=|\/|>)/.test(window)),
    `${fileLabel}: ${field} should mark required`,
  );
}

test("ui Select renders the same required label marker as Input", () => {
  const source = read("../../../components/ui/Select.tsx");

  assert.match(source, /required/, "Select should accept required from native select props");
  assert.match(source, /\{required\s*&&\s*<span[^>]+>\*<\/span>\}/, "Select label should render required star");
  assert.match(source, /required=\{required\}/, "Select element should receive required attribute");
});

test("master side-panel forms mark required save-blocking fields", () => {
  const cases = [
    ["./worker/components/WorkerFormPanel.tsx", "worker", ["workerCode", "workerName"]],
    ["./partner/components/PartnerFormPanel.tsx", "partner", ["partnerCode", "partnerName", "partnerType"]],
    ["./company/components/CompanyForm.tsx", "company", ["companyCode", "companyName", "plantCode", "plantName"]],
    ["./process/page.tsx", "process", ["processCode", "processName", "processType"]],
    ["./equip/components/EquipMasterTab.tsx", "equip", ["equipCode", "equipName"]],
    ["./gauge/page.tsx", "gauge", ["gaugeCode", "gaugeName", "gaugeType"]],
    ["./process-capa/components/CapaFormPanel.tsx", "process-capa", ["processCode", "itemCode"]],
    ["./vendor-barcode/components/VendorBarcodeFormPanel.tsx", "vendor-barcode", ["vendorBarcode"]],
    ["./warehouse/components/LocationList.tsx", "warehouse-location", ["warehouseCode", "locationCode", "locationName"]],
  ];

  for (const [path, label, fields] of cases) {
    const source = read(path);
    for (const field of fields) {
      assertRequired(source, field, label);
    }
  }
});

test("master modal forms mark required save-blocking fields", () => {
  const cases = [
    ["./code/components/CodeFormPanel.tsx", "code", ["detailCode", "codeName"]],
    ["./bom/components/BomFormModal.tsx", "bom", ["childSearch", "qtyPer", "revision"]],
    ["./iqc-item/components/IqcItemFormPanel.tsx", "iqc-item-pool", ["itemCode", "itemName"]],
    ["./routing/components/RoutingGroupManager.tsx", "routing", ["routingCode", "routingName", "itemCode", "processCode", "processName"]],
  ];

  for (const [path, label, fields] of cases) {
    const source = read(path);
    for (const field of fields) {
      assertRequired(source, field, label);
    }
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("shipping history shows selected order pallet detail on the right", () => {
  assert.match(source, /interface\s+OrderPallet/, "page should define pallet detail data");
  assert.match(source, /interface\s+OrderShippedBox/, "page should define loose shipped-box detail data");
  assert.match(source, /selectedHistory/, "page should keep the selected history row");
  assert.match(source, /palletDetail/, "page should keep selected order pallet detail");
  assert.match(source, /api\.get\(`\/shipping\/orders\/\$\{encodeURIComponent\(row\.shipOrderNo\)\}\/shipped-detail`/, "row selection should load shipped detail including loose shipped boxes");
  assert.match(source, /onRowClick=\{handleSelectHistory\}/, "history grid row click should select a row");
  assert.match(source, /selectedRowId=\{selectedHistory\?\.id\}/, "selected grid row should be highlighted");
  assert.match(source, /getRowId=\{\(row\) => row\.id\}/, "grid should use the history id for row selection");
  assert.match(source, /팔레트\s*상세|shipping\.history\.palletDetail/, "right panel should render pallet detail title");
  assert.match(source, /pallet\.palletNo/, "right panel should render pallet numbers");
  assert.match(source, /pallet\.boxes\.map/, "right panel should render boxes under each pallet");
  assert.match(source, /boxShipped/, "right panel should keep loose shipped boxes from the shipped-detail API");
  assert.match(source, /looseBoxes\.map/, "right panel should render loose shipped boxes");
  assert.match(source, /pallet\.boxes\?\.length \?\? pallet\.boxCount/, "pallet box totals should prefer actual returned boxes over stale aggregate columns");
});

test("shipping history defaults to today filters and renders local colored status badges", () => {
  assert.match(source, /const today = formatDateInput\(new Date\(\)\)/, "page should default date filters to today");
  assert.match(source, /useState\(today\)/, "date filters should initialize with today");
  assert.match(source, /api\.get\("\/shipping\/history"/, "history page should use the ship-history API that supports shipDate filters");
  assert.match(source, /params\.shipDateFrom = dateFrom/, "from-date filter should be sent as shipDateFrom");
  assert.match(source, /params\.shipDateTo = dateTo/, "to-date filter should be sent as shipDateTo");
  assert.match(source, /const statusBadgeClassMap/, "page should define explicit status badge color mapping");
  for (const status of ["DRAFT", "CONFIRMED", "SHIPPING", "SHIPPED", "CLOSED"]) {
    assert.match(source, new RegExp(`${status}:\\s*"[^"]+"`), `${status} should have a dedicated badge color`);
  }
  assert.match(source, /function ShipOrderStatusBadge/, "page should render local status badges");
  assert.match(source, /const statusHelpTextMap/, "page should define status help text mapping");
  for (const status of ["DRAFT", "CONFIRMED", "SHIPPING", "SHIPPED", "CLOSED"]) {
    assert.match(source, new RegExp(`${status}:\\s*"[^"]+"`), `${status} should have a dedicated help text`);
  }
  assert.match(source, /title=\{helpText\}/, "status badge should expose help text as tooltip");
  assert.match(source, /aria-label=\{`\$\{label\}: \$\{helpText\}`\}/, "status badge should expose help text for accessibility");
  assert.match(source, /<ShipOrderStatusBadge status=\{getValue\(\) as string\} \/>/, "status column should use local colored badge");
  assert.doesNotMatch(source, /cell:\s*\(\{ getValue \}\) => <ComCodeBadge groupCode="SHIP_ORDER_STATUS"/, "status column should not rely on DB attr color for this page");
});

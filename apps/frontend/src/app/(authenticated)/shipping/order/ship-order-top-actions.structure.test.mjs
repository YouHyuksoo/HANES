import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("shipping order row management keeps only edit while top buttons act on selected order", () => {
  assert.match(source, /const \[selectedOrder, setSelectedOrder\]/, "page should track the selected order for common top actions");
  assert.match(source, /onRowClick=\{\(row\) => setSelectedOrder\(row\)\}/, "clicking a row should select it for top actions");
  assert.match(source, /selectedRowId=\{selectedOrder\?\.shipOrderNo\}/, "selected order should be highlighted");
  assert.match(source, /getRowId=\{\(row\) => row\.shipOrderNo\}/, "grid should identify selected rows by shipOrderNo");

  assert.match(source, /handleTopPrintShipOrder/, "print should be a top action handler");
  assert.match(source, /handleTopConfirmOrder/, "confirm should be a top action handler");
  assert.match(source, /handleTopUnconfirmOrder/, "unconfirm should be a top action handler");
  assert.match(source, /handleTopDeleteOrder/, "delete should be a top action handler");

  assert.match(source, /title=\{t\("shipping\.shipOrder\.printOrder"/, "top toolbar should expose a print button");
  assert.match(source, /title=\{t\("shipping\.shipOrder\.confirmOrder"/, "top toolbar should expose a confirm button");
  assert.match(source, /title=\{t\("shipping\.shipOrder\.unconfirmOrder"/, "top toolbar should expose an unconfirm button");

  const actionsColumn = source.match(/id: "actions"[\s\S]*?\}\s*,\s*\{\s*accessorKey: "shipOrderNo"/)?.[0] ?? "";
  assert.match(actionsColumn, /<Edit2/, "row actions should keep edit");
  assert.doesNotMatch(actionsColumn, /<Printer/, "row actions should not keep print");
  assert.doesNotMatch(actionsColumn, /<CheckCircle/, "row actions should not keep confirm");
  assert.doesNotMatch(actionsColumn, /<RotateCcw/, "row actions should not keep unconfirm");
  assert.doesNotMatch(actionsColumn, /<Trash2/, "row actions should not keep delete");
});

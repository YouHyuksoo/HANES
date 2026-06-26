import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const receiveSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const receiptCancelSource = readFileSync(new URL("../receipt-cancel/page.tsx", import.meta.url), "utf8");

test("finished product receive history includes box WIP_OUT receipt movements", () => {
  assert.match(
    receiveSource,
    /transType:\s*"WIP_OUT,WIP_OUT_CANCEL"/,
    "box finished-goods receipts are stored as WIP_OUT/WIP_OUT_CANCEL product movements",
  );
  assert.match(receiveSource, /refType:\s*"BOX"/, "WIP_OUT history must be limited to box receipt movements");
  assert.match(receiveSource, /displayReceiveQty/, "WIP_OUT receipt quantities should be displayed as inbound quantities");
  assert.match(receiveSource, /WIP_OUT_CANCEL/, "cancel rows for box receipts should be displayed as receipt cancellations");
});

test("product receipt cancel page can cancel box WIP_OUT receipt movements", () => {
  assert.match(
    receiptCancelSource,
    /transType:\s*"WIP_OUT,WIP_OUT_CANCEL"/,
    "receipt cancel must load box WIP_OUT rows created by /inventory/fg/receive",
  );
  assert.match(receiptCancelSource, /refType:\s*"BOX"/, "receipt cancel must not mix ordinary issue WIP_OUT rows");
  assert.match(receiptCancelSource, /source:\s*"product"/, "receipt cancel should keep routing to product inventory cancel");
  assert.match(receiptCancelSource, /transactionId:\s*selectedTx\.id/, "receipt cancel should cancel the actual transaction row");
  assert.match(receiptCancelSource, /displayReceiptQty/, "receipt cancel should display WIP_OUT box rows as inbound quantities");
});

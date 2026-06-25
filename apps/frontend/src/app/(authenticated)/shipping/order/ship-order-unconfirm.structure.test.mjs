import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.resolve("apps/frontend/src/app/(authenticated)/shipping/order/page.tsx");
const source = fs.readFileSync(pagePath, "utf8");

assert.match(source, /unconfirmTarget/, "page should keep a separate unconfirm confirmation target");
assert.match(source, /setUnconfirmTarget\(row\.original\)/, "CONFIRMED rows should expose an unconfirm action");
assert.match(source, /row\.original\.status === "CONFIRMED"/, "unconfirm action should only be shown for CONFIRMED rows");
assert.match(source, /\/shipping\/orders\/\$\{unconfirmTarget\.shipOrderNo\}\/unconfirm/, "unconfirm should call the dedicated backend endpoint");
assert.match(source, /확정취소/, "page should show clear Korean unconfirm text");
assert.match(source, /deleteTarget\.status !== "DRAFT"/, "delete confirmation should not call API for non-DRAFT rows");
assert.match(source, /row\.original\.status === "DRAFT"[\s\S]*setDeleteTarget\(row\.original\)[\s\S]*<Trash2/, "delete action should only render for DRAFT rows");
assert.match(source, /handleSaveAndConfirm/, "page should support saving a draft and immediately confirming it");
assert.match(source, /await api\.post\("\/shipping\/orders", payload\)[\s\S]*createdOrderNo[\s\S]*await api\.put\(`\/shipping\/orders\/\$\{createdOrderNo\}\/confirm`\)/, "new orders should be confirmable immediately after draft save");
assert.match(source, /저장 후 확정/, "form panel should expose a clear save-and-confirm action");
assert.match(source, /disabled=\{!canSave \|\| saving \|\| confirming\}/, "save-and-confirm action should follow save and confirm loading guards");

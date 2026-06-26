import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tableSource = readFileSync(
  new URL("../receive/components/ReceivingHistoryTable.tsx", import.meta.url),
  "utf8",
);
const typesSource = readFileSync(
  new URL("../receive/components/types.ts", import.meta.url),
  "utf8",
);

test("receive history grid shows concession flag from receiving API response", () => {
  assert.match(typesSource, /isConcession\?: boolean/);
  assert.match(typesSource, /specialAcceptYn\?: string \| null/);
  assert.match(tableSource, /id: 'isConcession'/);
  assert.match(tableSource, /특채여부/);
  assert.match(tableSource, /row\.original\.isConcession === true/);
  assert.match(tableSource, /특채/);
  assert.match(tableSource, /일반/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const columnsSource = readFileSync(new URL("./palletColumns.tsx", import.meta.url), "utf8");
const localesRoot = new URL("../../../../locales/", import.meta.url);

test("pallet grid status column exposes transition help via the shared StatusHeaderHelp", () => {
  assert.match(columnsSource, /import StatusHeaderHelp from "@\/components\/shared\/StatusHeaderHelp"/, "status column should reuse the shared status help header component");
  assert.match(
    columnsSource,
    /header:\s*\(\)\s*=>\s*<StatusHeaderHelp label=\{t\("common\.status"\)\} codeType="PALLET_STATUS"/,
    "status column should render StatusHeaderHelp bound to the PALLET_STATUS common code",
  );

  for (const locale of ["ko", "en", "zh", "vi"]) {
    const json = JSON.parse(readFileSync(new URL(`${locale}.json`, localesRoot), "utf8"));
    for (const status of ["OPEN", "CLOSED", "LOADED", "SHIPPED"]) {
      assert.ok(json.comCode?.PALLET_STATUS?.[status], `${locale} comCode.PALLET_STATUS.${status} should be defined`);
      assert.ok(json.comCodeDesc?.PALLET_STATUS?.[status], `${locale} comCodeDesc.PALLET_STATUS.${status} should explain the state`);
    }
  }
});

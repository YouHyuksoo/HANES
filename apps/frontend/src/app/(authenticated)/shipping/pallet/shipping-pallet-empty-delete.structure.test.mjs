import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
// 그리드 액션 컬럼 정의는 palletColumns.tsx 로 분리되어 있어 page 와 함께 검사한다
const columnsSource = readFileSync(new URL("./palletColumns.tsx", import.meta.url), "utf8");
const source = pageSource + columnsSource;

test("pallet page can delete only empty OPEN pallets", () => {
  assert.match(source, /deletePalletTarget/, "page should keep a pallet delete confirmation target");
  assert.match(source, /canDeleteEmptyPallet/, "page should centralize empty pallet deletion eligibility");
  assert.match(source, /pallet\.status === "OPEN"/, "delete eligibility should require OPEN status");
  assert.match(source, /pallet\.boxCount === 0/, "delete eligibility should require no boxes");
  assert.match(source, /!pallet\.shipmentId/, "delete eligibility should require no shipment assignment");
  assert.match(source, /api\.delete\(`\/shipping\/pallets\/\$\{deletePalletTarget\.palletNo\}`\)/, "delete should call the existing pallet delete API");
  assert.match(source, /setDeletePalletTarget\(pallet\)/, "grid action should open delete confirmation for eligible pallets");
  assert.match(source, /shipping\.pallet\.deleteEmptyPallet/, "page should label the action with a translation key");
});

test("pallet page keeps toolbar controls aligned and narrows the included-box panel", () => {
  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_18rem\]/, "included-box section should be narrow on wide screens");
  assert.match(source, /2xl:grid-cols-\[minmax\(0,1fr\)_20rem\]/, "included-box section should stay compact on very wide screens");
  assert.match(source, /grid w-full min-w-0 grid-cols-1 gap-2 lg:grid-cols-\[auto_minmax\(7rem,1fr\)_7rem_8rem\]/, "toolbar should use a compact stable grid instead of wrapping unpredictably");
  assert.match(source, /presets=\{false\}/, "pallet toolbar should not spend width on the date preset button");
  assert.match(source, /className="\[&_input\]:w-28"/, "date range inputs should be compact on the pallet page");
  assert.match(source, /<div className="min-w-0">[\s\S]*shipping\.pallet\.searchPlaceholder/, "search input should be allowed to shrink inside the grid");
  assert.doesNotMatch(source, /toolbarLeft=\{\s*<div className="flex gap-3 flex-1 min-w-0 items-center flex-wrap"/, "pallet toolbar should not use flex-wrap layout");
  assert.match(source, /<div className="w-32">[\s\S]*barcodePlaceholder/, "barcode scan input should have a compact stable width");
});

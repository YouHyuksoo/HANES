import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const columns = readFileSync(new URL("./departmentColumns.tsx", import.meta.url), "utf8");

test("department page delegates grid columns to departmentColumns", () => {
  assert.match(page, /createDepartmentGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"deptCode"/);
});

test("department columns keep required accessors and row actions", () => {
  for (const key of ["deptCode", "deptName", "parentDeptCode", "sortOrder", "managerName", "useYn", "remark"]) {
    assert.match(columns, new RegExp(`accessorKey:\\s*"${key}"`));
  }

  assert.match(columns, /onEditDepartment/);
  assert.match(columns, /onDeleteDepartment/);
});

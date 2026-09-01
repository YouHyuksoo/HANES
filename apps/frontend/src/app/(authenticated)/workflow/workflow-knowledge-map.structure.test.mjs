import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = "apps/frontend/src/app/(authenticated)/workflow/knowledge";
const read = (name) => fs.readFileSync(`${root}/${name}`, "utf8");

test("knowledge navigation owns validated URL state and an internal center history", () => {
  const source = read("knowledge-state.ts");

  assert.match(source, /type LayoutMode = ["']mindmap["'] \| ["']process["'] \| ["']relation["']/);
  assert.match(source, /type ViewMode = ["']business["'] \| ["']technical["']/);
  assert.match(source, /DEFAULT_LAYOUT_MODE\s*:\s*LayoutMode\s*=\s*["']mindmap["']/);
  assert.match(source, /DEFAULT_VIEW_MODE\s*:\s*ViewMode\s*=\s*["']business["']/);
  assert.match(source, /invalidCenter/);
  assert.match(source, /workflowKnowledgeCatalog/);
  assert.match(source, /KNOWLEDGE_CATEGORIES/);
  assert.match(source, /["']evidence["']/);
  assert.match(source, /localStorage/);
  assert.match(source, /centerHistory/);
  assert.match(source, /goBack/);
  assert.match(source, /goForward/);
  assert.match(source, /replaceState/);
  assert.doesNotMatch(source, /pushState/);

  const urlKeys = [...source.matchAll(/searchParams\.set\(["']([^"']+)["']/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(urlKeys)].sort(), ["center", "layout", "relations", "view"]);
  assert.doesNotMatch(source, /searchParams\.(?:set|get)\(["'](?:expanded|selected|panel)/);
});

test("knowledge navigation keeps layout, view and filters out of center history", () => {
  const source = read("knowledge-state.ts");
  assert.match(source, /setCenter[\s\S]*centerHistory/);
  for (const method of ["setLayout", "setView", "setRelations"]) {
    const body = source.match(new RegExp(`${method}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n  \\}`));
    assert.ok(body, `missing ${method}`);
    assert.doesNotMatch(body[1], /centerHistory/);
  }
});

test("all layouts are deterministic coordinate-only transforms with a safe fallback", () => {
  const source = read("knowledge-layouts.ts");
  assert.match(source, /mindmap/);
  assert.match(source, /process/);
  assert.match(source, /relation/);
  assert.match(source, /CATEGORY_(?:SECTOR|ANGLE)S/);
  assert.match(source, /precedes|follows/);
  assert.match(source, /requires|requiredTasks/);
  assert.match(source, /exceptions|recoversWith/);
  assert.match(source, /Number\.isFinite/);
  assert.match(source, /catch/);
  assert.match(source, /radialFallback/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.match(source, /return\s+nodes\.map/);
});

test("view modes preserve topology and filters alone remove graph elements", () => {
  const source = read("knowledge-view-model.ts");
  assert.match(source, /@xyflow\/react/);
  assert.match(source, /business/);
  assert.match(source, /technical/);
  assert.match(source, /selectedNodeId/);
  assert.match(source, /centerId/);
  assert.match(source, /opacity/);
  assert.match(source, /labelDensity/);
  assert.match(source, /relationCategories/);
  assert.match(source, /nodeIdsWithVisibleRelations/);
  assert.doesNotMatch(source, /expandKnowledgeNeighborhood/);
  assert.doesNotMatch(source, /viewMode\s*===\s*["'](?:business|technical)["'][\s\S]{0,100}\.filter\(/);
});

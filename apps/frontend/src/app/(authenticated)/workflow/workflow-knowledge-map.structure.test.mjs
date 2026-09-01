import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import "./workflow-knowledge-map.runtime.test.mjs";

const root = "apps/frontend/src/app/(authenticated)/workflow/knowledge";
const read = (name) => fs.readFileSync(`${root}/${name}`, "utf8");
const componentRoot = "apps/frontend/src/app/(authenticated)/workflow/components";
const readComponent = (name) => fs.readFileSync(`${componentRoot}/${name}`, "utf8");

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

test("knowledge blueprint composes responsive explorer regions and explicit recovery", () => {
  const source = readComponent("WorkflowKnowledgeMap.tsx");
  assert.match(source, /KnowledgeNavigationModel/);
  assert.match(source, /KnowledgeSearch/);
  assert.match(source, /RelationFilters/);
  assert.match(source, /KnowledgeCanvas/);
  assert.match(source, /KnowledgeDetailPanel/);
  assert.match(source, /invalidCenter/);
  assert.match(source, /lg:grid-cols|xl:grid-cols|2xl:grid-cols/);
  assert.match(source, /md:hidden/);
  assert.match(source, /min-h-0/);
  assert.doesNotMatch(source, /expand(?:All|Whole)|wholeGraph/i);
});

test("search keeps local and AI candidates separate and validates AI response", () => {
  const source = readComponent("KnowledgeSearch.tsx");
  assert.match(source, /searchKnowledgeCatalog/);
  assert.match(source, /workflow-knowledge\/interpret/);
  assert.match(source, /suppressErrorModal:\s*true/);
  assert.match(source, /localResults/);
  assert.match(source, /aiCandidates/);
  assert.match(source, /AI로 질문 해석/);
  assert.match(source, /shouldInterpretKnowledgeQuery\(query,\s*localResults\.length,\s*false\)/);
  assert.match(source, /isWorkflowKnowledgeInterpretResponse/);
  assert.doesNotMatch(source, /onSelect[^\n]+await[^\n]+post/);
});

test("toolbar exposes exact layouts and views plus internal navigation actions", () => {
  const source = readComponent("KnowledgeToolbar.tsx");
  for (const value of ["mindmap", "process", "relation", "business", "technical"]) assert.match(source, new RegExp(value));
  for (const label of ["뒤로", "앞으로", "초기화", "전체 보기", "링크 복사"]) assert.match(source, new RegExp(label));
  assert.match(source, /aria-label/);
});

test("relation rail has seven semantic filters with count and coverage", () => {
  const source = readComponent("RelationFilters.tsx");
  assert.match(source, /KNOWLEDGE_CATEGORIES/);
  assert.match(source, /coverage/);
  assert.match(source, /count/);
  assert.doesNotMatch(source, /KNOWLEDGE_CATEGORIES[^\n]+evidence/);
});

test("mobile keeps all seven relation filters accessible instead of hiding the rail", () => {
  const source = `${readComponent("WorkflowKnowledgeMap.tsx")}\n${readComponent("RelationFilters.tsx")}`;
  assert.match(source, /모바일 관계 필터/);
  assert.match(source, /<RelationFilters[^>]*compact/);
  assert.doesNotMatch(source, /<RelationFilters[^>]*className=["'][^"']*hidden/);
});

test("canvas registers custom renderers and complete ReactFlow instruments", () => {
  const source = readComponent("KnowledgeCanvas.tsx");
  assert.match(source, /nodeTypes/);
  assert.match(source, /edgeTypes/);
  assert.match(source, /KnowledgeNode/);
  assert.match(source, /KnowledgeEdge/);
  assert.match(source, /nodesDraggable=\{false\}/);
  assert.match(source, /nodesConnectable=\{false\}/);
  assert.match(source, /<Background/);
  assert.match(source, /<Controls/);
  assert.match(source, /<MiniMap/);
  assert.match(source, /onNodeClick/);
  assert.match(source, /onKeyDown/);
});

test("node edge and dossier communicate semantics without color-only meaning", () => {
  const node = readComponent("KnowledgeNode.tsx");
  const edge = readComponent("KnowledgeEdge.tsx");
  const detail = readComponent("KnowledgeDetailPanel.tsx");
  assert.match(node, /aria-selected/);
  assert.match(node, /evidenceStatus/);
  assert.match(node, /motion-reduce/);
  assert.match(edge, /strokeDasharray|double/i);
  assert.match(edge, /markerEnd/);
  assert.match(edge, /condition/);
  assert.match(detail, /중심으로 보기/);
  assert.match(detail, /incoming|outgoing/);
  assert.match(detail, /verified|partial|undocumented/);
  assert.match(detail, /href=\{node\.path\}/);
});

test("new blueprint components avoid native dialogs and visual anti-patterns", () => {
  const files = ["WorkflowKnowledgeMap.tsx", "KnowledgeSearch.tsx", "KnowledgeToolbar.tsx", "RelationFilters.tsx", "KnowledgeCanvas.tsx", "KnowledgeNode.tsx", "KnowledgeEdge.tsx", "KnowledgeDetailPanel.tsx"];
  const source = files.map(readComponent).join("\n");
  assert.doesNotMatch(source, /\b(?:alert|confirm|prompt)\s*\(/);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(source, /(?:bg|text|border)-(?:red|green|blue|yellow|amber|pink|purple)-50\b/);
  assert.doesNotMatch(source, /\b(?:Inter|Arial)\b/);
  assert.doesNotMatch(source, /(?:purple|violet)[^\n]*gradient|backdrop-blur/);
});

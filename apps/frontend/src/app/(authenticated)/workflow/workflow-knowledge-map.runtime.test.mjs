import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { workflowKnowledgeCatalog } = require("@harness/shared");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "hanes-knowledge-model-"));
const moduleDirectory = "apps/frontend/src/app/(authenticated)/workflow/knowledge";
const sharedEntry = require.resolve("@harness/shared").replaceAll("\\", "/");

const loadTypeScriptModule = (name) => {
  const sourcePath = path.resolve(moduleDirectory, `${name}.ts`);
  const source = fs.readFileSync(sourcePath, "utf8").replaceAll('"@harness/shared"', JSON.stringify(sharedEntry));
  const result = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });
  const errors = (result.diagnostics ?? []).filter(({ category }) => category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) throw new Error(ts.formatDiagnostics(errors, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => os.EOL,
  }));
  const outputPath = path.join(temporaryDirectory, `${name}.cjs`);
  fs.writeFileSync(outputPath, result.outputText, "utf8");
  return require(outputPath);
};

after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));

const { KnowledgeNavigationModel, parseKnowledgeNavigation } = loadTypeScriptModule("knowledge-state");
const { KNOWLEDGE_LAYOUTS, safeLayout } = loadTypeScriptModule("knowledge-layouts");
const { createKnowledgeViewModel } = loadTypeScriptModule("knowledge-view-model");

const [center, second, third] = workflowKnowledgeCatalog.nodes;
assert.ok(center && second && third);

const storage = (values) => ({
  getItem: (key) => values[key] ?? null,
  setItem: (key, value) => { values[key] = value; },
});

test("URL presence wins over local preferences and preserves an invalid center", () => {
  const preferences = storage({
    "workflow-knowledge-layout": "process",
    "workflow-knowledge-view": "technical",
  });

  const invalid = parseKnowledgeNavigation(
    "http://localhost/workflow/knowledge?center=missing&layout=bogus&view=bogus",
    preferences,
  );
  assert.equal(invalid.centerId, null);
  assert.equal(invalid.invalidCenter, "missing");
  assert.equal(invalid.layout, "mindmap");
  assert.equal(invalid.view, "business");

  const absent = parseKnowledgeNavigation("http://localhost/workflow/knowledge", preferences);
  assert.equal(absent.layout, "process");
  assert.equal(absent.view, "technical");
});

test("storage failures fall back safely and writes are best effort", () => {
  const brokenStorage = {
    getItem: () => { throw new Error("blocked read"); },
    setItem: () => { throw new Error("blocked write"); },
  };
  const parsed = parseKnowledgeNavigation("http://localhost/workflow/knowledge", brokenStorage);
  assert.equal(parsed.layout, "mindmap");
  assert.equal(parsed.view, "business");

  const environment = {
    location: { href: `http://localhost/workflow/knowledge?center=${encodeURIComponent(center.id)}` },
    localStorage: brokenStorage,
    history: { replaceState: () => {} },
  };
  const model = new KnowledgeNavigationModel(environment);
  assert.doesNotThrow(() => model.setLayout("process"));
  assert.doesNotThrow(() => model.setView("technical"));
});

test("navigation uses center-only internal history and serializes only exact durable params", () => {
  const replaced = [];
  let pushed = 0;
  const environment = {
    location: { href: `http://localhost/workflow/knowledge?center=${encodeURIComponent(center.id)}` },
    localStorage: storage({}),
    history: {
      replaceState: (_data, _unused, url) => replaced.push(String(url)),
      pushState: () => { pushed += 1; },
    },
  };
  const model = new KnowledgeNavigationModel(environment);
  model.setCenter(second.id);
  model.setLayout("relation");
  model.setView("technical");
  model.setRelations(["flow", "evidence"]);
  const leakedRelations = model.snapshot.relations;
  leakedRelations.push?.("logic");
  assert.deepEqual(model.snapshot.relations, ["flow", "evidence"]);
  assert.equal(model.snapshot.canGoBack, true);
  assert.equal(model.snapshot.canGoForward, false);
  assert.equal(model.goBack(), true);
  assert.equal(model.snapshot.centerId, center.id);
  assert.equal(model.snapshot.canGoBack, false);
  assert.equal(model.goForward(), true);
  assert.equal(model.snapshot.centerId, second.id);
  assert.equal(pushed, 0);

  const last = new URL(replaced.at(-1), "http://localhost");
  assert.deepEqual([...last.searchParams.keys()].sort(), ["center", "layout", "relations", "view"]);
  assert.equal(last.searchParams.get("center"), second.id);
  assert.equal(last.searchParams.get("layout"), "relation");
  assert.equal(last.searchParams.get("view"), "technical");
  assert.equal(last.searchParams.get("relations"), "flow,evidence");
  assert.equal(last.searchParams.has("expanded"), false);
  assert.equal(last.searchParams.has("selected"), false);

  model.setCenter(third.id);
  model.setLayout("mindmap");
  assert.equal(model.goBack(), true);
  assert.equal(model.snapshot.centerId, second.id);
});

const graph = {
  center: { id: "activity:center", kind: "activity", label: "Center" },
  nodes: [
    { id: "activity:center", kind: "activity", label: "Center" },
    { id: "activity:next", kind: "activity", label: "Next" },
    { id: "master:item", kind: "master", label: "Master" },
    { id: "logic:rule", kind: "logic", label: "Rule" },
  ],
  relations: [
    { id: "flow", source: "activity:center", target: "activity:next", kind: "precedes", category: "flow", evidenceStatus: "verified" },
    { id: "master", source: "activity:center", target: "master:item", kind: "requires", category: "masters", evidenceStatus: "verified" },
    { id: "logic", source: "activity:center", target: "logic:rule", kind: "references", category: "logic", evidenceStatus: "verified" },
  ],
};

test("all layouts are deterministic and safeLayout handles throws and non-finite positions", () => {
  for (const id of ["mindmap", "process", "relation"]) {
    const first = KNOWLEDGE_LAYOUTS[id](graph.nodes, graph.relations, graph.center.id);
    const secondRun = KNOWLEDGE_LAYOUTS[id](graph.nodes, graph.relations, graph.center.id);
    assert.deepEqual(first, secondRun, `${id} must be deterministic`);
    assert.deepEqual(safeLayout(KNOWLEDGE_LAYOUTS[id], graph), first, `${id} must survive validation`);
  }

  const fallback = safeLayout(() => { throw new Error("layout failed"); }, graph);
  const invalidLayouts = [
    (nodes) => nodes.map((node) => ({ ...node, position: { x: Number.NaN, y: Infinity } })),
    (nodes) => nodes.map((node, index) => ({ ...node, id: index === 1 ? nodes[0].id : node.id, position: { x: index * 100, y: 0 } })),
    (nodes) => nodes.slice(1).map((node, index) => ({ ...node, position: { x: index * 100, y: 0 } })),
    (nodes) => [...nodes, { ...nodes[0], id: "activity:extra" }].map((node, index) => ({ ...node, position: { x: index * 100, y: 0 } })),
    (nodes) => nodes.map((node, index) => ({ ...node, id: index === 0 ? "activity:wrong-center" : node.id, position: { x: index * 100, y: 0 } })),
    (nodes) => nodes.map((node) => ({ ...node, position: { x: 10, y: 10 } })),
    (nodes) => nodes.map((node, index) => ({ ...node, position: { x: index * 0.5, y: 0 } })),
  ];
  for (const invalidLayout of invalidLayouts) assert.deepEqual(safeLayout(invalidLayout, graph), fallback);
  assert.ok(fallback.every(({ position }) => Number.isFinite(position.x) && Number.isFinite(position.y)));
});

test("view modes keep exact topology while changing emphasis and filters alone include nodes", () => {
  const positioned = safeLayout(KNOWLEDGE_LAYOUTS.mindmap, graph);
  const categories = ["flow", "masters", "logic"];
  const business = createKnowledgeViewModel(graph, positioned, {
    centerId: graph.center.id,
    selectedNodeId: "logic:rule",
    viewMode: "business",
    relationCategories: categories,
  });
  const technical = createKnowledgeViewModel(graph, positioned, {
    centerId: graph.center.id,
    selectedNodeId: "logic:rule",
    viewMode: "technical",
    relationCategories: categories,
  });
  assert.deepEqual(business.nodes.map(({ id }) => id), technical.nodes.map(({ id }) => id));
  assert.deepEqual(business.edges.map(({ id, source, target }) => [id, source, target]), technical.edges.map(({ id, source, target }) => [id, source, target]));
  assert.notDeepEqual(business.nodes.map(({ data }) => data.opacity), technical.nodes.map(({ data }) => data.opacity));
  for (const model of [business, technical]) {
    assert.equal(model.nodes.find(({ id }) => id === graph.center.id)?.data.emphasis, "full");
    assert.equal(model.nodes.find(({ id }) => id === "logic:rule")?.data.emphasis, "full");
  }

  const flowOnly = createKnowledgeViewModel(graph, positioned, {
    centerId: graph.center.id,
    viewMode: "business",
    relationCategories: ["flow"],
  });
  assert.deepEqual(flowOnly.edges.map(({ id }) => id), ["flow"]);
  assert.deepEqual(flowOnly.nodes.map(({ id }) => id), ["activity:center", "activity:next"]);
});

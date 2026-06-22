import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pagePath = 'apps/frontend/src/app/(authenticated)/system/er-view/page.tsx';
const menuPath = 'apps/frontend/src/config/menuConfig.ts';
const packagePath = 'apps/frontend/package.json';
const controllerPath = 'apps/backend/src/modules/system/controllers/er-view.controller.ts';
const servicePath = 'apps/backend/src/modules/system/services/er-view.service.ts';
const validatorPath = 'apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts';
const seedPath = 'apps/backend/src/seeds/menu-config.json';
const globalsPath = 'apps/frontend/src/app/globals.css';

test('ER VIEW page is a three-panel operational schema governance screen', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /@xyflow\/react/);
  assert.match(page, /ReactFlow/);
  assert.match(page, /data-er-view-panel="table-list"/);
  assert.match(page, /data-er-view-panel="graph"/);
  assert.match(page, /data-er-view-panel="detail"/);
  assert.match(page, /\/system\/er-view\/summary/);
  assert.match(page, /\/system\/er-view\/tables/);
  assert.match(page, /\/system\/er-view\/graph/);
  assert.match(page, /\/system\/er-view\/actions\/dry-run/);
  assert.match(page, /물리 FK/);
  assert.match(page, /추정 관계/);
  assert.match(page, /orphan/);
  assert.match(page, /ENABLE VALIDATE/);
  assert.match(page, /확인 문구/);
  assert.doesNotMatch(page, /<textarea[^>]+name=["']sql["']/);
});

test('ER VIEW graph renders table-shaped ERD nodes with columns and keys', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const service = fs.readFileSync(servicePath, 'utf8');

  assert.match(page, /nodeTypes/);
  assert.match(page, /function TableNode/);
  assert.match(page, /data-er-view-node="table"/);
  assert.match(page, /PK/);
  assert.match(page, /FK/);
  assert.match(page, /columnName/);
  assert.match(page, /pkColumns/);
  assert.match(page, /MarkerType\.ArrowClosed/);
  assert.match(service, /pkColumns/);
  assert.match(service, /isFkCandidate/);
  assert.match(service, /columnsByTable/);
});

test('ER VIEW table node column list is scrollable without truncating schema columns', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /data-er-view-node-columns="true"/);
  assert.match(page, /overflow-y-auto/);
  assert.match(page, /data\.columns\.map/);
  assert.doesNotMatch(page, /data\.columns\.slice\(0,\s*12\)/);
  assert.doesNotMatch(page, /\+\{hiddenCount\} columns/);
});

test('ER VIEW table list supports multi-table graph selection', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /selectedTables/);
  assert.match(page, /setSelectedTables/);
  assert.match(page, /data-er-view-table-checkbox="true"/);
  assert.match(page, /data-er-view-selected-count="true"/);
  assert.match(page, /Promise\.all/);
  assert.match(page, /mergeGraphResponses/);
  assert.match(page, /current\.length === 1 \? current/);
  assert.match(page, /selectedTableSet\.has\(table\.tableName\)/);
  assert.match(page, /selectedTables\.length\}개 테이블 1-hop 관계 그래프/);
  assert.doesNotMatch(page, /const \[selectedTable, setSelectedTable\]/);
});

test('ER VIEW lets users choose inferred relationship edge style', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /InferredEdgeType/);
  assert.match(page, /inferredEdgeTypeOptions/);
  assert.match(page, /setInferredEdgeType/);
  assert.match(page, /data-er-view-inferred-edge-type/);
  assert.match(page, /edge\.relationshipType === "INFERRED" \? inferredEdgeType : "smoothstep"/);
  assert.match(page, /곡선/);
  assert.match(page, /직선/);
  assert.match(page, /계단/);
});

test('ER VIEW graph keeps ReactFlow interactions controllable', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const globals = fs.readFileSync(globalsPath, 'utf8');

  assert.match(page, /useNodesState/);
  assert.match(page, /onNodesChange/);
  assert.match(page, /nodesDraggable/);
  assert.match(page, /elementsSelectable/);
  assert.match(page, /nodesConnectable=\{false\}/);
  assert.match(page, /nodeDragRef/);
  assert.match(page, /onNodeDragStart/);
  assert.match(page, /onNodeDragStop/);
  assert.match(page, /zoomOnScroll/);
  assert.match(page, /data-er-view-canvas="true"/);
  assert.match(page, /minZoom=\{0\.05\}/);
  assert.match(page, /className="h-full w-full"/);
  assert.match(globals, /@xyflow\/react\/dist\/style\.css/);
});

test('ER VIEW guides parent UK before FK when parent key is missing', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /ADD_UK/);
  assert.match(page, /previewPayload/);
  assert.match(page, /부모 UK 후보/);
  assert.match(page, /tableName: selectedRel\.parentTable/);
  assert.match(page, /columns: selectedRel\.parentColumns/);
  assert.match(page, /!selectedRel\.parentKeyReady/);
  assert.match(page, /부모 PK\/UK가 없어 FK를 바로 생성할 수 없습니다/);
});

test('ER VIEW does not offer FK DDL execution for relationships that are already physical FKs', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const service = fs.readFileSync(servicePath, 'utf8');

  assert.match(page, /이미 물리 FK가 존재하는 관계입니다/);
  assert.match(page, /selectedRel\.relationshipType === "PHYSICAL_FK" \|\| !selectedRel\.parentKeyReady/);
  assert.match(page, /이미 물리 FK/);
  assert.match(page, /현재 FK명/);
  assert.match(page, /FK 후보명/);
  assert.match(page, /selectedRel\.constraintName/);
  assert.match(page, /edge\.constraintName \?\? edge\.label/);
  assert.match(service, /constraintName: rel\.constraintName/);
});

test('ER VIEW offers a DROP_FK dry-run action for selected physical FKs', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const service = fs.readFileSync(servicePath, 'utf8');

  assert.match(page, /DROP_FK/);
  assert.match(page, /FK 제거 후보/);
  assert.match(page, /selectedRel\.relationshipType === "PHYSICAL_FK"/);
  assert.match(page, /constraintName: selectedRel\.constraintName/);
  assert.match(service, /ALTER TABLE \$\{fk\.childTable\} DROP CONSTRAINT \$\{fk\.constraintName\}/);
});

test('ER VIEW shows existing FK status without exposing internal negative risk scores', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const service = fs.readFileSync(servicePath, 'utf8');

  assert.match(page, /상태\/리스크 근거/);
  assert.match(page, /reason\.score > 0 &&/);
  assert.doesNotMatch(page, /\{reason\.score > 0 \? "\+" : ""\}\{reason\.score\}/);
  assert.match(service, /이미 FK 존재: 신규 생성 불필요/);
  assert.doesNotMatch(service, /PHYSICAL_FK_EXISTS', label: '이미 물리 FK가 존재', score: -100/);
});

test('ER VIEW menu and dependency are registered', () => {
  const menu = fs.readFileSync(menuPath, 'utf8');
  const validator = fs.readFileSync(validatorPath, 'utf8');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  assert.match(menu, /SYS_ER_VIEW/);
  assert.match(menu, /menu\.system\.erView/);
  assert.match(menu, /\/system\/er-view/);
  assert.match(validator, /'SYS_ER_VIEW'/);
  assert.ok(seed.childMenuCodes.SYSTEM.includes('SYS_ER_VIEW'));
  assert.ok(pkg.dependencies['@xyflow/react'], '@xyflow/react dependency should be declared');
});

test('ER VIEW backend separates read APIs from dry-run and execute APIs', () => {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const service = fs.readFileSync(servicePath, 'utf8');

  for (const route of ['summary', 'tables', 'graph', 'relationships', 'actions']) {
    assert.match(controller, new RegExp(route));
  }
  assert.match(controller, /scan-orphans/);
  assert.match(controller, /dry-run/);
  assert.match(controller, /execute/);
  assert.match(service, /SCHEMA_GOVERNANCE_MODE/);
  assert.match(service, /logs[\\/]schema-governance/);
  assert.match(service, /generate_db_schema_doc\.py/);
  assert.match(service, /ENABLE VALIDATE/);
  assert.doesNotMatch(service, /payload\.sql/);
  assert.doesNotMatch(service, /executeSql/);
});

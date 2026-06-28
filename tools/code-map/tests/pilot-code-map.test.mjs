import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateCodeMap } from '../src/generate.mjs';

const pilotRoutes = ['/master/bom', '/master/routing', '/production/order'];

test('pilot code map traces selected menu routes to source, backend, DB, and tests', async () => {
  const index = await generateCodeMap({ routes: pilotRoutes, write: false });

  assert.equal(index.schemaVersion, 1);
  assert.equal(index.routes.length, pilotRoutes.length);

  for (const route of pilotRoutes) {
    const entry = index.routes.find((item) => item.route === route);
    assert.ok(entry, `${route} should exist`);
    assert.equal(entry.menu.registered, true, `${route} should be found in menuConfig`);
    assert.ok(entry.frontend.page?.file, `${route} should have a page file`);
    assert.ok(entry.frontend.graph.nodes.length > 0, `${route} should have frontend source nodes`);
    assert.ok(entry.apiFlow.length > 0, `${route} should expose API calls`);
    assert.ok(entry.backend.controllers.length > 0, `${route} should link at least one controller`);
    assert.ok(entry.backend.services.length > 0, `${route} should link at least one service`);
    assert.ok(entry.dataAccess.entities.length > 0, `${route} should link TypeORM entities`);
    assert.ok(entry.dataAccess.tables.length > 0, `${route} should link Oracle tables`);
    assert.ok(entry.tests.length > 0, `${route} should link related tests`);
    assert.ok(entry.modifyGuide.ui.length > 0, `${route} should guide UI edits`);
    assert.ok(entry.modifyGuide.businessLogic.length > 0, `${route} should guide service edits`);
  }

  const bom = index.routes.find((item) => item.route === '/master/bom');
  const bomTab = bom.frontend.graph.nodes.find((node) => node.file.endsWith('/master/bom/components/BomTab.tsx'));
  const bomForm = bom.frontend.graph.nodes.find((node) => node.file.endsWith('/master/bom/components/BomFormModal.tsx'));
  const routingEditor = bom.frontend.graph.nodes.find((node) => node.file.endsWith('/master/routing/components/QualityConditionEditor.tsx'));
  const bomMaster = bom.dataAccess.entities.find((entity) => entity.table === 'BOM_MASTERS');
  const parentsApi = bom.apiFlow.find((api) => api.method === 'GET' && api.path === '/master/boms/parents');
  const hierarchyApi = bom.apiFlow.find((api) => api.method === 'GET' && api.path === '/master/boms/hierarchy/:param');
  const templateApi = bom.apiFlow.find((api) => api.method === 'GET' && api.path === '/master/boms/template');
  assert.equal(bomTab?.depth, 1, 'BomTab should be a direct page import');
  assert.equal(bomForm?.depth, 2, 'BomFormModal should be imported through BomTab');
  assert.equal(routingEditor?.depth, 1, 'Routing editor should be a direct cross-feature import');
  assert.equal(routingEditor?.role, 'RELATED_BUSINESS_COMPONENT');
  assert.ok(bomMaster?.columns?.some((column) => column.name === 'PARENT_ITEM_CODE' && column.primary), 'BOM_MASTERS should expose primary columns');
  assert.ok(bomMaster?.columns?.some((column) => column.name === 'CHILD_ITEM_CODE' && column.primary), 'BOM_MASTERS should expose child item column');
  assert.equal(parentsApi?.resolutionStatus, 'RESOLVED');
  assert.equal(parentsApi?.controller?.className, 'BomController');
  assert.equal(parentsApi?.controller?.methodName, 'findParents');
  assert.ok(parentsApi?.serviceCalls?.some((call) => call.serviceClass === 'BomService' && call.method === 'findParents'));
  assert.equal(parentsApi?.serviceCalls?.find((call) => call.serviceClass === 'BomService' && call.method === 'findParents')?.evidence?.line, 134);
  assert.ok(parentsApi?.tables?.some((table) => table.name === 'BOM_MASTERS'), 'findParents should expose BOM_MASTERS from method SQL');
  assert.ok(parentsApi?.tables?.some((table) => table.name === 'ITEM_MASTERS'), 'findParents should expose ITEM_MASTERS from method SQL');
  assert.equal(hierarchyApi?.controller?.methodName, 'findHierarchy');
  assert.ok(hierarchyApi?.serviceCalls?.some((call) => call.serviceClass === 'BomService' && call.method === 'findHierarchy'));
  assert.ok(hierarchyApi?.tables?.some((table) => table.name === 'PROCESS_MASTERS'), 'findHierarchy should expose PROCESS_MASTERS from method SQL variable');
  assert.deepEqual(templateApi?.tables, [], 'download template should not inherit service-wide BOM tables');
});

test('pilot markdown renders beginner sections and Mermaid flow', async () => {
  const index = await generateCodeMap({ routes: ['/master/bom'], write: false });
  const markdown = index.markdown;

  assert.match(markdown, /## .*\/master\/bom/);
  assert.match(markdown, /### 이 화면은 무엇을 하나/);
  assert.match(markdown, /### Source Flow/);
  assert.match(markdown, /### TypeORM \/ DB 연결/);
  assert.match(markdown, /### 수정할 때 어디를 보나/);
  assert.match(markdown, /```mermaid/);
  assert.match(markdown, /BOM_MASTERS/);
  assert.doesNotMatch(markdown, /\[index\.ts\]\(/);
  assert.match(markdown, /\[apps\/frontend\/src\/components\/ui\/index\.ts\]/);
  assert.doesNotMatch(markdown, /UNKNOWN:/);
  assert.match(markdown, /화면 직접 연결 소스/);
  assert.match(markdown, /컴포넌트 내부 연결 소스/);
  assert.match(markdown, /다른 업무 화면 직접 연결/);
  assert.doesNotMatch(markdown, /현재 화면 주요 소스/);
  assert.match(markdown, /상태\/스토어/);
  assert.doesNotMatch(markdown, /연결된 업무 컴포넌트/);
  assert.doesNotMatch(markdown, /BOM_MASTERS\.PARENT_ITEM_CODE/);
  assert.doesNotMatch(markdown, /조회 전용 권한은 데이터를 변경할 수 없습니다/);
  assert.doesNotMatch(markdown, /등록된 라우팅 정보가 없습니다/);
  assert.match(markdown, /\| Method \| API \| Frontend 근거 \| Controller \| Service \| 연결 테이블 \|/);
  assert.match(markdown, /GET \| `\/master\/boms\/parents` .*BomController\.findParents.*BomService\.findParents/);
  assert.match(markdown, /GET \| `\/master\/boms\/hierarchy\/:param` .*BomController\.findHierarchy.*BomService\.findHierarchy/);
  assert.match(markdown, /GET \| `\/master\/boms\/template` .*BomController\.downloadTemplate.*BomService\.downloadTemplate.* \| - \|/);
  assert.match(markdown, /### 연결 테이블/);
  assert.match(markdown, /\| 테이블 \| 구분 \| 주요 컬럼 \| 근거 \|/);
  assert.match(markdown, /`BOM_MASTERS`.*PARENT_ITEM_CODE.*CHILD_ITEM_CODE/);
});

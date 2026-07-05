# Code Map Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans or subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a route-based code map generator that lets beginner developers and AI agents trace each HANES screen to its frontend files, API calls, NestJS backend flow, TypeORM/Raw SQL data access, Oracle tables, and tests.

**Architecture:** Create an independent development tool under `tools/code-map/` that statically scans the current repository and writes `.code-map/index.json` plus `docs/reports/code-map.md`. The JSON stores the full graph with evidence; the Markdown renders a beginner-friendly document with menu path, screen purpose inferred from UI/menu labels, source links, data access flow, unresolved items, and "where to modify" guidance.

**Tech Stack:** Node.js 20, TypeScript, TypeScript Compiler API, Next.js App Router, NestJS decorators, TypeORM entities/repositories, Oracle table metadata inferred from source, Markdown report generation, Jest/Node tests.

---

## Decisions

- Source scope: all Next app routes under `apps/frontend/src/app`.
- Menu scope: use `apps/frontend/src/config/menuConfig.ts` first, then merge all app routes. Routes not in menu are included under a separate "menu-unregistered routes" section.
- No manual correction file in v1. The existing UI/menu/source code is the source of truth.
- No AI-generated explanations in v1.
- `pnpm code-map:generate` generates the report even when incomplete or unresolved items exist.
- `pnpm code-map:check` is introduced after `generate`; it becomes the quality gate later.
- Every extracted relationship must include evidence: `file`, `line`, and short `text`.
- JSON contains the complete graph. Markdown shows the main flow first and collapses shared/common files with `<details>`.
- Missing or unresolved tracing is never hidden. It is recorded as `missing` or `unresolved`.

## Output Contract

### `.code-map/index.json`

Required top-level shape:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-29T00:00:00.000Z",
  "repoRoot": "C:/Project/HANES",
  "routes": []
}
```

Each route entry:

```json
{
  "route": "/master/bom",
  "menu": {
    "registered": true,
    "code": "MST_BOM",
    "labelKey": "menu.master.bom",
    "parentCodes": ["MASTER"]
  },
  "type": "DATA_PAGE",
  "status": "COMPLETE",
  "frontend": {
    "page": {},
    "labels": [],
    "actions": [],
    "graph": { "nodes": [], "edges": [] }
  },
  "apiFlow": [],
  "backend": {
    "controllers": [],
    "services": [],
    "dependencyGraph": { "nodes": [], "edges": [] }
  },
  "dataAccess": {
    "typeorm": [],
    "rawSql": [],
    "entities": [],
    "tables": [],
    "sequences": [],
    "views": []
  },
  "tests": [],
  "modifyGuide": {},
  "missing": [],
  "unresolved": []
}
```

### `docs/reports/code-map.md`

Required sections per route:

- Menu path and URL
- What this screen does, generated from menu title, page labels, buttons, API verbs, and DB tables
- User actions inferred from buttons/forms/tabs
- Source flow
- Frontend source graph
- API flow
- Backend flow
- TypeORM / Raw SQL / Oracle data access
- Related tests
- Where to modify
- Missing and unresolved tracing

## Status Model

- `COMPLETE`: all required fields for the detected route type are present.
- `INCOMPLETE`: route was scanned but one or more required relationships are missing.
- `BROKEN`: route/page/controller parsing failed.
- `IGNORED`: reserved for explicit future policy; do not use in v1 without a coded reason.

## Route Types

- `DATA_PAGE`: API call or backend/data access relationship is present or expected.
- `UI_ONLY_PAGE`: page/component route with no API call.
- `REDIRECT_PAGE`: route mainly calls `redirect`, `notFound`, or navigation.
- `LAYOUT_PAGE`: Next structural files such as `layout`, `loading`, `error`, `template`; not rendered as business screens.
- `DEV_TOOL_PAGE`: developer tool routes.

## File Structure

Create:

- `tools/code-map/src/generate.ts`
  - CLI entrypoint for `pnpm code-map:generate`.
- `tools/code-map/src/types.ts`
  - Shared schema types for index, evidence, graph nodes, and route records.
- `tools/code-map/src/path-utils.ts`
  - Repo-relative path, absolute path, line lookup, Markdown link helpers.
- `tools/code-map/src/scan-menu.ts`
  - Reads `apps/frontend/src/config/menuConfig.ts` and extracts menu code, label key, path, parent chain.
- `tools/code-map/src/scan-routes.ts`
  - Scans `apps/frontend/src/app/**/page.tsx` and maps App Router files to URL routes.
- `tools/code-map/src/scan-frontend.ts`
  - Builds route frontend import graph, extracts labels/actions/API calls from page and imported local files.
- `tools/code-map/src/scan-backend.ts`
  - Extracts NestJS controller routes, controller method calls, service injection, service method calls.
- `tools/code-map/src/scan-data-access.ts`
  - Extracts TypeORM repositories, entities, `@Entity()` table names, QueryRunner usage, and Raw SQL table/sequence/view references.
- `tools/code-map/src/scan-tests.ts`
  - Matches related tests by route segments, file names, service/controller/entity names, and explicit imports.
- `tools/code-map/src/status.ts`
  - Determines route type, required fields, status, missing, unresolved.
- `tools/code-map/src/render-markdown.ts`
  - Renders beginner-friendly `docs/reports/code-map.md`.
- `tools/code-map/src/check.ts`
  - Stub in v1 or minimal freshness/status checker if time allows.
- `tools/code-map/tests/*.spec.ts`
  - Focused tests for scanners and rendering.

Modify:

- `package.json`
  - Add:
  - `code-map:generate`
  - `code-map:check`

Generated:

- `.code-map/index.json`
- `docs/reports/code-map.md`

Do not modify:

- `apps/frontend` runtime UI for v1.
- `apps/backend` runtime API for v1.
- DB schema or migrations.

## Required Extraction Rules

### Menu

Use `apps/frontend/src/config/menuConfig.ts` as the code source for menu leaf routes.

Also note that runtime sidebar merges DB category order through:

- `apps/frontend/src/stores/menuTreeStore.ts`
- `apps/frontend/src/services/menuCategoriesApi.ts`

v1 should not query the database. It should document code-defined menu route metadata and mark category ordering as runtime data when only `/menu-categories/tree` can determine it.

### Next Routes

Convert:

- `apps/frontend/src/app/(authenticated)/master/bom/page.tsx` -> `/master/bom`
- `apps/frontend/src/app/pda/shipping/page.tsx` -> `/pda/shipping`
- Dynamic segments should be preserved as `/:id` or `/[id]`, but choose one format and document it in `types.ts`.

### Frontend Import Graph

Starting from each `page.tsx`, recursively follow local imports:

- `@/...` aliases to `apps/frontend/src/...`
- `./...`, `../...`
- `.ts`, `.tsx`, `index.ts`, `index.tsx`

Classify nodes:

- `PAGE`
- `BUSINESS_COMPONENT`
- `HOOK`
- `API_CLIENT`
- `TYPE`
- `CONSTANT`
- `SHARED_COMPONENT`
- `UTILITY`
- `UNKNOWN`

JSON must keep all nodes and edges. Markdown should list route-specific files first and collapse shared/common files.

### API Calls

Extract calls from frontend graph:

- `fetch('/api/...')`
- `fetch('/...')`
- `api.get(...)`, `api.post(...)`, `api.patch(...)`, `api.put(...)`, `api.delete(...)`
- axios-like calls if found
- project-specific wrappers under `apps/frontend/src/services`

Dynamic URL parts that cannot be resolved must produce `unresolved`, not a silent omission.

### NestJS Backend

Extract:

- `@Controller('...')`
- `@Get`, `@Post`, `@Patch`, `@Put`, `@Delete`
- controller method name
- injected service constructor properties
- `this.service.method(...)` calls

The API path matcher must account for backend global prefix conventions if present. If the prefix cannot be found statically, record `unresolved`.

### TypeORM / DB

Include TypeORM details in every DATA_PAGE backend flow:

- `@InjectRepository(Entity)`
- `Repository<Entity>`
- `qr.manager.find(Entity)`
- `qr.manager.findOne(Entity)`
- `qr.manager.save(Entity, ...)`
- `qr.manager.update(Entity, ...)`
- `qr.manager.query(...)`
- `DataSource`
- `QueryRunner`
- `@Entity('TABLE_NAME')`
- raw SQL tables, sequences, and views from SQL strings

Markdown section name:

```md
### TypeORM / DB 연결
```

Required beginner explanation:

```text
Service는 TypeORM Repository 또는 QueryRunner를 통해 Entity/Table에 접근합니다.
Raw SQL이 있으면 TypeORM Entity만으로 추적되지 않으므로 SQL 근거를 함께 확인해야 합니다.
```

### Tests

Match tests through:

- Same directory or nearby `*.spec.ts`
- Service/controller/entity imports
- Route segment names
- Structure tests under frontend route folders
- `*.test.mjs`, `*.structure.test.mjs`

Do not claim "no tests" unless the scanner searched all configured test patterns. If search could not complete, record `unresolved`.

## Beginner Documentation Rules

For each route, generate:

```md
### 이 화면은 무엇을 하나?
```

Use only evidence from:

- menu label keys
- page titles/headings
- tabs
- buttons
- form labels
- API verbs
- DB table names

Do not invent business meaning beyond these sources.

Generate:

```md
### 수정할 때 어디를 보나

- 화면 문구/레이아웃:
- 입력폼/검증:
- API 요청/응답:
- 업무 로직:
- TypeORM/DB:
- 테스트:
```

Each item must link to repo-relative source files.

## Tasks

### Task 1: Scaffold Tool And Schema

**Files:**
- Create: `tools/code-map/src/types.ts`
- Create: `tools/code-map/src/path-utils.ts`
- Create: `tools/code-map/src/generate.ts`
- Modify: `package.json`

- [ ] Define `Evidence`, `SourceNode`, `SourceEdge`, `RouteCodeMap`, `CodeMapIndex`.
- [ ] Add path helpers for repo-relative path, absolute path, line evidence, and Markdown links.
- [ ] Add `pnpm code-map:generate` script.
- [ ] Add a minimal generator that writes empty `.code-map/index.json` and `docs/reports/code-map.md`.
- [ ] Run `pnpm code-map:generate`.

### Task 2: Menu And Route Scanners

**Files:**
- Create: `tools/code-map/src/scan-menu.ts`
- Create: `tools/code-map/src/scan-routes.ts`
- Test: `tools/code-map/tests/scan-routes.spec.ts`

- [ ] Write tests for converting App Router paths to URLs.
- [ ] Write tests for extracting leaf menu routes from `menuConfig.ts`.
- [ ] Implement menu scanner using TypeScript AST.
- [ ] Implement route scanner using filesystem paths.
- [ ] Merge menu routes and app routes; mark `menu.registered`.
- [ ] Run scanner tests.

### Task 3: Frontend Source Graph

**Files:**
- Create: `tools/code-map/src/scan-frontend.ts`
- Test: `tools/code-map/tests/scan-frontend.spec.ts`

- [ ] Write tests for recursive local import resolution.
- [ ] Write tests for `@/` alias resolution.
- [ ] Write tests for shared component classification.
- [ ] Implement import graph collection from `page.tsx`.
- [ ] Extract headings, tabs, buttons, and form labels with evidence.
- [ ] Record unresolved dynamic imports.

### Task 4: API Call Extraction

**Files:**
- Modify: `tools/code-map/src/scan-frontend.ts`
- Test: `tools/code-map/tests/scan-api-calls.spec.ts`

- [ ] Write tests for `fetch`, `api.get`, `api.post`, `api.patch`, `api.put`, `api.delete`.
- [ ] Implement static string API path extraction.
- [ ] Record dynamic template literals as `unresolved` when not safely resolvable.
- [ ] Include method, path, source file, line, and evidence text.

### Task 5: Backend Controller And Service Flow

**Files:**
- Create: `tools/code-map/src/scan-backend.ts`
- Test: `tools/code-map/tests/scan-backend.spec.ts`

- [ ] Write tests for `@Controller` + method decorators.
- [ ] Write tests for constructor injection to service property.
- [ ] Write tests for `this.service.method()` call extraction.
- [ ] Implement controller route registry.
- [ ] Link frontend API calls to controller methods.
- [ ] Link controller methods to service methods where statically visible.

### Task 6: TypeORM And Raw SQL Data Access

**Files:**
- Create: `tools/code-map/src/scan-data-access.ts`
- Test: `tools/code-map/tests/scan-data-access.spec.ts`

- [ ] Write tests for `@Entity('TABLE')` extraction.
- [ ] Write tests for `@InjectRepository(Entity)` and `Repository<Entity>`.
- [ ] Write tests for `qr.manager.find(Entity)` and `save/update`.
- [ ] Write tests for `qr.manager.query()` raw SQL table extraction.
- [ ] Implement entity-to-table mapping.
- [ ] Link service methods to entities, tables, sequences, and raw SQL evidence.

### Task 7: Test Matching

**Files:**
- Create: `tools/code-map/src/scan-tests.ts`
- Test: `tools/code-map/tests/scan-tests.spec.ts`

- [ ] Match service/controller/entity tests by import.
- [ ] Match frontend route tests by directory and route segment.
- [ ] Match `.structure.test.mjs` files.
- [ ] Record evidence for each matched test file.

### Task 8: Status And Missing/Unresolved Policy

**Files:**
- Create: `tools/code-map/src/status.ts`
- Test: `tools/code-map/tests/status.spec.ts`

- [ ] Classify route type.
- [ ] Define required fields per type.
- [ ] Set `COMPLETE`, `INCOMPLETE`, or `BROKEN`.
- [ ] Ensure missing required fields are listed.
- [ ] Ensure unresolved dynamic relationships are listed separately from missing fields.

### Task 9: Markdown Report

**Files:**
- Create: `tools/code-map/src/render-markdown.ts`
- Test: `tools/code-map/tests/render-markdown.spec.ts`

- [ ] Render menu-registered routes first.
- [ ] Render menu-unregistered routes in a separate section.
- [ ] Render beginner explanation from menu labels, page labels, actions, API verbs, and DB tables only.
- [ ] Render `Source Flow`, `TypeORM / DB 연결`, `Related Tests`, and `수정할 때 어디를 보나`.
- [ ] Collapse shared/common files with `<details>`.
- [ ] Render Markdown links with line anchors when line evidence exists.

### Task 10: HANES Smoke Test

**Files:**
- Test: `tools/code-map/tests/hanes-smoke.spec.ts`

- [ ] Generate an in-memory map for `/master/bom`.
- [ ] Assert it includes `apps/frontend/src/app/(authenticated)/master/bom/page.tsx`.
- [ ] Assert it includes a backend BOM controller/service if API calls are detected.
- [ ] Assert it includes `BomMaster`.
- [ ] Assert it includes `BOM_MASTERS`.
- [ ] Assert it includes `bom.service.spec.ts` or records test matching as unresolved with evidence.

### Task 11: Generate Artifacts

**Files:**
- Generated: `.code-map/index.json`
- Generated: `docs/reports/code-map.md`

- [ ] Run `pnpm code-map:generate`.
- [ ] Inspect `/master/bom`, `/master/routing`, `/production/order`, `/production/input-kiosk`.
- [ ] Confirm unresolved items are visible, not hidden.
- [ ] Do not manually edit generated artifacts.

### Task 12: Add Check Command

**Files:**
- Create: `tools/code-map/src/check.ts`
- Modify: `package.json`

- [ ] Add `pnpm code-map:check`.
- [ ] In v1, check can verify schema and generated file freshness.
- [ ] Do not fail on `INCOMPLETE` until the team explicitly turns it into a gate.

## Verification Commands

Run after implementation:

```powershell
pnpm.cmd code-map:generate
pnpm.cmd code-map:check
pnpm.cmd run typecheck:backend
pnpm.cmd run typecheck:frontend
pnpm.cmd --filter @harness/backend test -- tools/code-map/tests --runInBand
```

If tool tests are not under the backend Jest project, add a dedicated test command and document it in `package.json`.

## Commit Strategy

- Commit 1: scaffold schema and empty generator.
- Commit 2: menu and route scanners.
- Commit 3: frontend graph and API extraction.
- Commit 4: backend and TypeORM data access extraction.
- Commit 5: Markdown renderer and generated artifacts.
- Commit 6: check command.

Each commit must include focused tests for the implemented scanner or renderer.

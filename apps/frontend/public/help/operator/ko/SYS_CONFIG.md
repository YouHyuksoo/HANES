---
menuCode: SYS_CONFIG
audience: operator
title: 환경설정 — 운영 가이드
summary: SYS_CONFIGS 기반 시스템 설정과 AI/Embedding/카탈로그 운영 경로를 설명합니다.
tags: [시스템, 운영, SYS_CONFIGS, AI, RAG]
keywords: [SYS_CONFIGS, system configs, bulk update, AI_PROVIDER, AI_EMBEDDING, ai catalog]
related: [SYS_COMM, SYS_USER, SYS_ROLE]
---

# 환경설정 — 운영 가이드

## 시스템 목적·역할

환경설정 화면은 `SYS_CONFIGS` 테이블의 key-value 설정을 회사/사업장 범위로 조회, 생성, 수정, 삭제하는 운영 화면이다. 일반 설정은 `ConfigItemRow` 목록에서 직접 수정하고, AI 관련 설정은 `AiConfigPanel`, `AiEmbeddingPanel`, `AiCatalogPanel` 전용 UI에서 관리한다.

이 화면의 저장 결과는 다음 경로에 영향을 준다.

- 프론트 전역 설정 캐시: `useSysConfigStore.fetchConfigs()`
- 백엔드 서비스 설정 조회: `SysConfigService.getValue()`, `isEnabled()`
- AI 채팅/SQL 생성: `AI_PROVIDER`, `AI_MODEL`, `AI_ENABLED`, provider API key
- RAG 검색: `AI_EMBEDDING_PROVIDER`, `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMS`, 문서 chunk/embedding DB
- AI 테이블 카탈로그: `apps/backend/data/ai-table-catalog.md`

## 데이터 구조

| 구성 | 파일 / 엔드포인트 | 역할 |
|------|------|------|
| 화면 | `apps/frontend/src/app/(authenticated)/system/config/page.tsx` | 그룹 탭, 일반 설정 목록, AI 전용 패널 라우팅 |
| 일반 설정 행 | `components/system/ConfigItemRow.tsx` | `BOOLEAN/SELECT/NUMBER/TEXT` 타입별 입력 UI |
| 추가 모달 | `components/system/AddConfigModal.tsx` | 신규 `SYS_CONFIGS` 행 생성 |
| AI 설정 | `components/system/AiConfigPanel.tsx` | LLM provider/model/enabled/key 저장 및 테스트 |
| Embedding 설정 | `components/system/AiEmbeddingPanel.tsx` | embedding 설정, 청킹 대상, 재색인, 검색 테스트 |
| AI 카탈로그 | `components/system/AiCatalogPanel.tsx` | 테이블 설명/동의어/관계 편집 |
| API | `SysConfigController` | `/system/configs` CRUD |
| 서비스 | `SysConfigService` | tenant 범위 조회/수정/삭제, 활성 설정 맵 제공 |
| DB 엔티티 | `SysConfig` | `SYS_CONFIGS` 테이블 매핑 |

## ① 환경설정 — SYS_CONFIGS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 설정 키 | `CONFIG_KEY` | 자연키 PK. `PATCH`, `DELETE`, `bulk` 저장의 id로 사용한다. |
| 그룹 | `CONFIG_GROUP` | `MATERIAL`, `PRODUCTION`, `QUALITY`, `SYSTEM`, `AI` 등 그룹 탭 필터 기준이다. |
| 값 | `CONFIG_VALUE` | 실제 설정값. 모든 타입이 문자열로 저장된다. |
| 타입 | `CONFIG_TYPE` | `BOOLEAN`, `SELECT`, `NUMBER`, `TEXT` 중 하나. 프론트 입력 UI를 결정한다. |
| 표시 라벨 | `LABEL` | 화면 표시명. 운영자가 의미를 이해할 수 있어야 한다. |
| 설명 | `DESCRIPTION` | 설정 의미 설명. 일반 목록의 보조 텍스트로 표시된다. |
| 선택 옵션 | `OPTIONS` | `SELECT` 타입의 JSON 옵션 문자열. 파싱 실패 시 선택지가 비어 보인다. |
| 정렬 | `SORT_ORDER` | 그룹 내 표시 순서. |
| 활성 여부 | `IS_ACTIVE` | `findAllActive()`는 `Y`인 행만 전역 설정 맵에 포함한다. |
| 회사 | `COMPANY` | tenant 범위. `findAll`, `create`, `update`, `bulkUpdate`, `remove`에 적용된다. |
| 사업장 | `PLANT_CD` | tenant 범위. 요청 tenant와 행 tenant가 다르면 수정/삭제가 차단된다. |
| 생성자/수정자 | `CREATED_BY`, `UPDATED_BY` | 현재 엔티티 컬럼은 있으나 화면 입력 항목은 아니다. |
| 생성/수정 시각 | `CREATED_AT`, `UPDATED_AT` | TypeORM date column. 화면에는 직접 표시하지 않는다. |

## 버튼·API·상태 전이

| 버튼/액션 | API 또는 서비스 | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| 그룹 탭 변경 | `GET /system/configs?configGroup={group}` | 로그인 tenant 헤더 필요 | 해당 tenant의 `SYS_CONFIGS`를 `CONFIG_GROUP`, `SORT_ORDER` 순으로 조회한다. |
| 전체 탭 | `GET /system/configs` | 로그인 tenant 헤더 필요 | 프론트에서 `AI` 그룹은 제외하고 일반 설정만 표시한다. |
| 설정 추가 등록 | `POST /system/configs` → `SysConfigService.create()` | `configKey`, `label`, `configType` 필수, 중복 없음 | `SYS_CONFIGS` 신규 행 생성. `COMPANY`, `PLANT_CD`는 요청 tenant로 저장된다. |
| 일반 설정 저장 | `PUT /system/configs/bulk` → `SysConfigService.bulkUpdate()` | 변경 항목이 1개 이상 | `{ id: CONFIG_KEY, configValue }` 배열을 순회해 `CONFIG_VALUE`를 수정한다. |
| 일반 설정 삭제 | `DELETE /system/configs/:id` | 행 존재, tenant 일치 | 해당 `CONFIG_KEY` 행 삭제. |
| AI 연결 테스트 | `POST /ai/test` | provider/model 입력 | 실제 LLM API 연결 여부를 반환한다. DB 변경 없음. |
| AI 설정 저장 | `PATCH /system/configs/:key` 또는 `POST /system/configs` | 기존 키 존재 여부에 따라 분기 | `AI_PROVIDER`, `AI_MODEL`, `AI_ENABLED`, `AI_{PROVIDER}_KEY`를 생성/수정한다. |
| Embedding 연결 테스트 | `POST /ai/embedding/test` | provider/model/dims 입력 | embedding provider 호출 가능 여부를 반환한다. DB 변경 없음. |
| Embedding 설정 저장 | `PATCH /system/configs/:key` 또는 `POST /system/configs` | 기존 키 존재 여부에 따라 분기 | `AI_EMBEDDING_PROVIDER`, `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMS`, provider key를 생성/수정한다. |
| 청킹 + 임베딩 재생성 | `POST /ai/knowledge/reindex` | 선택 대상 1개 이상 | Markdown 문서를 chunk로 수집하고 vector/FTS 인덱스를 재생성한다. |
| Embedding 검색 | `POST /ai/knowledge/search` | 검색어 입력 | topK 검색 결과를 반환한다. DB 설정 변경 없음. |
| 인덱스 상태 새로고침 | `GET /ai/knowledge/status` | 없음 | vector DB 경로, chunk 수, provider, model, 마지막 재생성 시각을 조회한다. |
| AI 카탈로그 새로고침 | `GET /ai/catalog/tables`, `GET /ai/catalog/columns` | 없음 | 구조화 카탈로그와 실제 DB 컬럼맵을 조회한다. |
| AI 카탈로그 저장 | `PUT /ai/catalog/tables` | 구조화 편집 내용 존재 | 테이블 설명, 동의어, 관계를 카탈로그 파일에 저장한다. |
| 고급 원문 저장 | `PUT /ai/catalog` | 원문 편집 모드 | 카탈로그 Markdown 원문을 저장한다. |
| DB와 동기화 | `POST /ai/catalog/sync` | DB 조회 가능 | 실제 DB 테이블과 카탈로그를 동기화한다. |

## 설정 처리 로직

```mermaid
flowchart TD
  A[/system/config] --> B{activeGroup}
  B -->|AI| C[AiConfigPanel]
  B -->|AI_EMBEDDING| D[AiEmbeddingPanel]
  B -->|AI_CATALOG| E[AiCatalogPanel]
  B -->|기타| F[ConfigItemRow 목록]
  F --> G[changes 객체에 변경값 저장]
  G --> H[PUT /system/configs/bulk]
  H --> I[SYS_CONFIGS.CONFIG_VALUE update]
  H --> J[useSysConfigStore.fetchConfigs]
```

- `findAll()`은 `COMPANY`, `PLANT_CD` 조건을 포함하고, `configGroup` query가 있으면 그룹 필터를 추가한다.
- `findAllActive()`는 현재 코드상 tenant 조건 없이 `IS_ACTIVE='Y'` 전체를 key-value map으로 반환한다.
- `create()`는 동일 tenant 내 `CONFIG_GROUP + CONFIG_KEY` 중복을 검사한다.
- `update()`와 `remove()`는 URL id를 `CONFIG_KEY`로 사용하고, 요청 tenant와 row tenant 일치를 확인한다.
- `bulkUpdate()`는 변경 항목마다 `CONFIG_KEY + tenant` 조건으로 `CONFIG_VALUE`만 수정한다.

## 사전 설정 (마스터·공통코드)

| 구분 | 필요 설정 |
|------|------|
| 일반 설정 | `SYS_CONFIGS` 테이블과 메뉴 권한 `SYS_CONFIG` 접근권한 |
| AI 채팅 | `AI_PROVIDER`, `AI_MODEL`, `AI_ENABLED`, 선택 provider API key 또는 서버 환경변수 |
| Embedding | `AI_EMBEDDING_PROVIDER`, `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMS`, provider API key |
| RAG 문서 인덱스 | `apps/frontend/public/help/...`, `docs/standards`, `docs/specs`, `docs/plans`, `apps/backend/data/ai-table-catalog.md` 등 청킹 대상 |
| AI 카탈로그 | `apps/backend/data/ai-table-catalog.md`, DB 스키마 조회 권한 |

## 운영 절차

1. 운영 설정 변경 전 현재 회사/사업장 tenant가 맞는지 확인한다.
2. 일반 설정은 그룹 탭에서 수정하고 `PUT /system/configs/bulk` 저장 후 관련 화면을 재조회한다.
3. AI provider/model 변경 시 `POST /ai/test`로 연결을 확인하고 저장한다.
4. 도움말 또는 설계문서를 수정한 뒤에는 Embedding 탭에서 대상 경로를 확인하고 `POST /ai/knowledge/reindex`를 실행한다.
5. text-to-SQL 결과가 부정확하면 AI 카탈로그에서 해당 테이블 설명, 동의어, JOIN 관계를 보강하고 저장한다.
6. 장애 발생 시 `GET /system/configs`, `GET /system/configs/active`, `GET /ai/knowledge/status` 결과를 먼저 비교한다.

## 권한

- 메뉴 접근은 메뉴코드 `SYS_CONFIG` 권한에 따른다.
- 일반 설정 변경은 시스템 전체 동작에 영향을 주므로 운영자/관리자 권한으로 제한하는 것이 맞다.
- API 키 입력은 secret 값 저장에 해당한다. 조회 화면에는 원문을 표시하지 않는다.

## 문제 해결 (트러블슈팅)

| 증상 | 확인 지점 | 조치 |
|------|------|------|
| 설정 목록이 비어 있음 | `GET /system/configs?configGroup=...`, tenant header | 회사/사업장 선택과 DB row의 `COMPANY`, `PLANT_CD`를 확인한다. |
| 저장 후 다른 화면 반영 안 됨 | `GET /system/configs/active`, 프론트 store refresh | 저장 후 화면 새로고침 또는 관련 조회를 다시 실행한다. |
| SELECT 선택지가 비어 있음 | `OPTIONS` JSON | `[{"value":"...","label":"..."}]` 형식인지 확인한다. |
| 신규 설정 생성 409 | `CONFIG_GROUP + CONFIG_KEY` 중복 | 기존 키를 수정하거나 새 키를 사용한다. |
| 수정/삭제 404 | URL id와 tenant 조건 | `CONFIG_KEY`, `COMPANY`, `PLANT_CD` 일치를 확인한다. |
| AI 연결 테스트 실패 | provider/model/API key | 저장된 키, 입력 키, 서버 환경변수, provider 권한을 확인한다. |
| RAG 검색 결과 없음 | `GET /ai/knowledge/status`, 재색인 결과 | 청킹 대상 선택 후 재색인하고 chunk 수를 확인한다. |
| AI 카탈로그 컬럼이 안 보임 | `GET /ai/catalog/columns` | DB 스키마 조회 권한과 backend 로그를 확인한다. |

## 데이터·연계

| 연계 대상 | 설명 |
|------|------|
| `SYS_CONFIGS` | 일반 설정과 AI 설정 key-value 저장소 |
| `useSysConfigStore` | `/system/configs/active` 결과를 프론트 전역에서 캐시 |
| `AiService`, `AiSqlService` | LLM 채팅과 SQL 생성 시 AI 설정을 사용 |
| `EmbeddingService`, `AiKnowledgeService` | 문서 chunk, embedding, vector/FTS 검색 처리 |
| `AiCatalogService`, `SchemaInfoService` | AI 테이블 카탈로그 원문/구조화 데이터와 DB 컬럼맵 처리 |
| 도움말 Markdown | `apps/frontend/public/help/user/ko`, `apps/frontend/public/help/operator/ko` 문서는 RAG 인덱스 대상이 될 수 있다. |

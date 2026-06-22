# AI Page Tool Workflow Design

Date: 2026-06-22
Status: Draft
Owner: codex

## Purpose

HANES MES의 각 업무 화면에 AI 채팅을 붙일 때, AI가 화면별 업무 도구를 같은 방식으로 발견하고 사용할 수 있게 하는 공통 표준을 만든다. `/production/order` 작업지시관리는 첫 파일럿 화면일 뿐이며, 최종 목표는 모든 화면에 반복 적용 가능한 워크플로우와 소스 개발 절차다.

1차 실행 수준은 AI가 실제 저장 API를 호출하지 않고 화면 초안만 만든다. 사용자는 화면에 채워진 값을 확인한 뒤 기존 저장 버튼으로 등록한다.

## Problem

현재 AI 모듈은 `POST /ai/chat`에서 text-to-SQL 중심으로 동작한다. 이 방식으로 작업지시 생성 같은 업무 처리를 맡기면 기존 서비스의 검증 흐름, 기준정보 후보 확인, 라우팅 자동 조회, BOM 기반 반제품 자동생성 같은 업무 규칙을 우회할 수 있다.

AI가 업무를 처리하려면 SQL이 아니라 페이지가 공개한 업무 도구를 봐야 한다. 사람도 같은 도구 목록을 볼 수 있어야 한다.

## Principles

- AI는 DB SQL을 직접 생성하거나 실행해서 업무 데이터를 변경하지 않는다.
- AI는 현재 페이지가 공개한 도구만 사용할 수 있다.
- 사람과 AI는 같은 manifest에서 생성된 도구 목록을 본다.
- 기준정보성 값은 자유입력으로 확정하지 않는다. 품목, 라인, 공정, 설비, 거래처, 상태 등은 후보 조회와 확정 단계를 거친다.
- 후보가 0건이면 멈추고 다시 묻는다.
- 후보가 2건 이상이면 임의 선택하지 않고 사용자 선택을 기다린다.
- 후보가 1건이어도 사용자가 정확한 코드로 말한 경우만 자동 확정한다. 이름, 별칭, 부분 문자열 검색은 확인을 요구한다.
- 1차 표준에서 저장, 삭제, 상태 변경은 AI 도구로 실행하지 않는다. 화면 초안 적용만 허용한다.
- 도구 실행 내역은 사람이 확인할 수 있어야 한다.

## Architecture

공통 구조는 혼합형으로 둔다.

- 백엔드: 도구 manifest, 후보 조회, 업무 검증에 가까운 read-only 도구를 제공한다.
- 프론트엔드: 현재 페이지의 form state에 초안을 적용하는 도구를 제공한다.
- AI 패널: manifest를 AI 컨텍스트로 전달하고, 사람에게는 도구보기와 실행로그를 보여준다.

Recommended source layout:

```text
apps/backend/src/modules/ai-page-tools/
  ai-page-tool.module.ts
  ai-page-tool.controller.ts
  ai-page-tool.service.ts
  registry/
    production-order.tools.ts

apps/frontend/src/ai-page-tools/
  types.ts
  usePageAiTools.ts
  PageAiToolProvider.tsx
  draft-appliers/
    productionOrderDraftApplier.ts

apps/frontend/src/components/ai/
  AiChatPanel.tsx
  PageToolInspector.tsx
  PageToolExecutionLog.tsx
```

## Page Tool Manifest

각 AI 지원 화면은 `pageToolManifest`를 가진다. 이 manifest가 사람용 도구보기와 AI용 tool context의 단일 출처다.

Example:

```ts
{
  pageId: "production.order",
  route: "/production/order",
  title: "작업지시관리",
  executionLevel: "draft-only",
  tools: [
    {
      name: "resolveItemCandidates",
      label: "품목 후보 조회",
      description: "품목코드, 품목명, 차종, 고객품번으로 작업지시 대상 품목 후보를 조회한다.",
      riskLevel: "read",
      source: "backend",
      inputSchema: {
        query: { type: "string", required: true }
      },
      outputSchema: {
        candidates: "ItemCandidate[]"
      },
      confirmationPolicy: "multiple_candidates_require_user_selection"
    },
    {
      name: "applyJobOrderDraft",
      label: "작업지시 초안 화면 적용",
      description: "확정된 기준정보와 수량/일자를 우측 작업지시 등록 패널에 입력한다.",
      riskLevel: "draft",
      source: "frontend",
      neverPersists: true,
      requiresConfirmation: true
    }
  ]
}
```

Risk levels:

- `read`: DB 또는 기준정보 조회만 수행한다.
- `draft`: 화면 state만 변경하고 저장하지 않는다.
- `propose`: 사용자가 승인할 수 있는 변경 제안만 만든다.
- `write`: 실제 저장, 삭제, 상태 변경이다. 1차 표준에서는 금지한다.

## Tool Inspector

모든 AI 지원 화면에는 사람이 도구 목록을 볼 수 있는 진입점이 필요하다.

표준 위치:

```text
[화면 제목/설명]                         [도구보기] | [새로고침] [화면별 주요 버튼]
```

`/production/order` 예:

```text
[작업지시관리 제목/설명]                 [도구보기] | [새로고침] [트리뷰] [작업지시 생성]
```

규칙:

- 액션바에는 넣지 않는다. 액션바는 선택된 행에 대한 시작, 완료, 홀딩, 취소 같은 업무 실행 자리다.
- 등록/수정 패널 안에는 넣지 않는다. 도구보기가 폼 기능처럼 보이면 안 된다.
- 플로팅 버튼을 새로 추가하지 않는다. 기존 AI 채팅 진입점과 충돌한다.
- `도구보기`는 secondary 또는 ghost 톤으로 두고, 화면의 주요 업무 버튼보다 낮은 시각 우선순위를 가진다.
- 클릭하면 AI 패널을 열고 `도구` 탭으로 진입한다.

AI 패널 탭:

- `채팅`: 자연어 대화와 후보 선택 흐름
- `도구`: 현재 페이지 manifest 렌더링
- `실행로그`: 도구명, 입력, 결과 요약, 실패 사유, 사용자 확인 여부 표시

## Standard Workflow

새 화면에 AI 업무 지원을 붙일 때는 아래 절차를 따른다.

1. 화면 업무 액션 목록화
   - 예: 생성, 수정, 시작, 완료, 취소, 출력

2. 필수 기준정보 식별
   - 예: 품목, 라인, 공정, 설비, 거래처, 창고, 상태

3. 후보 조회 도구 정의
   - 이름은 `resolve...Candidates` 형식으로 둔다.
   - 후보 결과에는 코드, 표시명, 운영자가 구분할 보조 필드를 포함한다.

4. 초안 스키마 정의
   - 이름은 `<Domain>Draft` 형식으로 둔다.
   - 필수값 누락과 확정되지 않은 후보를 명시적으로 표현한다.

5. 확인 정책 정의
   - 후보 0건, 후보 1건, 후보 다건, 필수값 누락, 충돌을 분리한다.

6. 화면 적용 도구 정의
   - 이름은 `apply<Domain>Draft` 형식으로 둔다.
   - 1차 표준에서는 form state만 변경하고 저장하지 않는다.

7. 도구보기와 실행로그 연결
   - manifest가 사람과 AI 양쪽에 같은 내용으로 보이는지 확인한다.

8. 테스트 작성
   - manifest 구조 테스트
   - 후보 확정 정책 테스트
   - draft 적용 테스트
   - 저장 API 우회 금지 테스트

## Pilot: production.order

`/production/order` 파일럿의 1차 목적은 자연어 요청을 작업지시 등록 초안으로 바꾸고 우측 등록 패널에 입력하는 것이다.

Allowed fields:

- `itemCode`
- `planQty`
- `planDate`
- `lineCode`
- `processCode`
- `equipCode`
- `custPoNo`
- `priority`
- `remark`
- `autoCreateChildren`

`orderNo`는 사용자 입력이나 프론트 랜덤 생성보다 서버 자동채번을 우선한다. 백엔드 `JobOrderService.create()`는 `orderNo`가 없을 때 `numbering.nextJobOrderNo()`를 사용한다. 따라서 파일럿 구현 시 신규 등록 payload에서 `orderNo` 필수 UI를 재검토해야 한다.

Pilot tools:

- `resolveItemCandidates(query)`
- `resolveLineCandidates(query)`
- `resolveProcessCandidates(query)`
- `resolveEquipmentCandidates(processCode, query?)`
- `buildJobOrderDraft(input)`
- `applyJobOrderDraft(draft)`

품목 확정 정책:

- 정확한 `itemCode`가 1건 매칭되면 자동 확정 가능
- 품목명, 차종, 고객품번, 부분 문자열은 1건이어도 사용자 확인 필요
- 2건 이상이면 후보 리스트 선택 전까지 draft 적용 금지
- 0건이면 품목을 다시 묻고 멈춤

Example flow:

```text
사용자: HNS 하네스 100개 내일 작업지시 만들어줘
AI: 품목 후보가 여러 개입니다. 어떤 품목으로 만들까요?
    1. HNS02 / 메인 하네스 ASSY / 차종 A
    2. HNS02C1ABCD / 회로 서브 하네스 / 차종 A
사용자: 1번
AI: 작업지시 초안을 우측 등록 패널에 입력했습니다. 확인 후 추가 버튼을 눌러주세요.
```

## Error Handling

- AI 모델 응답이 manifest에 없는 도구를 요구하면 실행하지 않고 "현재 페이지에서 사용할 수 없는 도구"로 기록한다.
- 도구 입력 스키마가 맞지 않으면 실행하지 않고 누락 필드를 묻는다.
- 후보 조회 API 실패는 실행로그에 남기고 사용자에게 재시도 가능 메시지를 보여준다.
- draft 적용 실패는 저장 실패가 아니라 화면 적용 실패로 분리해 표시한다.
- 저장 API는 사람이 버튼을 누른 뒤 기존 페이지 오류 처리 흐름을 따른다.

## Testing

1차 구현에서 필요한 테스트:

- backend `ai-page-tools` registry가 `production.order` manifest를 반환하는 구조 테스트
- `resolveItemCandidates`가 후보 0/1/다건을 구분하는 서비스 테스트
- frontend `PageToolInspector`가 manifest의 label, riskLevel, input schema, confirmation policy를 표시하는 구조 테스트
- `/production/order`에서 `도구보기` 버튼이 헤더 우측, 주요 업무 버튼 왼쪽에 있는 구조 테스트
- `applyJobOrderDraft`가 `JobOrderFormPanel`을 열고 form state를 채우는 구조 또는 component 테스트
- AI 업무 도구 경로가 `POST /production/job-orders`를 직접 호출하지 않는 구조 테스트

## Out Of Scope For Phase 1

- AI가 직접 저장, 삭제, 상태 변경을 실행하는 기능
- 모든 페이지에 도구를 일괄 적용
- DOM 자동 클릭 기반 화면 조작
- LLM이 임의 SQL을 생성해 업무 데이터를 변경하는 방식
- 외부 ERP 연동 자동 실행

## Open Questions

- 도구 실행로그를 메모리 상태만 둘지, 서버 감사 로그로 남길지 결정이 필요하다.
- 2차 단계에서 `write` 도구를 허용할 경우 승인 정책과 감사 테이블을 별도 설계해야 한다.
- 페이지별 manifest를 코드로만 둘지, 일부를 DB 설정으로 관리할지 결정이 필요하다.

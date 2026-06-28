# HANES 아키텍처 개선 후보

작성: 2026-06-29 06:03 KST
작업 ID: `T-ARCH-PAGE-RULE-REFORM`

이 문서는 `page.tsx` 비대화, 컬럼 내장, 중복 업무 규칙, 필드 영향 경로 누락을 줄이기 위한 개선 후보를 정리한다. 현재 워크트리는 여러 AI/사용자 변경이 섞여 있으므로, 실제 코드 수정은 `LOCKS.md`의 active lock을 피해서 작은 단위로 진행한다.

## P0. 워크트리와 lock 기준선 정리

근거:
- `git status --short` 기준으로 master DTO, master page, 신규 `*Columns.tsx`, `packages/shared`, `docs/reports/code-map.md`, `.ai-coordination` 변경이 동시에 존재한다.
- `.ai-coordination/LOCKS.md`에는 master 화면 다수와 shipping 서비스에 대한 active/stale lock이 공존한다.

개선 기준:
- 코드 수정 전 변경 범위를 `컬럼 분리`, `업무 규칙 중앙화`, `필드 영향 경로`, `기존 QA/기능 수정`으로 분리한다.
- active lock 파일은 직접 수정하지 않는다.

## P1. 큰 `page.tsx`를 화면 조립 전용으로 축소

대표 근거:
- `apps/frontend/src/app/(authenticated)/quality/aql/page.tsx`: 타입, ISO 행렬 컴포넌트, 검증, 저장, 컬럼이 한 파일에 공존한다. 주요 위치: `validateForm` 347라인대, `validatePolicyForm` 420라인대, `columns` 468라인대, `policyColumns` 488라인대.
- `apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx`: 조회, 스캔, 팔레트 생성, 박스 할당, 마감, 라벨, 재오픈, 삭제, 컬럼이 한 파일에 공존한다. 주요 위치: 핸들러 133라인대 이후, `columns` 443라인대.
- `apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx`: 타입, 컬럼, 하위 입력 컴포넌트가 한 파일에 공존한다. 주요 위치: 타입 12라인대, `columns` 248라인대, 내부 컴포넌트 527/561/637라인대.

개선 기준:
- `page.tsx`는 route shell, 데이터 hook 호출, 주요 panel/grid 조립만 담당한다.
- 타입은 `types.ts`, 컬럼은 `*Columns.tsx`, 폼/표/행렬은 `components/`, 업무 규칙은 route-local rule 또는 `packages/shared`로 분리한다.

## P1. 컬럼 정의 분리 패턴 전역화

대표 근거:
- 분리된 예: `apps/frontend/src/app/(authenticated)/master/part/partColumns.tsx`
- 미분리 대표: `shipping/order/page.tsx` 334라인대, `shipping/pack/page.tsx` 311라인대, `quality/defect-code/page.tsx` 275라인대, `material/arrival-result/page.tsx` 328라인대.
- 현재 page 스캔 기준 `page.tsx` 180개 중 컬럼 내장 흔적이 102개다.

개선 기준:
- grid 컬럼은 `createXxxGridColumns(options)` 형태로 분리한다.
- page는 `useMemo(() => createXxxGridColumns(...))`만 보유한다.
- 컬럼 파일에는 표시/배지/액션 버튼만 두고, 저장/상태 전이 업무 규칙은 rule 모듈로 넘긴다.

## P1. 업무 상태 전이와 검사 규칙 중앙화

대표 근거:
- 좋은 예: `packages/shared/src/utils/part-rules.ts`의 `requiresIqcAqlPolicy()`를 프론트 `PartFormPanel`과 백엔드 `PartService`가 함께 사용한다.
- 개선 필요 예: shipping 화면과 서비스에 `"DRAFT"`, `"CONFIRMED"`, `"OPEN"`, `"CLOSED"`, `"SHIPPED"` 조건이 흩어져 있다.
  - `apps/frontend/src/app/(authenticated)/shipping/order/page.tsx` 176/257/283/288/293라인대
  - `apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx` 93/412/413/414라인대
  - `apps/backend/src/modules/shipping/services/ship-order.service.ts` 164/357/424/610/988라인대

개선 기준:
- 상태값 배열은 `packages/shared/src/constants/com-code-values.ts`에만 두는 것으로 끝내지 않는다.
- `canEditShipOrder`, `canConfirmShipOrder`, `canPackBox`, `canReopenBox`, `canShipBox`, `canCancelShipBox` 같은 의도 중심 함수로 만든다.
- 프론트 버튼 disabled와 백엔드 차단 조건이 같은 rule 또는 같은 상태 전이 표를 참조하게 한다.

## P1. 필드 변경 영향 경로 표준화

대표 근거:
- 명시적 필드 영향 맵은 현재 `docs/standards/master-part-page-standard.md`의 `품목 필드 변경 영향 파일 맵`, `품목 검사 규칙 변경 영향 파일 맵`에만 있다.
- `tools/code-map/src/generate.mjs`의 기본 route는 `/master/bom`, `/master/routing`, `/production/order` 3개로 제한되어 있다.

개선 기준:
- 화면별 영향 경로는 최소 `Page`, `Columns`, `Form/Panel`, `types`, `API client`, `Controller`, `DTO`, `Service`, `Entity`, `migration`, `test`, `docs`를 포함한다.
- 수동 문서는 예외/업무 의미를 적고, 기본 경로 추적은 code-map 자동 생성으로 유지한다.

## P2. DTO enum과 공통 코드값 정합성 강화

대표 근거:
- 공통 값은 `packages/shared/src/constants/com-code-values.ts`에 존재한다.
- 일부 DTO는 아직 로컬 배열을 직접 둔다.
  - `apps/backend/src/modules/master/dto/partner.dto.ts` 검사모드
  - `apps/backend/src/modules/shipping/dto/ship-order.dto.ts` 출하지시 상태
  - `apps/backend/src/modules/production/dto/production-specification.dto.ts` revision 상태

개선 기준:
- 공통코드/업무상태 값은 shared 상수 또는 shared rule에서 export한다.
- DTO `@IsIn`, Swagger enum, 프론트 select option, 상태 badge가 같은 출처를 공유한다.

## 적용 순서 제안

1. `P0`으로 active lock과 현재 dirty change를 작업군별로 분리한다.
2. `P1` 중 충돌이 적은 화면부터 컬럼 분리만 적용한다.
3. shipping처럼 active lock이 걸린 업무는 lock 해소 뒤 상태 전이 rule을 별도 task로 진행한다.
4. code-map은 route 범위를 확장해 필드 영향 경로를 자동 문서화한다.
5. 각 단계마다 focused structure test와 frontend/backend typecheck를 분리해 실행한다.

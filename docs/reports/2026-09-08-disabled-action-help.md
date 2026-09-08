# 업무 비활성 사유 표준 툴팁 확대

2026-09-08, HEAD 2bd66c2b 이후 작업트리 기준. 커밋·배포 전.

## 반영

- 자재45곳(공통Button40 + raw버튼5), 품질/출하/제품49곳(공통Button47 + 외관검사2)에 실제 조건별 설명 추가.
- 생산22곳: 작업지시 시작/완료/보류/해제/취소/인쇄6, 설비·검사 실적입력4, 조립3, 수리1, 작업지시생성1, 사양개정5, 실적수정/삭제2.
- 입하실적조회 재발행/선택 사유에 더해 입하취소 및 제조사변경 제한도 표준 툴팁 적용.
- 공통Button은 disabledReason을 표준 HelpTooltip으로 표시. isLoading에는 처리중 설명 자동 제공. 기존 업무상 disabled 조건이나 서버 정책을 변경하지 않음.
- 공통HelpTooltip은 기존 컬럼 설명 디자인 유지, 비활성 컨트롤 hover/키보드 포커스, Escape 닫기, 스크롤 닫기, 화면 하단에서 위쪽 표시 지원. 업무 설명에 DB정보를 노출하지 않음.

## 안내 예시와 근거

| 업무 | 설명 기준 |
| --- | --- |
| 자재입고/출고 | 창고·출고공정·출고계정·작업자 미선택, 수량 미입력/범위 초과, 스캔 없음 |
| IQC | 검사항목 로딩, 스캔 없음, 판정 미완료, 불량정보 누락 또는 합격판정과 충돌 |
| 분할/병합/폐기 | 대상 선택·수량·상태 조건 및 필요한 입력 |
| 포장/팔레트 | 마감 상태, 내용물, 팔레트 배정, 출하 연결 및 OQC 조건 |
| 출하/제품입고 | 대상 미선택, 수량, 창고 및 문서 상태 |
| 작업지시 | WAITING만 시작, RUNNING만 완료, WAITING/RUNNING만 보류, HOLD만 해제, WAITING/HOLD만 취소 |
| 조립 | 작업지시/공정/설비 미선택, 반제품 준비, 발행된 FG 확정/취소 필요 |
| 수리 | 미저장 변경, 상태확인 불가, 출발/복귀창고·검사자 누락 |
| 생산실적 | 취소 이력 또는 이미 포장/출하 진행되어 수정·삭제 제한 |
| 사양개정 | 승인된 개정판 편집 제한, 대상 개정판/도면 미선택 |

## 검증 및 한계

- 통합 frontend tsc --noEmit --pretty false 통과. git diff --check 통과.
- 담당 검증: 자재 출고요청 기존 구조16건, 품질/출하 관련6건 통과.
- 독립 공통소스 리뷰: 중첩button/import cycle 없음, 사유 우선순위와 버튼 액션명 보존, 너비 전달 확인.
- 직전 단계 localhost3002 입하실적 R26090800018의 표준 툴팁 hover/focus, body portal, opacity1 및 상태 첫컬럼을 실제 확인. 증거 `.playwright-cli/arrival-reprint-standard-tooltip-focused.png`.
- 확대 이후 생산화면 브라우저 재검증은 localhost3002 domcontentloaded15초 timeout으로 미완료. 모든 신규 툴팁의 실제 렌더 전수확인 완료를 주장하지 않음.
- 일반 입력 비활성, 단순 닫기/취소의 busy 상태, 서브공정 키팅(다른 소유자 stale lock 범위) 등은 이번 개별 사유 추가에서 제외. 전 화면 모든 disabled 컨트롤 처리완료가 아님.
- 업무데이터 쓰기나 운영 배포는 수행하지 않음.

## 영향 지도

- 공통: components/ui/Button.tsx → components/shared/HelpTooltip.tsx.
- 화면: components/material, components/shipping, authenticated/{material,quality,shipping,product,production}의 disabledReason 호출부.
- 기존 재발행: arrival-result/{page,arrivalResultColumns,reprintHint}.
- 기준: docs/design/buttons.md에 표준 툴팁·사유 작성 규칙 동기화.
- 다음 수정 시 disabled 조건과 설명 조건을 함께 읽고 실제 상태/필수입력과 일치하는지 검증할 것.

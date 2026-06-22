# 통전검사 실적(inspection/result) 소모성 설비부품 표시·스캔 장착

- 날짜: 2026-06-18
- 작업: T-INSPECT-RESULT-CONSUMABLE-MOUNT
- 범위: 프론트엔드만 (백엔드 변경 0건)

## 배경

`/production/input-kiosk` 좌측 패널에는 작업지시(모델 `itemCode` + 설비 `equipCode`)에
매핑된 **소모성 설비부품**을 표시하고, 실제 소모품 롯트의 바코드(`conUid`)를 스캔해
설비에 장착(MOUNTED)하는 기능이 있다. `/inspection/result`(통전검사 실적) 화면에도
동일한 표시·스캔 장착 기능을 추가한다.

검사 화면은 이미 좌측에서 작업지시를 선택하고 우측 `InspectPanel`이 `order.orderNo`를
받으므로, 키오스크가 쓰는 작업지시 기준 소모품 API 3종을 **그대로 재사용**할 수 있다.

## 결정 사항 (사용자 확정)

1. **설비 기준**: 키오스크와 동일하게 `jobOrder.equipCode`(작업지시에 배정된 생산 설비)
   기준으로 소모품을 표시한다. 검사 전용 설비를 따로 두지 않는다 → 백엔드 변경 없음.
2. **인터락**: 소모품 장착은 검사(PASS/FAIL)의 **선행 조건**이다. 매핑된 소모품 중
   미장착이 1건이라도 있으면 PASS/FAIL 버튼을 비활성화한다. 매핑 소모품이 0건이면
   장착 완료로 간주해 기존 검사 흐름을 막지 않는다.
3. **배치**: 좌측 작업지시 목록 **하단**에 카드형으로 표시한다(스캔 입력 내장).
   장착 인터락 배너와 PASS/FAIL 버튼은 우측 `InspectPanel`에 둔다.
   (초기안은 우측 통계 카드 아래였으나 사용자 요청으로 좌측 하단으로 이동.)

## 재사용 백엔드 API

- `GET    /production/job-orders/:orderNo/consumables`         — 매핑 소모품 + 장착 현황
- `POST   /production/job-orders/:orderNo/consumables/scan`    — `{ conUid }` 스캔 장착
- `DELETE /production/job-orders/:orderNo/consumables/:conUid` — 장착 해제

응답 행 형태는 키오스크 `KioskConsumableRow`와 동일:
`consumableCode, name, usagePerUnit, expectedLife, warningCount, mountedConUid, currentCount, lotStatus`.

## 컴포넌트 설계

### 신규: `inspection/result/components/ConsumablePanel.tsx`

- props
  - `orderNo: string`
  - `onStatusChange(allMounted: boolean, unmountedCount: number): void`
- 책임
  - 마운트/`orderNo` 변경/내부 `refreshSeq` 변경 시 GET으로 소모품 목록 조회
  - 카드 1개 안에: 헤더(`소모성 설비부품` + `장착수/전체`), 인라인 스캔 입력
    (`conUid`, Enter 장착 — kiosk의 별도 모달 대신 카드 내장), 소모품 행 목록
  - 행 표시는 `MaterialListPanel` 소모품 섹션 규칙을 따른다: 미장착=빨강 보더,
    장착=초록, 수명 `현재/예상` 표시, `warningCount` 초과=주황, `expectedLife` 초과=빨강,
    장착 행에 해제(X) 버튼
  - 스캔 성공 시 toast, 실패 시 서버 메시지(오장착 등) toast
  - 장착/해제/스캔 후 `refreshSeq`를 올려 재조회하고, 조회 결과로
    `allMounted`/`unmountedCount`를 계산해 `onStatusChange`로 부모에 보고
- 비의존: `kioskStore`를 쓰지 않는다(검사 화면은 키오스크 스토어를 쓰지 않음). 상태는
  컴포넌트 로컬로 관리한다.

### 상태 끌어올림: `inspection/result/components/InspectionResultWorkflow.tsx`

- `consumablesReady`(기본 true), `unmountedConsumCount`(기본 0) 상태와 `handleConsumableStatus` 콜백을 보유
- 좌측 컬럼을 flex-col로 재구성: 위=작업지시 목록 카드(flex-1), 아래=`<ConsumablePanel key={orderNo} orderNo={...} onStatusChange={handleConsumableStatus} />`(선택 시)
- `InspectPanel`에 `consumablesReady`/`unmountedConsumCount`를 props로 전달

### 수정: `inspection/result/components/InspectPanel.tsx`

- `consumablesReady`/`unmountedConsumCount`를 props로 받는다(상위에서 주입)
- 인터락 반영:
  - `passDisabled = passDisabled || !consumablesReady`
  - `scanDisabled`(FAIL 버튼 기준)도 `|| !consumablesReady`
  - 비활성 사유 툴팁에 미장착 시 `소모품 N개 미장착` 메시지를 우선 노출
- `order.orderNo` 변경 시 `ConsumablePanel`이 재조회 → `onStatusChange`로 자동 갱신
  (InspectPanel은 이미 `key={inspectType-orderNo}`로 재마운트됨)

## i18n (4파일 동시)

`inspection.result.*`에 전용 키 추가(ko/en/zh/vi):

- `consumablesTitle`        — "소모성 설비부품"
- `consumableScanPlaceholder` — "소모품 바코드(UID)를 스캔하세요"
- `consumableMountRequired` — "소모품 {{count}}개 미장착 — 검사 전 장착하세요"
- `noConsumables`           — "매핑된 소모품이 없습니다"
- `consumableMounted`       — "장착됨"

행 카운트의 단위(`개`) 등 공용 표현은 기존 키를 재사용한다.

## 검증

- `pnpm --filter @harness/frontend exec tsc --noEmit` 에러 0건
- 4개 로케일 JSON 파싱 OK(BOM 없음)
- 로컬 3002 브라우저:
  1. 매핑 소모품이 있는 작업지시 선택 → 미장착 시 PASS/FAIL 비활성 + 사유 표시
  2. `conUid` 스캔 장착 → 행 초록 전환, 전부 장착되면 PASS/FAIL 활성
  3. 해제(X) → 다시 비활성
  4. 매핑 소모품 0건 작업지시 → 소모품 카드는 "없음" 안내, 검사 버튼은 기존대로 동작

## 비목표(YAGNI)

- 검사 전용 설비/소모품 매핑 분리 (백엔드 변경) — 하지 않음
- 소모품 사용횟수 누적 로직 변경 — 생산실적 완료 시점의 기존 로직 유지
- 키오스크 컴포넌트(`ConsumableScanModal`, `MaterialListPanel`) 공용화 리팩토링 — 범위 밖

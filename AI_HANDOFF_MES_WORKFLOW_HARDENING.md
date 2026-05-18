# HANES MES Workflow Hardening Handoff

## 목적

이 문서는 HANES MES 백엔드에서 진행 중인 "제조 워크플로우 정합성 강화" 작업을 다른 AI가 이어받을 수 있도록 정리한 인수인계 문서다.

핵심 목표는 다음 두 가지다.

1. 뒤 공정이 이미 진행된 상태에서 앞 공정을 자동으로 강제 역처리하지 못하게 막는다.
2. 재고 수량 변경 시 `qty`, `reservedQty`, `availableQty`가 실제 운영 흐름과 어긋나지 않도록 강제한다.

---

## 이 작업의 기본 원칙

이 프로젝트에서는 아래 원칙으로 개선을 진행했다.

### 1. 강제 역처리 금지

- 앞 단계 취소/삭제/상태변경 시 뒤 공정이 이미 진행됐으면 바로 처리하지 않는다.
- 예외를 던지고 사용자에게 "뒤 단계부터 먼저 정리"하라고 안내한다.
- 예:
  - 생산실적 취소 전 박스/OQC/팔레트/출하 존재 여부 확인
  - 자재출고 취소 전 생산실적/FG 흐름 존재 여부 확인
  - 출하 역분개 전 ERP 연동 여부 확인

### 2. 상태 우회 방지

- `update()` 같은 일반 수정 API로 상태를 직접 덮어쓰지 못하게 한다.
- 상태는 전용 lifecycle API로만 바뀌게 만든다.
- 예:
  - `status` 직접 변경 차단
  - `delete()`로 공정 이력을 우회 제거하는 경로 차단

### 3. 예약수량/가용재고 정합성 유지

- 재고 감소, 이동, 폐기, 보정 시 `qty`만 보지 않는다.
- `reservedQty`, `availableQty` 기준도 함께 확인한다.
- 규칙:
  - `조정 후 qty < reservedQty` 이면 차단
  - `요청/이동/폐기 수량 > availableQty` 이면 차단
  - 예약 생성/해제 시 `availableQty`도 같이 갱신

### 4. 테스트 먼저 고정

- 실제 수정은 대부분 "정책 테스트 추가 -> 서비스 로직 수정 -> build/test 재실행" 순서로 진행했다.
- 가능한 한 서비스별 정책 스펙을 별도로 만들거나 기존 spec에 추가해 회귀를 막았다.

---

## 이미 반영된 핵심 개선 범위

아래는 이미 손댄 주요 서비스들이다.

### 생산 / 품질 / 출하

- `apps/backend/src/modules/production/services/prod-result.service.ts`
- `apps/backend/src/modules/production/services/job-order.service.ts`
- `apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts`
- `apps/backend/src/modules/quality/defects/services/defect-log.service.ts`
- `apps/backend/src/modules/quality/rework/services/rework.service.ts`
- `apps/backend/src/modules/quality/oqc/services/oqc.service.ts`
- `apps/backend/src/modules/shipping/services/box.service.ts`
- `apps/backend/src/modules/shipping/services/pallet.service.ts`
- `apps/backend/src/modules/shipping/services/shipment.service.ts`

적용 내용 예시:

- 생산실적 취소 시 후공정 존재하면 차단
- FG 라벨 무효화 시 포장/출하 진행됐으면 차단
- 박스 재오픈 시 OQC 완료 건이면 차단
- 출하 역분개 시 ERP 연동 완료 건이면 차단
- 일반 update/delete로 상태 우회 불가

### 자재 / 재고

- `apps/backend/src/modules/material/services/arrival.service.ts`
- `apps/backend/src/modules/material/services/receiving.service.ts`
- `apps/backend/src/modules/material/services/receipt-cancel.service.ts`
- `apps/backend/src/modules/material/services/iqc-history.service.ts`
- `apps/backend/src/modules/material/services/mat-issue.service.ts`
- `apps/backend/src/modules/material/services/issue-request.service.ts`
- `apps/backend/src/modules/material/services/physical-inv.service.ts`
- `apps/backend/src/modules/material/services/mat-stock.service.ts`
- `apps/backend/src/modules/material/services/adjustment.service.ts`
- `apps/backend/src/modules/material/services/scrap.service.ts`
- `apps/backend/src/modules/material/services/shelf-life-reinspect.service.ts`
- `apps/backend/src/modules/material/services/mat-out-request.service.ts`
- `apps/backend/src/modules/material/services/lot-split.service.ts`
- `apps/backend/src/modules/material/services/lot-merge.service.ts`
- `apps/backend/src/modules/material/services/mat-lot.service.ts`
- `apps/backend/src/modules/material/services/purchase-order.service.ts`

적용 내용 예시:

- 입하/입고취소 시 이미 뒤 단계 진행됐으면 차단
- 자재출고 취소 시 생산실적 이후 흐름 있으면 차단
- 요청수량 초과 출고 차단
- 실사 세션 없이 scan/apply 차단
- 수동 재고조정 시 예약수량 밑으로 조정 차단
- 재고 이동 시 동일 창고 이동 차단, availableQty 초과 이동 차단
- 폐기 시 availableQty 초과 차단
- 재검 FAIL 불용이동 시 예약 존재하면 차단
- 승인형 출고요청 시 `reservedQty`와 `availableQty` 동기화

---

## 최근 라운드에서 끝낸 작업

### 1. issue-request

파일:

- `apps/backend/src/modules/material/services/issue-request.service.ts`
- `apps/backend/src/modules/material/services/issue-request.service.spec.ts`

내용:

- 요청 항목이 없으면 차단
- 남은 요청수량보다 많이 출고하면 차단

### 2. physical inventory

파일:

- `apps/backend/src/modules/material/services/physical-inv.service.ts`
- `apps/backend/src/modules/material/services/physical-inv.service.spec.ts`

내용:

- 진행 중인 실사 세션이 없으면 `scanCount()` 차단
- 진행 중인 실사 세션이 없으면 `applyCount()` 차단

### 3. mat-stock

파일:

- `apps/backend/src/modules/material/services/mat-stock.service.ts`
- `apps/backend/src/modules/material/services/mat-stock.service.spec.ts`

내용:

- 수동 재고조정 시 `afterQty < reservedQty` 차단
- 동일 창고 이동 차단
- `availableQty < qty` 인 이동 차단

### 4. adjustment / scrap / shelf-life-reinspect

파일:

- `apps/backend/src/modules/material/services/adjustment.service.ts`
- `apps/backend/src/modules/material/services/adjustment.service.spec.ts`
- `apps/backend/src/modules/material/services/scrap.service.ts`
- `apps/backend/src/modules/material/services/scrap.service.spec.ts`
- `apps/backend/src/modules/material/services/shelf-life-reinspect.service.ts`
- `apps/backend/src/modules/material/services/shelf-life-reinspect.service.spec.ts`

내용:

- 보정 요청/승인/즉시반영 시 예약수량 이하로 내리는 보정 차단
- 폐기 시 availableQty 초과 차단
- 재검 FAIL 불용이동 시 예약 존재하면 차단

### 5. mat-out-request

파일:

- `apps/backend/src/modules/material/services/mat-out-request.service.ts`
- `apps/backend/src/modules/material/services/mat-out-request.service.spec.ts`

내용:

- 승인대기 요청 생성 시 `reservedQty`와 `availableQty` 함께 갱신
- 반려/취소 시 둘 다 함께 복구
- 승인 시 실재고 부족하면 차단

---

## 현재 남아 있을 가능성이 높은 개선 항목

이제 남은 것은 "큰 정책 구멍"보다는 "잔여 직접 변경 경로"와 "통합 검증" 쪽이다.

### 우선 점검 대상 서비스

아래 서비스는 아직 깊게 정리하지 않았거나 조회 위주로만 봤다.

- `apps/backend/src/modules/material/services/hold.service.ts`
- `apps/backend/src/modules/material/services/misc-receipt.service.ts`

점검 포인트:

- LOT HOLD/해제 시 뒤 공정과 충돌하는지
- 기타입고가 재고/예약/가용수량과 충돌하는지
- `qty`, `reservedQty`, `availableQty` 갱신이 일관적인지

### 통합 테스트 부족

모듈 단위 스펙은 많이 추가됐지만, 공정 연결형 통합 테스트는 아직 부족하다.

추천 순서:

1. `입하 -> IQC -> 입고 -> 자재출고 -> 생산실적 -> 취소`
2. `포장 -> OQC -> 출하 -> 역처리`
3. `예약 생성 -> 승인 -> 반려 -> 취소` 재고 정합성

### 화면/조회 정합성

서비스 로직은 많이 차단했지만, 화면이나 조회 API가 `availableQty`, `reservedQty`, 상태를 정확히 보여주는지는 별도 점검이 필요하다.

특히 다음 확인 필요:

- material 재고 조회 화면
- shipping 요약/상태 화면
- 생산실적/검사/FG 추적 조회

---

## 다음 AI가 작업할 때 권장 절차

### 1단계

직접 수량을 바꾸는 서비스만 우선 본다.

- `MatStock` update/save/create
- `StockTransaction` 생성과 함께 재고를 움직이는 서비스

### 2단계

아래 패턴이 보이면 같은 정책을 넣는다.

- 감소 계열
  - `afterQty < reservedQty` 차단
  - `qty > availableQty` 차단
- 예약 계열
  - `reservedQty` 변경 시 `availableQty`도 같이 갱신
- 상태 계열
  - 일반 update/delete로 우회 차단
- 역처리 계열
  - 뒤 공정이 있으면 차단하고 사용자 안내

### 3단계

수정 후엔 반드시 아래 순서로 검증한다.

1. 서비스 단위 spec 추가 또는 수정
2. 대상 spec만 단독 실행
3. `pnpm --filter backend build`

---

## 최근 테스트/검증 기준

최근 통과한 검증 예시:

- `pnpm --filter backend test -- --runInBand apps/backend/src/modules/material/services/issue-request.service.spec.ts apps/backend/src/modules/material/services/physical-inv.service.spec.ts`
- `pnpm --filter backend test -- --runInBand apps/backend/src/modules/material/services/mat-stock.service.spec.ts`
- `pnpm --filter backend test -- --runInBand apps/backend/src/modules/material/services/adjustment.service.spec.ts apps/backend/src/modules/material/services/scrap.service.spec.ts apps/backend/src/modules/material/services/shelf-life-reinspect.service.spec.ts`
- `pnpm --filter backend test -- --runInBand apps/backend/src/modules/material/services/mat-out-request.service.spec.ts`
- `pnpm --filter backend build`

---

## 주의사항

- 한국어 메시지가 일부 파일에서 콘솔/인코딩 문제로 깨져 보일 수 있다.
- 실제 파일 저장은 정상이어도 PowerShell 출력에서는 문자 깨짐이 보일 수 있다.
- `apply_patch`가 인코딩 때문에 실패한 경우가 있어, 일부 수정은 정확한 본문 기준으로 삽입했다.
- 설명할 때는 `잠겼다` 같은 표현보다 아래 표현을 사용한다.
  - `차단`
  - `강제`
  - `우회 방지`

---

## 한 줄 요약

이 작업은 "HARNESS MES의 모든 핵심 공정에서, 뒤 공정을 무시한 강제 역처리와 예약수량 무시 재고변경을 차단하는 것"이며, 지금은 대부분의 핵심 경로는 반영됐고 남은 일은 잔여 서비스 점검과 통합 시나리오 검증이다.

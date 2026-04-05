# Workflow Gap Checklist

## 목적

현재 구현 기준으로 HANES MES의 전체 워크플로우가 유기적으로 이어지는지 점검하고, 끊기는 지점을 수정 대상으로 정리한다.

이 문서는 코드 리뷰 결과를 바탕으로 Claude가 바로 수정 작업에 들어갈 수 있도록 만든 핸드오프 체크리스트다.

## 핵심 판단 기준

다음 기준을 만족해야 "유기적으로 흐른다"고 본다.

1. 앞 단계의 업무 엔티티가 다음 단계 엔티티와 명확한 키로 연결된다.
2. 취소와 역분개가 정확히 같은 업무 건만 되돌린다.
3. 상태 전이 문서와 실제 서비스 구현이 일치한다.
4. 상위 업무와 하위 실행 업무가 서로 분리되지 않고 연결 규칙이 명확하다.
5. 상태 변경과 재고 반영이 논리적으로 같은 트랜잭션 경계 안에 있다.

## 우선 수정 대상

### 1. 자재 흐름 연결 키 정리

가장 먼저 봐야 할 구간이다.

- 대상 흐름: `MatArrival -> IqcLog -> MatLot -> MatReceiving`
- 현재 문제: 여러 구간이 `itemCode` 기준으로만 연결된다.
- 결과 위험:
  - 같은 품목으로 다건 입하가 있으면 다른 입하 건을 잘못 취소할 수 있다.
  - IQC 취소 시 다른 LOT의 `iqcStatus`를 복원할 수 있다.
  - 입고 처리 시 현재 선택한 LOT와 무관한 입하 정보를 참조할 수 있다.

확인 파일:

- [arrival.service.ts](C:/Project/HANES/apps/backend/src/modules/material/services/arrival.service.ts)
- [iqc-history.service.ts](C:/Project/HANES/apps/backend/src/modules/material/services/iqc-history.service.ts)
- [receiving.service.ts](C:/Project/HANES/apps/backend/src/modules/material/services/receiving.service.ts)

핵심 라인:

- [arrival.service.ts:500](C:/Project/HANES/apps/backend/src/modules/material/services/arrival.service.ts#L500)
- [iqc-history.service.ts:347](C:/Project/HANES/apps/backend/src/modules/material/services/iqc-history.service.ts#L347)
- [iqc-history.service.ts:363](C:/Project/HANES/apps/backend/src/modules/material/services/iqc-history.service.ts#L363)
- [receiving.service.ts:286](C:/Project/HANES/apps/backend/src/modules/material/services/receiving.service.ts#L286)

Claude 작업 지시:

1. `itemCode` 대신 업무 단위를 식별할 수 있는 명시적 연결 키를 정한다.
2. `MatArrival`, `IqcLog`, `MatLot`, `MatReceiving` 사이 연결 필드를 정리한다.
3. 취소, 판정 취소, 입고 생성이 모두 같은 업무 건만 참조하도록 바꾼다.
4. 다건 입하/다건 LOT 시나리오를 기준으로 테스트를 만든다.

### 2. 출하지시와 실출하 관계 정리

- 현재 문제:
  - [ship-order.service.ts](C:/Project/HANES/apps/backend/src/modules/shipping/services/ship-order.service.ts)는 `DRAFT -> CONFIRMED -> SHIPPING -> SHIPPED`를 설명하지만 실제 구현은 CRUD 중심이다.
  - [shipment.service.ts](C:/Project/HANES/apps/backend/src/modules/shipping/services/shipment.service.ts)는 별도 상태머신 `PREPARING -> LOADED -> SHIPPED -> DELIVERED`로 움직인다.
- 결과 위험:
  - 출하지시가 실출하의 선행 문서인지, 별도 관리 문서인지 코드상 분명하지 않다.
  - 화면과 운영 절차에서 "출하지시 상태"와 "실출하 상태"가 서로 어긋날 수 있다.

확인 파일:

- [ship-order.service.ts](C:/Project/HANES/apps/backend/src/modules/shipping/services/ship-order.service.ts)
- [shipment.service.ts](C:/Project/HANES/apps/backend/src/modules/shipping/services/shipment.service.ts)

Claude 작업 지시:

1. `ship-order`와 `shipment`의 관계를 먼저 정책으로 확정한다.
2. 둘이 연결된 흐름이면 상태 전이와 참조 키를 코드에 추가한다.
3. 둘이 별도 흐름이면 문서와 주석에서 혼동되는 상태 설명을 제거한다.
4. API 문서와 컨트롤러 설명도 함께 정리한다.

### 3. 실출하 상태 변경과 재고 차감 원자성 점검

- 현재 문제:
  - [shipment.service.ts:472](C:/Project/HANES/apps/backend/src/modules/shipping/services/shipment.service.ts#L472) 이후 출하 상태, 팔레트, 박스, FG 라벨은 먼저 `SHIPPED`로 바뀐다.
  - 실제 제품 재고 차감은 그 뒤 [shipment.service.ts:554](C:/Project/HANES/apps/backend/src/modules/shipping/services/shipment.service.ts#L554) 이후 별도 단계에서 처리된다.
- 결과 위험:
  - 중간 실패 시 화면상 출하는 완료인데 재고는 차감되지 않는 상태가 생길 수 있다.

Claude 작업 지시:

1. 이 분리가 의도인지 먼저 확인한다.
2. 의도되지 않았다면 상태 변경과 재고 차감을 같은 트랜잭션 경계로 정리한다.
3. 의도된 분리라면 보상 로직과 재시도 전략을 명시적으로 넣는다.
4. 실패 시 어떤 상태가 남는지 테스트로 고정한다.

### 4. 생산실적 완료와 작업지시 완료 관계 정리

- 현재 문제:
  - [prod-result.service.ts:564](C:/Project/HANES/apps/backend/src/modules/production/services/prod-result.service.ts#L564)의 실적 완료와
  - [job-order.service.ts:406](C:/Project/HANES/apps/backend/src/modules/production/services/job-order.service.ts#L406)의 작업지시 완료가 별도 액션이다.
- 결과 위험:
  - 업무상 완료 기준이 실적인지 작업지시인지 화면과 API마다 달라질 수 있다.

Claude 작업 지시:

1. 실적 완료와 작업 완료의 정책 관계를 확정한다.
2. 자동 연동이 필요하면 한쪽 완료 시 다른 쪽이 따라가도록 정리한다.
3. 자동 연동이 불필요하면 두 개념의 차이를 문서와 주석에 명확히 적는다.

### 5. 문서와 구현 상태값 동기화

- 현재 문서 [05-production-process-flow.md](C:/Project/HANES/docs/diagrams/05-production-process-flow.md)는 현재 코드와 많이 어긋난다.
- 예:
  - `Prisma/Supabase` 표현
  - `PLANNED`, `IN_PROGRESS`, `READY` 등 현재 구현과 다른 상태값

Claude 작업 지시:

1. 실제 서비스 구현 기준으로 문서를 다시 쓴다.
2. 최소한 아래 상태머신은 현재 코드와 완전히 맞춘다.

대상 상태:

- 생산계획: `DRAFT -> CONFIRMED -> CLOSED`
- 작업지시: `WAITING -> RUNNING -> HOLD -> DONE/CANCELED`
- 출하: `PREPARING -> LOADED -> SHIPPED -> DELIVERED/CANCELED`
- 자재: `입하 -> IQC(PENDING/PASS/FAIL) -> 입고`

## 작업 순서

1. 자재 연결 키부터 정리
2. 출하지시와 실출하 관계 확정
3. 출하 재고 차감 원자성 정리
4. 생산실적/작업지시 완료 정책 정리
5. 문서 동기화

## 기대 산출물

Claude는 아래 결과를 남겨야 한다.

1. 수정된 서비스 코드
2. 필요한 경우 엔티티/컬럼/관계 수정
3. 최소한의 회귀 테스트
4. 갱신된 워크플로우 문서
5. "어떤 흐름이 어떻게 바뀌었는지" 요약

## 참고 파일

- [arrival.service.ts](C:/Project/HANES/apps/backend/src/modules/material/services/arrival.service.ts)
- [iqc-history.service.ts](C:/Project/HANES/apps/backend/src/modules/material/services/iqc-history.service.ts)
- [receiving.service.ts](C:/Project/HANES/apps/backend/src/modules/material/services/receiving.service.ts)
- [ship-order.service.ts](C:/Project/HANES/apps/backend/src/modules/shipping/services/ship-order.service.ts)
- [shipment.service.ts](C:/Project/HANES/apps/backend/src/modules/shipping/services/shipment.service.ts)
- [prod-result.service.ts](C:/Project/HANES/apps/backend/src/modules/production/services/prod-result.service.ts)
- [job-order.service.ts](C:/Project/HANES/apps/backend/src/modules/production/services/job-order.service.ts)
- [trace.service.ts](C:/Project/HANES/apps/backend/src/modules/quality/inspection/services/trace.service.ts)
- [05-production-process-flow.md](C:/Project/HANES/docs/diagrams/05-production-process-flow.md)

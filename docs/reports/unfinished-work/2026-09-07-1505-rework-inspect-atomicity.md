# 재작업 후 검사 원자 트랜잭션 보완

- 상태: IN_PROGRESS
- 완료: `passQty + failQty = resultQty` 검증, PASS/FAIL 판정별 수량 검증, 화면 사전 검증, 제품재고 외부 트랜잭션 참여 메서드 추가
- 미완료: `ReworkService.createInspect()` 전체를 `TransactionService` QueryRunner 하나로 감싸 검사 이력·REWORK_ORDERS·DEFECT_LOG·제품재고 이동을 단일 커밋으로 처리
- 사유: 현재 createInspect는 기존 저장소 호출과 제품재고 서비스 호출이 분리되어 있어, 호출부를 QueryRunner 기반으로 전환하고 관련 테스트 mock을 함께 갱신해야 함
- 검증: `rework.service.spec.ts` 15건 통과, backend/frontend tsc 통과 전환 중

## 보완 완료
- ReworkService.createInspect가 TransactionService QueryRunner를 사용하도록 전환됨.
- 제품재고 이동과 보충 입고도 동일 QueryRunner에 참여함.
- 검증: rework.service.spec.ts 15건, backend/frontend tsc 통과.

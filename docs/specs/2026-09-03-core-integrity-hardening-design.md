# 채번·재고 동시성·tenant 무결성 강화 설계

## 목표

동시 UI 요청에서도 업무번호 중복, 재고 lost update, tenant 간 채번 혼선을 방지하고 같은 위험 패턴의 재유입을 CI에서 차단한다.

## 범위

- 런타임 `MAX+1`, 마지막 번호 조회 후 증가, 날짜별 Sequence 재시작을 금지한다.
- 업무번호 형식의 날짜는 표시용으로 유지하되 유일성 카운터는 유형별 전역 Oracle Sequence 하나만 사용한다.
- 재고 증감은 DB 원자 연산과 조건부 UPDATE로 처리하며 영향 행 수가 0이면 충돌 또는 부족으로 실패한다.
- 신규 전환 채널은 `SEQ_RULES -> PKG_SEQ_GENERATOR -> Oracle Sequence`만 사용한다. `NUM_RULE_MASTERS.CURRENT_SEQ`, `RESET_TYPE`, `LAST_RESET`은 신규 채번의 source of truth로 사용하지 않는다.
- 기존 Sequence 생성 migration의 시작값 산출용 `MAX+1`만 명시적인 예외로 둔다.

## 구현 경계

1. `numbering-policy.spec.ts`가 신규 금지 패턴을 검사한다.
2. `NumberingService`의 2026-09-03 신규 전환 타입은 `SeqGeneratorService`로 라우팅한다. 기존 `NUM_RULE_MASTERS` 호출은 호출부 tenant 계약을 별도 단계에서 바꾸기 전까지 확대하지 않는다.
3. `SEQ_RULES`는 포맷과 유형별 Sequence 이름만 보유하고 카운터는 보유하지 않는다. 신규 Sequence는 `NOCYCLE`, 일별·월별 재시작 없음으로 생성한다.
4. 우선 핵심 `InventoryService`, `ProductInventoryService`의 출고·이동·취소 경로를 원자 갱신한다. 증가 경로는 원자 UPDATE 후 없는 행 INSERT를 시도하고, PK 경쟁 시 UPDATE 재시도로 수렴한다.
5. `QTY >= 0`, `RESERVED_QTY >= 0`, `AVAILABLE_QTY >= 0`, `AVAILABLE_QTY = QTY - RESERVED_QTY` 불변식은 기존 데이터 pre-check 후 적용하고 ERD를 재생성한다.

## 오류 처리

- 조건부 차감의 영향 행이 0이면 재조회해 `재고 부족` 또는 `동시 변경` 오류를 반환한다.
- 채번 규칙이 없으면 번호를 임의 생성하지 않고 실패한다. Legacy `NUM_RULE_MASTERS` tenant 계약 변경은 전체 호출부 전환이 필요한 후속 작업으로 남긴다.
- 번호 폭을 초과해도 순환하거나 1로 재시작하지 않고 명시적으로 실패한다.

## 검증

- 금지 패턴 Architecture Test RED/GREEN
- 신규 채널의 `SeqGeneratorService` 라우팅과 전역 Sequence 단위 테스트 RED/GREEN
- Jest에서 SQL/bind/affected 오류를 검증하고 JSHANES 격리 테스트 행에 실제 동시 차감을 실행한다.
- backend typecheck와 focused Jest
- JSHANES Sequence·제약 pre-check/post-check 및 잔여 데이터 0건 확인

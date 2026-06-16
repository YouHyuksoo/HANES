# 입하재고 분리 마이그레이션 사전 점검

- 실행일: 2026-06-16 11:33 KST
- 대상 DB: JSHANES
- 대상 테넌트: COMPANY `40`, PLANT_CD `1000`
- 상태: APPLIED

## 요약

입하재고 테이블 분리 마이그레이션을 적용하기 전 dry-run 조회를 수행했다. 현재 데이터는 단순 `MAT_IN - RECEIVE` 기준으로 바로 이관할 수 없다.

차단 사유는 두 가지다.

1. `RECEIVE`는 있으나 대응 `MAT_IN`이 없는 legacy UID가 있다.
2. 입하 후 미입고 후보로 산출되는 UID 중 이미 자재출고로 소진되어 `MAT_STOCKS`에 차감 가능한 수량이 없는 행이 있다.

따라서 현재 상태에서 `MAT_STOCKS`에서 입하재고를 일괄 차감하면 음수 재고 또는 불일치가 발생한다. 사용자는 마이그레이션 기준과 어긋나는 데이터는 삭제해도 된다고 승인했다. 다만 추가 조회 결과 `RECEIVE`만 있는 UID에도 `MAT_OUT`/`MAT_ISSUES`가 연결된 건이 있어, 정상 출고 이력을 삭제하지 않는 방식으로 보정한다.

## 현재 수불 합계

| TRANS_TYPE | STATUS | 건수 | 수량 |
|---|---:|---:|---:|
| MAT_IN | DONE | 57 | 322,303 |
| RECEIVE | DONE | 44 | 316,303 |

`MAT_IN` 중 `MAT_UID IS NULL`인 행은 0건이다.

## Pending 산출 결과

| 구분 | 건수 | 입하수량 | 입고수량 | Pending |
|---|---:|---:|---:|---:|
| POSITIVE_PENDING | 36 | 6,023 | 0 | 6,023 |
| ZERO | 21 | 316,280 | 316,280 | 0 |
| NEGATIVE_PENDING | 23 | 0 | 23 | -23 |

`NEGATIVE_PENDING` 23건은 `RECEIVE`가 있지만 같은 `MAT_UID` 기준 `MAT_IN`이 없는 데이터다. 예시는 `M26061200054`, `M26061200069`, `M26061200076` 등이다.

## 차감 불가 행

`MAT_STOCKS`에서 입하재고 후보 수량을 차감할 수 없는 행이 1건 있다.

| ITEM_CODE | MAT_UID | pending_qty | stock_qty | available_qty |
|---|---|---:|---:|---:|
| HSG0001 | VH1-RM260612-00011 | 3 | 0 | 0 |

해당 UID의 수불 내역:

| TRANS_TYPE | 창고 | 수량 | REF |
|---|---|---:|---|
| MAT_IN | W001 | 3 | ARRIVAL / R26061200002 |
| MAT_OUT | W001 | -1 | MAT_ISSUE / ISS20260612-0002-1 |
| MAT_OUT | W001 | -1 | MAT_ISSUE / ISS20260612-0004-1 |
| MAT_OUT | W001 | -1 | MAT_ISSUE / ISS20260612-0006-1 |

현재 `MAT_STOCKS`는 W001 기준 `QTY=0`, `AVAILABLE_QTY=0`이다. 이 데이터는 `RECEIVE` 없이 출고까지 진행된 legacy 흐름으로 보이며, 입하재고로 3을 옮기면서 `MAT_STOCKS`를 차감할 수 없다.

## 결론

마이그레이션 SQL 작성은 계속 가능하지만, live DB 적용은 중단해야 한다. 먼저 기존 데이터 보정 정책을 결정해야 한다.

확정 보정 방향:

1. `NEGATIVE_PENDING` 23건은 입고 이후 창고재고 수불로 남기고, 입하재고로 역산하지 않는다. 이 23건에는 `MAT_RECEIVINGS` 23건, `MAT_LOTS` 23건, `MAT_STOCKS` 23건, `MAT_ISSUES` 10건, `STOCK_TRANSACTIONS.MAT_OUT` 11건이 연결되어 있어 일괄 삭제하면 출고 이력이 깨진다.
2. `VH1-RM260612-00011`처럼 이미 출고로 소진된 `MAT_IN`은 입하재고 현재고(`MAT_ARRIVAL_STOCKS`)로 만들지 않는다. 대신 입하원장(`MAT_ARRIVAL_TRANSACTIONS`)에는 `ARRIVAL_IN`으로 이관하되, 현재고는 0으로 본다.
3. `MAT_ARRIVAL_STOCKS` 생성 기준은 단순 `MAT_IN - RECEIVE`가 아니라 `MIN(pending_qty, current_mat_stock_qty)`로 제한한다.
4. 기존 `STOCK_TRANSACTIONS.MAT_IN`은 새 `MAT_ARRIVAL_TRANSACTIONS.ARRIVAL_IN`으로 백업/복사한 뒤 `STOCK_TRANSACTIONS`에서 삭제한다. 이 삭제는 입하수불 원장 분리에 따른 삭제이며, 입고/출고 수불은 보존한다.

현재 dry-run 기준으로 안전한 입하재고 현재고 생성 후보는 `POSITIVE_PENDING` 36건 중 차감 불가 1건을 제외한 35건이며, 수량은 6,020이다.

## 추가 dry-run

| 항목 | 값 |
|---|---:|
| `NEGATIVE_PENDING` UID | 23 |
| `NEGATIVE_PENDING` RECEIVE 수량 | 23 |
| `NEGATIVE_PENDING` MAT_STOCKS 수량 | 14 |
| `NEGATIVE_PENDING` MAT_RECEIVINGS 행 | 23 |
| `NEGATIVE_PENDING` MAT_LOTS 행 | 23 |
| `NEGATIVE_PENDING` MAT_ISSUES 행 | 10 |
| `NEGATIVE_PENDING` MAT_OUT 행 | 11 |
| 안전한 입하재고 생성 UID | 35 |
| 안전한 입하재고 생성 수량 | 6,020 |
| 차감 제외 UID | 1 |
| 차감 제외 수량 | 3 |

## 실행한 검증

- `STOCK_TRANSACTIONS` 타입별 합계 조회
- `MAT_IN`의 `MAT_UID IS NULL` 여부 조회
- `MAT_UID`별 `MAT_IN - RECEIVE` pending 산출
- pending 수량 대비 `MAT_STOCKS` 차감 가능 여부 조회
- 차감 불가 UID `VH1-RM260612-00011`의 수불/재고/LOT 상세 조회

## 적용 결과

- 적용 시각: 2026-06-16 KST
- 실행 파일: `apps/backend/src/migrations/2026-06-16_mat_arrival_stock_split.sql`
- 실행 도구: `C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file`
- 실행 결과: 12개 블록 모두 성공

적용 후 DB 검증:

| 항목 | 건수 | 수량 |
|---|---:|---:|
| `MAT_ARRIVAL_TRANSACTIONS` | 57 | 322,303 |
| `MAT_ARRIVAL_STOCKS` | 35 | 6,020 |
| `STOCK_TRANSACTIONS` 잔존 `MAT_IN`/`MAT_IN_CANCEL` | 0 | 0 |
| `STOCK_TRANSACTIONS` `RECEIVE` | 44 | 316,303 |
| `STOCK_TRANSACTIONS_BAK_20260616` | 57 | 322,303 |
| `MAT_STOCKS_BAK_20260616` | 35 | 6,020 |

코드 반영:

- `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS` TypeORM 엔티티 추가
- IQC005 입하 기록을 `MAT_STOCKS`/`STOCK_TRANSACTIONS.MAT_IN` 대신 입하재고/입하원장으로 변경
- 정상 입고 확정 시 `MAT_ARRIVAL_STOCKS` 감소 후 `MAT_STOCKS` 증가로 변경
- 특채 입고는 기존처럼 실제 창고재고에서 차감
- 입하 이력/통계/입하취소 조회 기준을 `MAT_ARRIVAL_TRANSACTIONS`로 변경
- 수불이력 화면의 `MAT_IN`/`MAT_IN_CANCEL` 필터 옵션 제거
- 입하 이력 컴포넌트 타입을 `ARRIVAL_IN`/`ARRIVAL_CANCEL`로 변경
- `docs/reports/db-schema-erd.md` 갱신

검증:

- `pnpm --filter @harness/backend build`
- `pnpm --filter @harness/backend test -- arrival.service.spec.ts receiving.service.spec.ts inventory-query.service.spec.ts`
- `pnpm --filter @harness/frontend build`
- API 직접 호출은 `http://localhost:3003/api/v1/inventory/transactions?limit=20`에서 401 인증 오류로 응답되어, 인증 없는 직접 확인은 수행하지 못했다.

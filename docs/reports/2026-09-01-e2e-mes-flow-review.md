# HANES MES 입고~출하 종단 리뷰

- 작성: 2026-09-01
- HEAD: `2240cb2c`
- 범위: 자재 입하/IQC/AQL/입고 → 작업지시/공정수불 → 실적/초중종/취소 → 포장/OQC/출하
- 방법: Controller → Service → Entity 추적 + JSHANES(`40`/`1000`) 설정·건수 조회
- 코드 수정 없음

운영 설정 (JSHANES SYS_CONFIGS):

| 키 | 값 | 의미 |
|---|---|---|
| `MAT_AUTO_ISSUE_TIMING` | `ON_CREATE` | 실적 등록 시 BOM 소비 |
| `MAT_ISSUE_STOCK_CHECK` | `WARN` | 재고 부족해도 가용분만 차감하고 실적 진행 |
| `OQC_ENABLED` | `N` | OQC PASS 게이트 꺼짐 |
| `IQC_AUTO_RECEIVE` | `N` | IQC 후 수동 입고 |

---

## 한 줄 결론

메인 체인은 연결되어 있다. 다만 **OQC가 꺼져 있고**, **공정 자재 부족이 경고만**이며, **초중종/일부 역분개는 화면 또는 전표 종류에 따라 빠지는 구멍**이 있다.

---

## 정상으로 확인된 것

1. **입하는 창고재고가 아니다.** `receivePoLine`은 `MAT_LOTS` + `MAT_ARRIVAL_STOCKS` + `MAT_ARRIVAL_TRANSACTIONS(ARRIVAL_IN)`만 올린다. `MAT_STOCKS`는 입고에서 시작한다.
2. **입하단위 IQC 판정은 서버 AQL이 최종이다.** `POST /material/iqc-history/arrival`은 `finalResult = aqlPolicy.result`로 LOT을 갱신한다. 프론트 `result`는 저장에 안 쓴다. Ac/Re는 `AQL_CODE_LETTER_RULES` / `AQL_CODE_LETTER_SAMPLES` / `AQL_ACCEPTANCE_RULES`.
3. **입고는 IQC PASS 또는 특채만.** `receiving.service.ts` `iqcStatus === 'PASS' OR (FAIL AND specialAcceptYn='Y')`.
4. **출고는 IQC PASS LOT만.** `mat-issue.service.ts` `iqcStatus !== 'PASS'` 거부.
5. **실적 취소는 키오스크 경로의 수불을 되돌린다.** `cancel`/`delete` → `reverseResultInTx`: WIP `PROD_CONSUME` ADD_BACK, 제품재고 역분개, IN_STOCK SG 삭제. FG `PACKED`/`SHIPPED`면 차단.
6. **자동차감은 한 시점만 탄다.** create=`ON_CREATE`, complete=`ON_COMPLETE`. 현재 운영값은 `ON_CREATE`이고 키오스크 실적은 생성 시 `DONE`이라 이 설정과 맞다.
7. **설비 장착 소비는 WIP만 친다.** auto-issue는 `WIP_MAT_STOCKS`에서 `PROD_CONSUME`. `MAT_STOCKS` 이중차감 없음.
8. **미포장 FG 단독 출하 API는 없다.** `shipBox`/`shipOrderPallets`는 `CLOSED` 박스만.
9. **출하취소 본체는 `/shipping/return` CRUD가 아니다.** `cancelOrderShipment` + `reverseShipmentInTx`가 팔레트/박스/지시수량/FG 재고를 한 TX에서 되돌린다.

---

## 지금 운영에서 확인된 문제

### 1. OQC 게이트가 꺼져 있다 — 운영버그

- 코드: `OQC_ENABLED==='Y'`일 때만 FAIL/PENDING 적재·출하 차단 (`ship-order.service.ts` 적재/박스출하/팔레트출하).
- JSHANES: `OQC_ENABLED='N'`.
- 데이터: `BOX_MASTERS` SHIPPED 100건 전부 `OQC_STATUS='PENDING'`. FAIL 박스는 0건.
- 영향: 출하 전 최종검사가 정책으로 막히지 않는다. 코드 가드는 있으나 운영에서 꺼져 있다.

### 2. 공정 자재 부족이 실적을 막지 않는다 — 운영버그

- 코드: `MAT_ISSUE_STOCK_CHECK` 기본 `BLOCK`, `WARN`이면 가용분만 차감 (`auto-issue.service.ts`, `wip-mat-stock.service.ts`).
- JSHANES: `WARN`.
- 영향: BOM 소요량보다 장착 재고가 모자라도 실적이 저장되고, 수불은 일부만 남는다.

### 3. IQC FAIL 실데이터는 현재 0건

- `IQC_LOGS.RESULT='FAIL'` 0, `MAT_LOTS.IQC_STATUS='FAIL'` 0.
- FAIL 불용창고 이동 버그(아래)는 코드상 존재하나, 지금은 터지지 않은 상태다.

---

## 코드로 증명된 구멍

### 자재 입고 / AQL

| 심각도 | 내용 | 근거 |
|---|---|---|
| 운영버그 | IQC FAIL 불용창고 이동이 입하 단계에서는 no-op. `handleIqcFail`은 `MAT_STOCKS`만 보고, 입하재고(`MAT_ARRIVAL_STOCKS`)는 안 옮긴다. | `iqc-history.service.ts` 761-764, `arrival.service.ts` 입하=arrival stock only |
| 운영버그 | 특채 입고는 입하재고를 안 줄이고 `MAT_STOCKS`에서 차감한다. 출고는 여전히 `iqcStatus==='PASS'`만 허용해서 특채 LOT은 생산 출고가 막힌다. | `receiving.service.ts` 442-520, `mat-issue.service.ts` 204-206 |
| 역분개구멍 | 입고취소가 `MAT_ARRIVAL_STOCKS`를 복원하지 않는다. 재입고/입하취소가 수량 부족으로 막힌다. | `receipt-cancel.service.ts` 171-218 |
| 운영버그 | 라벨발행 `POST /material/receive-label/create`는 IQC PASS 입하에 **새** `MAT_LOTS`(initQty=1, iqcStatus=PASS)를 추가 생성한다. 입하 `po-line` LOT과 이중. 새 UID는 입하재고가 없어 입고가 실패한다. | `receive-label.service.ts` 131-166, `useLabelIssue.ts` 66-71 |
| 흐름구멍 | `POST /material/iqc-history`(LOT 단건)는 AQL을 안 타고 `dto.result`를 그대로 저장한다. | `iqc-history.service.ts` createResult |
| 흐름구멍 | 파괴시료 `autoIssueDestructSample`도 `MAT_STOCKS` 없으면 return. 입하 IQC에서는 시료 수불이 안 나간다. | `iqc-history.service.ts` 820-823 |

AQL 자체 판정 로직(Critical 즉시 FAIL, Major/Minor Ac 초과 FAIL, 항목 하나 FAIL이면 LOT FAIL)은 입하 API 경로에서 정상이다.

### 작업지시 / 공정 자재수불

정상 경로: 출고요청에 `processCode` 있음 → `MAT_STOCKS` 차감 + `PROC_MAT_STOCKS(PROC_IN)` → 설비 장착 `PROC_MOUNT` → `WIP_MAT_STOCKS(WIP_IN)` → 실적 `PROD_CONSUME`.

| 심각도 | 내용 | 근거 |
|---|---|---|
| 운영버그 | `/material/issue` 스캔 출고 DTO에 `processCode`가 없다. `MAT_OUT`만 발생하고 공정재고가 안 오른다. 이후 장착은 “공정재고 없음”. | `scan-issue.dto.ts` 15-40, `mat-issue.service.ts` 189-192 |
| 흐름구멍 | 출고요청 `processCode` optional. 공정 없이 출고하면 같은 `MAT_OUT` only. | `issue-request.dto`, `WorkOrderRequestPanel` |
| 운영버그 | 키팅 소비 `refType='ASSEMBLY'/'SUBKIT'`. 실적 취소는 `refType='PROD_RESULT'`만 복원. 키팅 전용 cancel API 없음. | `subprocess-kitting.service.ts` 308-321, `prod-result.service.ts` 1537-1545 |
| 흐름구멍 | 키오스크 실적(auto-issue)과 조립키팅이 같은 지시에서 같이 쓰면 WIP가 두 번 빠질 수 있다. 상호 차단 없음. | create ON_CREATE + kitting deduct |
| 흐름구멍 | `ROUTING_MATERIALS`가 비면 해당 실적에서 BOM 전체를 뺀다(점진 전환 주석). | `auto-issue.service.ts` 170-197 |
| 흐름구멍 | 작업지시 `cancel`/`delete`는 재고를 안 되돌린다(실적 있으면 거절). | `job-order.service.ts` |

### 생산실적 / 초중종 / 역분개

| 심각도 | 내용 | 근거 |
|---|---|---|
| 흐름구멍 | 초중종은 실적 저장의 서버 선행조건이 아니다. FIRST는 `productionType` MASS/TRIAL만 결정. | `prod-result.service.ts` 543-561, 703 |
| 흐름구멍 | 키오스크: FIRST는 **첫 저장 이후** 유도. LAST는 submit 차단 목록에 없음. MID만 진행률(`QC_MID_BLOCK_PCT` 기본 60%)에서 막는다. | `input-kiosk/page.tsx` 344-393 |
| 흐름구멍 | `SELF_INSPECT_BATCH_WINDOW_MS=10000`은 초/중/종 누락을 숨기지 않고, FIRST 최신 ±10초 묶음이 전부 PASS인지만 본다. 항목 마스터 대비 누락 검사 없음. | `prod-result.service.ts` 62, 530-541 |
| 역분개구멍 | WIP `restoreInTx`는 원본 `PROD_CONSUME`을 CANCELED로 안 바꾸고 CANCEL 전표만 추가. 실적 수량 수정이 두 번이면 원본+신규를 다시 ADD_BACK → 이중 복원. | `wip-mat-stock.service.ts` 281-344, `prod-result.service.ts` 892-904 |
| 역분개구멍 | 양품↔불량만 바꾸면 합계가 같아 제품재고를 재동기화하지 않는다. | `qtyChanged` = totalQty만 |
| 흐름구멍 | `/production/result` 화면은 DELETE만 있고 `POST :resultNo/cancel`(이력 보존 취소)을 안 쓴다. | `result/page.tsx` |
| 채번 | `prdUid` 폴백이 `{orderNo}-NNN` MAX+1. | `prod-result.service.ts` 2035-2055 |

의도된 동작: 초물은 시생산(TRIAL) 실적 저장 후 검사. 첫 실적을 FIRST 없이 저장하는 것은 키오스크 설계와 같다. 서버 API 직접 호출과 LAST 미강제는 구멍이다.

### 포장 / 출하 / 역분개

| 심각도 | 내용 | 근거 |
|---|---|---|
| 운영버그 | 완제품 박스입고 전표는 `WIP_OUT`(FG 이동)인데 `/product/receive`·`/product/receipt-cancel` 필터가 `FG_IN` 위주라 웹에서 안 보이거나 취소 대상이 안 잡힌다. | `product-inventory.service.ts` receiveFinishedFromWip, receive/receipt-cancel 페이지 필터 |
| 역분개구멍 | 제품입고취소가 박스 SHIPPED/팔레트/`FG_OUT`을 안 본다. 재고만 충분하면 출하 이후에도 FG를 되돌릴 수 있다. | `cancelTransactionInTx` 737-844 |
| 흐름구멍 | `reopenBox`는 제품입고 여부를 안 본다. 입고 후 재오픈 시 재고와 박스 시리얼이 어긋날 수 있다. | `box.service.ts` 699-733 |
| 흐름구멍 | 출하가 박스 입고(`refType=BOX`) 여부를 안 보고 FG 창고 FIFO만 친다. 미입고 박스라도 동일 품목 재고가 있으면 출하된다. | `ship-order.service.ts` shipBox/shipOrderPallets |
| 흐름구멍 | `POST /shipping/boxes/:id/assign-pallet`는 OQC 미검사. 화면 기본 경로는 출하지시 API라 막히지만 API는 열려 있다. | `box.service.ts` assignToPallet |
| 채번 | 제품전표 `generateTransNo`, OQC 요청번호가 MAX+1. | `product-inventory.service.ts` 104-123, `box.service.ts` 103-118 |

`ShipReturnService`는 고객반품 DRAFT CRUD이며 재고 역분개가 없다. 출하 역분개 화면은 `cancelOrderShipment`를 쓴다.

---

## 흐름별 판정

```
발주 → 입하(도착대기) → [라벨?] → IQC(AQL) → 입고(창고) → 출고(공정) → 장착(WIP)
  → 작업지시 → 키오스크/키팅 실적 → 포장 → [OQC] → 팔레트 → 출하
```

- 입하→IQC→입고 게이트: **코드상 존재**. FAIL 처리·특채 출고·입고취소 입하재고는 구멍.
- 라벨: 워크플로 맵은 IQC 전인데, API는 IQC PASS 후에 새 LOT을 만든다. **맵과 코드가 다름**.
- 공정 수불: 출고요청+processCode 경로만 정상. 스캔 출고는 공정 이동이 빠짐.
- 실적 자재: `ON_CREATE`면 키오스크는 맞음. `WARN`이라 부족 실적 가능.
- 초중종: 화면 유도/MID 차단만. 서버 강제 없음.
- 실적 취소: 키오스크 `PROD_RESULT` 경로는 됨. 키팅 `ASSEMBLY`는 안 됨.
- 포장→출하: 박스 단위는 됨. OQC는 설정 OFF. 입고 전 출하·입고취소 vs 출하 가드 약함.

---

## 우선 고칠 것 (추천 순서)

1. `OQC_ENABLED`를 켤지, 아니면 PENDING 출하를 허용할 운영 정책인지 확정. 현재 출하 100박스 전부 PENDING.
2. `MAT_ISSUE_STOCK_CHECK=WARN`을 `BLOCK`으로 올릴지 확정. 부족 실적이 재고 원장을 어긋나게 한다.
3. 입고취소 → `MAT_ARRIVAL_STOCKS` 복원.
4. 스캔 출고에 `processCode` 필수 + PROC_IN.
5. 키팅 취소 = `ASSEMBLY`/`SUBKIT` WIP·제품 역분개.
6. 라벨발행을 기존 입하 LOT 인쇄만 하게 바꾸고 신규 LOT 생성 제거.
7. 초중종: LAST/MID FAIL을 서버에서도 막을지 정책 확정.
8. 제품입고취소에 SHIPPED 박스 가드, 웹 전표 필터를 `WIP_OUT` 포함.

---

## 이번에 안 한 것

- 브라우저로 화면을 눌러 재현하지 않음.
- AQL 표 숫자 vs ISO 2859 값 대조 안 함.
- 키오스크 실적 수량 수정 2회 운영 건 실데이터 미조회.
- 소모품/금형 타수 역분개 상세는 complete 경로 전제라 키오스크(생성=DONE)와 단절된 점만 확인.

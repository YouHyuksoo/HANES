# 자재분할/병합 재설계 (채번규칙 정렬)

작성: 2026-06-08 (claude) · 승인: 사용자
근거: `HANES_MES_채번규칙.pptx` (분할/병합 섹션), 스테이크홀더(행성) 지적 #4·#5·#6
대상: `apps/backend/src/modules/material/services/lot-split.service.ts`, `lot-merge.service.ts` + 프론트 `material/lot-split`, `material/lot-merge`

## 배경 / 현황 버그
- **#4 분할 안 됨 = 실제 버그**: `lot-split.service.split()`이 신규 MatLot 생성 시 `currentQty`를 설정하지 않음 → `MAT_LOTS.CURRENT_QTY` NOT NULL 위반 → **모든 분할이 500(ORA-01400)**. (재현 확인 2026-06-07)
- 현재 모델이 pptx와 **핵심적으로 다름**: 분할은 원본 잔량 유지+신규 1개, 병합은 대상 LOT 재사용. pptx는 "원 시리얼 전부 폐기→결과 전부 신규 발번".
- 채번이 비표준(`앞10자-S001`, `SPL/MRG` Like-증가) → `feedback_use_oracle_sequence` 위반.
- 게이팅 없음: 재고만 있으면 입하 시점에도 분할/병합 가능.

## 승인된 모델 (pptx 기준)
**원 시리얼을 전부 폐기(사용불가)하고 결과 조각을 모두 신규 시리얼로 발번한다.** 원 시리얼은 자재수불(StockTransaction)로만 추적.

### 공통 규칙
- **게이팅(#5)**: **입고완료 LOT만** 대상. 판정 = 해당 matUid의 `STOCK_TRANSACTIONS(TRANS_TYPE='RECEIVE', STATUS<>'CANCELED')` 합 ≥ `MatLot.initQty` (IQC006 `getArrivalSerials`와 동일 기준). 목록 쿼리(`findSplittableLots`/`findMergeableLots`)에 이 조건 추가.
- **신규 시리얼 채번**: `numbering.nextMatSerial(qr, txDate=오늘)` → `VH1-RM + YYMMDD(오늘) + 5자리`(Oracle `SEQ_MAT_SERIAL_DAILY`). **날짜=오늘**(일별 시퀀스 충돌 회피). 추적은 `origin` 컬럼으로.
- **계승**: 신규 LOT은 `origin`(최초시리얼; 원본의 `origin ?? 원본 matUid`), `arrivalNo`/`arrivalSeq`(입하실적코드), `itemCode`, `expireDate`, `vendor`, `mfgPartnerCode`, `invoiceNo`, `poNo`, `iqcStatus` 계승. `initQty=currentQty=조각수량` **반드시 설정**(#4 수정).
- **수불**: 원 LOT 전량 OUT → 신규 IN. 트랜잭션 번호는 **`STOCK_TX` 채번 채널**(`numbering.next('STOCK_TX', qr)`) 사용. transType: 분할 `LOT_SPLIT_OUT`/`LOT_SPLIT_IN`, 병합 `LOT_MERGE_OUT`/`LOT_MERGE_IN`.
- **MatStock**: 원본 재고 0(또는 행 삭제 대신 0) + 신규 matUid 재고 생성. 원 LOT status → `SPLIT`/`MERGED`(사용불가, 목록 제외).
- **라벨**: 신규 시리얼 자재라벨 발행(분할/병합 모두). 프론트는 기존 `MatLabelPreviewModal` 재사용.
- **기존 검증 유지**: 출고이력 없음, 예약수량(reservedQty) 없음, HOLD 아님, isSplittable='N' 차단(분할).
- **박스 채번: 범위 외** — 본 시스템은 자재 LOT에 박스를 추적하지 않음(`box-master`는 생산/출하 전용, BX 채번 미사용). pptx 박스 규칙은 생산/출하 영역에서 별도 처리.

### 분할 (2분할)
- 입력: `sourceLotId`, `splitQty`(< 원본 재고).
- 처리: 원본 전량 OUT → **신규 2개**(`splitQty`, `원본재고-splitQty`) 발번. 둘 다 origin/arrival 계승, 각 라벨.
- 원본 status=`SPLIT`, 재고 0.

### 병합 (바코드 스캔)
- 입력: 스캔으로 누적한 `matUid[]` (2개 이상).
- 검증: 동일 `itemCode` + 동일 `origin`(최초시리얼). 입고완료·미출고·미예약·비HOLD.
- 처리: 원 시리얼 전부 OUT → **신규 통합 시리얼 1개**(합산 수량) 발번, origin/arrival 계승, 라벨.
- 프론트: 리스트 다중선택 → **바코드 스캔 입력 박스**(스캔/엔터 시 `GET /material/lot-merge` 또는 by-barcode 조회로 검증 후 누적 리스트에 추가) 방식으로 전환.

## 영향 파일
- 백엔드: `lot-split.service.ts`(split 재작성+findSplittableLots 게이팅), `lot-merge.service.ts`(merge 재작성+findMergeableLots 게이팅), 두 DTO(분할 splitQty 유지/병합 sourceLotIds 유지), 채번은 NumberingService 사용. 신규 LOT status 코드(`SPLIT`/`MERGED`) 처리.
- 프론트: `lot-split/page.tsx`(분할 결과 2건 라벨), `lot-merge/page.tsx`(바코드 스캔 UI + 라벨). i18n 4파일.
- (선택) `MAT_LOT_STATUS` 공통코드에 SPLIT/MERGED 추가 + 색상(safelist 범위 내).

## 검증 계획
- API: 입고 전 LOT 분할/병합 차단, 입고완료 LOT 분할(2 신규, 원본 SPLIT, 수불 OUT/IN, currentQty 설정), 병합(스캔 검증, 신규 1개, 원본 MERGED), 다른 origin 병합 거부, 출고/예약 LOT 차단.
- tsc(백/프론트), 라벨 미리보기.

## 미해결/주의
- 원 LOT status 신규 코드(`SPLIT`/`MERGED`)가 다른 화면 필터에 영향 없는지 점검(재고/IQC006/입고 목록에서 제외 표시).
- `nextMatSerial` 오늘 날짜 사용으로 pptx "최초시리얼 날짜"와 표기 차이 — origin 컬럼으로 계보 추적(승인됨).

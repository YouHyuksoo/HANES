# IQC006 입하실적조회 설계

작성: 2026-06-07 (claude) · 승인: 사용자(슬라이스대로 구현)
근거 목업: `C:\Document\고객별프로젝트\행성사\THN_MockUp\THN_MockUp\Contents\MT\IQC006.xaml`
채번규칙: `HANES_MES_채번규칙.pptx` (입하▶검사▶입고, 라벨 재발행은 자재현황 화면)

## 목적
스테이크홀더 지적 #3: "자재입하 현황 확인 프로그램 없음. 입하별 생성된 시리얼 확인 + 라벨 재인쇄". 목업 IQC006(입하실적조회)을 그대로 구현한다. `receive-label`(IQC합격 시 최초 라벨발행)과 역할이 다르다 — IQC006은 입하 이력 **조회 + 시리얼 확인 + 라벨 재발행 + 입하취소 + 제조사 변경**.

## 화면 구조 (목업 동일, 좌/우 분할)
- 검색바: 입하일 기간 / 상태(전체·입하완료·IQC진행중·IQC완료·입고완료·취소) / 품번 / 입하번호
- 좌측(가변) 입하실적 목록 그리드: 입하번호, PO번호, Line, Release, 입하일, 품번, 입하수량, 시리얼수, 구분(CM/RM 배지), 상태(배지), [입하취소]
- 우측(고정) 시리얼 영역:
  - 선택입하 정보카드(품번/품명/수량/제조사 등) + [제조사 변경]
  - 액션행: [전체선택] + [라벨 재발행]
  - 시리얼 그리드: 체크박스(미입고·미취소만 가능), 시리얼번호, 수량, 입고(Y/N), 취소(Y/N)

## 데이터 모델 (실측)
- `MAT_ARRIVALS` PK(arrivalNo+seq): 입하 1건=품목 1행. poNo/lineNo는 PO연계, vendorId=공급처, iqcStatus, status. **manufacturer 컬럼 없음.**
- `MAT_LOTS` PK(matUid): 시리얼. arrivalNo+arrivalSeq로 입하 연계. **mfgPartnerCode=제조사**(시리얼 단위). status(NORMAL..), iqcStatus.
- 입고(stock-in) 여부: `STOCK_TRANSACTIONS`(RECEIVE) / MatStock — matUid 단위.
- 제조사 콤보: `PARTNER_MASTERS.partnerType='MFG'`.

## 백엔드 (신규 3 + 재사용)
1. `GET /material/arrivals/results` — MatArrival(arrivalNo+seq) 단위 집계. serialCount(MatLot count), 상태도출, 구분(품목 itemType→CM/RM), 검색/필터/페이징. **findAll(거래단위)와 grain 다름 → 신규.**
2. `GET /material/arrivals/:arrivalNo/:seq/serials` — MatLot 목록 + 입고Y/N + 취소Y/N + checkable.
3. `PATCH /material/arrivals/:arrivalNo/manufacturer` (body: seq, mfgPartnerCode) — 해당 입하 시리얼들 mfgPartnerCode 갱신(메타데이터, LOT 정체성 불변).
4. 입하취소: 기존 `POST /material/arrivals/cancel` 재사용.
5. 라벨 재발행: 기존 `MatLabelPreviewModal` + 시리얼 라벨 데이터 재사용.

## 상태 도출 (우선순위)
실데이터가 지저분함(STATUS에 DONE 외 IN_PROGRESS/PENDING, IQC에 PENDING/IQC_PENDING 혼재) → 방어적 우선순위 도출:
1. status='CANCELED' → 취소
2. 전 시리얼 입고완료 → 입고완료
3. iqcStatus IN (PASS,FAIL) → IQC완료
4. IQC 대상 & 검사 대기/진행 → IQC진행중
5. 그 외 → 입하완료

## 빌드 슬라이스 (독립 검증)
1. 목록 + 시리얼 조회 (읽기, 저위험) — API 검증
2. 입하취소 연결 (기존 재사용)
3. 라벨 재발행 (기존 모달 재사용)
4. 제조사 변경 (불확실성 최고, 마지막)

## 라우트/메뉴
- 라우트: `/material/arrival-result` (신규 page)
- 메뉴: `MAT_ARRIVAL_RESULT`, 라벨키 `menu.material.arrivalResult`, 위치=입하관리(MAT_ARRIVAL) 바로 뒤. DB MENU_CATEGORY_ITEMS(MATERIAL) 할당 필요.
- i18n 4파일(ko/en/zh/vi): 메뉴 + 화면 라벨.

## 비고
- #7(자재입고 discoverability)는 메뉴 흐름 개선과 연계: 입하관리 → 입하실적조회 → 자재입고 순서 정렬.

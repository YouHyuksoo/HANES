# 입고라벨발행 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_RECEIVE_LABEL` |
| **URL** | `/material/receive-label` |
| **메뉴 경로** | 자재관리 > 입고라벨발행 |
| **화면 목적** | IQC 합격(PASS) 입하 건 → matUid 채번 → MatLot 생성 → 라벨 인쇄 (+ 자동입고) |
| **주요 사용자** | 자재입고 담당자 |

## 2. API 호출 흐름

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/receive-label/arrivals` | IQC PASS 입하건 조회 |
| 초기 로드 | `GET /master/label-templates?category=mat_lot` | 라벨 템플릿 로드 |
| 라벨발행 | `POST /material/receive-label/create` | matUid 채번 + MatLot 생성 |
| 자동입고 | `POST /material/receiving/auto` | matUids → 입고 확정 |

## 3. 백엔드 — ReceiveLabelService + ReceivingService

### ReceiveLabelService.createMatLabels()
1. 입하 검증 (IQC PASS 확인)
2. `NumberingService.next()`로 N건 matUid 채번
3. `MAT_LOTS` INSERT (status='NORMAL', iqcStatus='PASS')
4. `LABEL_PRINT_LOGS` INSERT

### ReceivingService.autoReceive()
1. LOT IQC PASS 확인
2. `MAT_STOCKS` UPSERT (qty 증가)
3. `STOCK_TRANSACTIONS` INSERT (transType='RECEIVE')
4. `MAT_RECEIVINGS` INSERT

## 4. DB 테이블 영향

| 테이블 | 변경 |
| --- | --- |
| `MAT_LOTS` | INSERT (status='NORMAL', iqcStatus='PASS') |
| `LABEL_PRINT_LOGS` | INSERT |
| `MAT_STOCKS` | UPSERT (qty 증가) |
| `STOCK_TRANSACTIONS` | INSERT (transType='RECEIVE') |
| `MAT_RECEIVINGS` | INSERT |

## 5. 처리 규칙

- `IQC_AUTO_RECEIVE` 시스템설정 ON/OFF 따라 자동입고 선택
- 미발행(`labelPrinted=false`) 입하건만 기본 필터
- 시리얼 1개당 라벨 1장

## 6. 비고

- **tenant scope**: company/plant 포함
- **@UseGuards(InventoryFreezeGuard)**: 자동입고 시 재고프리즈 체크

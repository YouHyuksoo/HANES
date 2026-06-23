---
menuCode: SHIP_PACK
audience: operator
title: 제품포장관리 — 운영 가이드
summary: 박스(Box) 단위 포장 관리 — 박스 생성·시리얼 추가/제거·마감·재오픈·라벨 출력, BOX_MASTERS 전체 컬럼, FG_LABELS 상태 전이, OQC 자동 생성
tags: [출하, 포장, 박스, 운영]
keywords: [BOX_MASTERS, FG_LABELS, BOX_NO, ITEM_CODE, SERIAL_LIST, PALLET_NO, BOX_STATUS, OQC_STATUS, BOX_QTY, BOX_STATUS, OPEN, CLOSED, SHIPPED, VISUAL_PASS, PACKED, OQC_REQUEST, 박스포장, 시리얼, 박스라벨, 박스입수량, 팔레트, 멀티테넌시]
related: [SHIP_PALLET, SHIP_ORDER, SHIP_CONFIRM, SHIP_HISTORY]
---

# 제품포장관리 — 운영 가이드

## 시스템 목적·역할
검사 합격 완제품(FG)을 **박스(Box)** 단위로 포장하여 출하 준비하는 화면입니다. 박스 생성 → 시리얼 추가 → 마감(→ OQC 자동 의뢰)의 3단계 워크플로우로 구성됩니다.

| 단계 | 작업 | 결과 |
|------|------|------|
| 1 | 박스 생성 (품목 선택) | `BOX_MASTERS`에 OPEN 상태 박스 생성, boxNo 자동 채번 |
| 2 | 시리얼 추가 (바코드 스캔) | FG 시리얼을 박스에 담음, serialList JSON 갱신, qty 증가 |
| 3 | 박스 마감 | status→CLOSED, OQC 자동 의뢰 생성, FG_LABELS→PACKED |

포장된 박스는 이후 팔레트 적재(`/shipping/pallet`) → 출하검사(`/quality/oqc`) → 출하확정(`/shipping/confirm`) 순서로 진행됩니다.

## 데이터 구조
```
BOX_MASTERS (PK: COMPANY + PLANT_CD + BOX_NO)
   ├─ ITEM_CODE ─▶ ITEM_MASTERS (품목, boxQty=박스입수량)
   ├─ PALLET_NO ─▶ PALLET_MASTERS (팔레트)
   └─ SERIAL_LIST (CLOB) ─▶ FG_LABELS (시리얼 JSON 배열, ex: ["SN001","SN002"])

FG_LABELS (PK: FG_BARCODE)
   상태 전이: ISSUED → VISUAL_PASS → PACKED → SHIPPED
   박스 마감 시 PACKED + boxNo 설정

OQC_REQUESTS (박스 마감 시 자동 생성)
   remark = "AUTO_CREATED_FROM_BOX:{boxNo}"
```

## 박스 상태 (BOX_STATUS) 코드값

| 코드 | 표시 | 설명 |
|------|------|------|
| `OPEN` | 오픈 | 시리얼 추가/제거 가능 |
| `CLOSED` | 마감 | 시리얼 확정, OQC 대기중, 재오픈 가능(팔레트 미할당 시) |
| `SHIPPED` | 출하 | 출하 완료, 더 이상 변경 불가 |

## 박스번호 규칙
- 포맷: `BX` + `YYMMDD` + `NNNN` (일련 4자리, 일별 리셋)
- 예: `BX2606230001`
- 채번: `NumberingService.nextBoxNo()` → Oracle `SEQ_BOX_NO_DAILY`

## 전체 컬럼 — BOX_MASTERS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 박스번호 | `BOX_NO` | PK. BX+날짜+일련번호 자동 채번. 라벨·바코드 식별자. |
| 품목코드 | `ITEM_CODE` | `ITEM_MASTERS.ITEM_CODE` 참조. 한 박스는 단일 품목만 담을 수 있음. |
| 포장수량 | `QTY` | 담긴 시리얼 개수 (= serialList JSON 배열 길이). boxQty 초과 불가. |
| 시리얼목록 | `SERIAL_LIST` | CLOB. FG 바코드 JSON 배열. 박스당 최대 수천 건 가능하나 OQC·조회 성능 고려 시 적정 수준 유지. |
| 팔레트번호 | `PALLET_NO` | `PALLET_MASTERS.PALLET_NO` 참조. 팔레트 적재 시 부여. 마감 후 팔레트 할당 가능. |
| 상태 | `STATUS` | `OPEN`/`CLOSED`/`SHIPPED`. 기본 OPEN. |
| OQC 상태 | `OQC_STATUS` | `PENDING`/`PASS`/`FAIL`/`null`. 마감 시 PENDING으로 설정. |
| 출하지시번호 | `SHIP_ORDER_NO` | 출하지시 연결 시 부여. 출하확정 단계에서 설정. |
| 출하일시 | `SHIPPED_AT` | 출하확정 시점 타임스탬프. |
| 마감일시 | `CLOSE_TIME` | 박스 마감 시점 타임스탬프 (closeAt). |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정 이력. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | PK 일부. `40` / `1000` 스코프. |

인덱스: `ITEM_CODE`, `PALLET_NO`, `STATUS`, `SHIP_ORDER_NO` — 검색 조건에 따라 인덱스 활용.

## 상세 워크플로우

### ① 박스 생성
`POST /shipping/boxes { itemCode }`
- 품목 선택 모달 → 완제품(`FINISHED`)만 선택 가능(`PartSelect partType="FINISHED"`)
- boxNo 자동 채번, `qty=0`, `serialList=null`
- 품목 마스터의 `BOX_QTY`(박스입수량)가 시리얼 추가 한도로 적용됨

### ② 시리얼 추가
`POST /shipping/boxes/:boxNo/serials { serials: ["FG_BARCODE"] }`
- 조건: 박스 `OPEN` 상태, FG_LABELS `VISUAL_PASS` + `inspectPassYn='Y'`, 품목코드 일치, boxQty 미만
- **교차 박스 중복 금지**: 동일 시리얼이 다른 박스에 이미 담겨 있으면 거부

### ③ 박스 마감 (자동/수동)
`POST /shipping/boxes/:boxNo/close`
- **수동 마감**: 우측 박스 정보 패널의 잠금 아이콘 또는 시리얼 모달의 `포장 완료 · 라벨 출력` 버튼
- **자동 마감**: 시리얼 개수가 `boxQty`에 도달하면 자동 마감 + 라벨 자동 출력
- 마감 시 부수 효과:
  1. `BOX_MASTERS.status` → `CLOSED`, `closeAt` → 현재 시각
  2. `FG_LABELS`의 해당 시리얼들: `status` → `PACKED`, `boxNo` 설정
  3. `OQC_REQUESTS` 자동 생성 (`status=PENDING`, `remark=AUTO_CREATED_FROM_BOX:{boxNo}`)
  4. `OQC_REQUEST_BOXES` 자동 생성 (해당 박스 정보)

### ④ 박스 재오픈
`POST /shipping/boxes/:boxNo/reopen`
- 조건: 팔레트 미할당(`palletNo IS NULL`)
- 복구 동작: 시리얼 → `VISUAL_PASS`, 자동 생성된 OQC 의뢰 삭제

### ⑤ 빈 박스 삭제
- 조건: `OPEN` 상태, 팔레트 미할당, `qty=0`, serialList 없음, OQC 이력 없음

## 화면 구성
- **좌측 메인**(2/3): DataGrid — 박스 목록 (박스번호·품목코드·품목명·포장수량·상태·마감일시)
  - 행 클릭 시 우측에 박스 구성 내역 표시
  - 액션 버튼 4개: 제품담기(Plus) / 마감-재오픈(Lock-LockOpen) / 라벨재발행(Printer) / 빈박스삭제(Trash2)
  - 검색: 박스번호·품목코드, 상태 필터(BOX_STATUS 공통코드)
- **우측 패널**(1/3): 선택 박스의 구성 내역
  - 품목·용량(현재/최대), 시리얼 목록 (BoxItem API), 상태·팔레트 정보

### 시리얼 추가 모달
- 시리얼 바코드 입력 → Enter 시 추가 (FG 바코드 또는 시리얼)
- `boxQty` 도달 시 자동 마감 + 라벨 자동 출력
- 방금 추가된 시리얼은 취소(제거) 가능
- 용량 초과 시 경고 표시

## 사전 설정 (마스터·공통코드)
- 공통코드: `BOX_STATUS`, `OQC_STATUS`
- 품목마스터(`ITEM_MASTERS`): `BOX_QTY`(박스입수량) 설정 필수 (미설정 시 제한 없음)
- FG_LABELS: 외관검사 합격(`VISUAL_PASS`) 시리얼이 있어야 포장 가능
- 연계 메뉴: 팔레트관리(`/shipping/pallet`), OQC(`/quality/oqc`), 출하확정(`/shipping/confirm`)

## 권한
출하관리 담당자(박스 생성/시리얼 추가/마감/재오픈). 일반 사용자는 조회.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 시리얼 추가 실패 (품목 불일치) | 스캔한 FG가 박스의 품목과 다름 | 동일 품목의 FG만 해당 박스에 담을 수 있음 |
| 시리얼 추가 실패 (상태 불일치) | FG가 `VISUAL_PASS` 상태 아님 | 외관검사 합격 처리 후 재시도 |
| 시리얼 추가 실패 (중복) | 이미 다른 박스에 담긴 시리얼 | 해당 박스에서 확인 |
| 박스 마감 실패 | 이미 CLOSED/SHIPPED 상태 | 상태 확인 |
| 박스 재오픈 불가 | 팔레트가 이미 할당됨 | 팔레트 해제 후 재오픈 |
| 빈 박스 삭제 불가 | qty>0 또는 serialList 존재 또는 OQC 이력 있음 | 박스 내용물 비우기 |
| 박스 생성 시 품목 없음 | 완제품(FINISHED) 마스터 미등록 | 품목마스터에서 FINISHED 유형 등록 |
| OQC 자동 생성 안 됨 | 마감 프로세스 오류 | 박스 재오픈 후 재마감 시도 |

## 데이터·연계
- 테이블: `BOX_MASTERS`, `FG_LABELS`, `OQC_REQUESTS`, `OQC_REQUEST_BOXES`, `PALLET_MASTERS`
- 연계: 완제품 검사(`FG_LABELS.status: VISUAL_PASS`), 팔레트 적재(`/shipping/pallet`), 출하검사(OQC, `/quality/oqc`), 출하확정(`/shipping/confirm`), 출하이력(`/shipping/history`)
- 시리얼 채번: `SEQ_BOX_NO_DAILY` (BX + YYMMDD + 4자리)
- 이미지 저장: 해당 없음 (라벨은 bwip-js Code128 바코드로 실시간 렌더링)
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`

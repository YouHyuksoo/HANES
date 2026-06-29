---
menuCode: SHIP_PACK
audience: operator
title: 제품포장관리 — 운영 가이드
summary: 박스 생성, FG 시리얼 추가/제거, 박스 마감/재오픈, 라벨 출력, OQC 자동 의뢰까지의 포장 운영 기준입니다.
tags: [출하, 포장, 박스, 운영]
keywords: [BOX_MASTERS, FG_LABELS, OQC_REQUESTS, OQC_REQUEST_BOXES, BOX_NO, ITEM_CODE, SERIAL_LIST, PALLET_NO, BOX_STATUS, OQC_STATUS, OPEN, CLOSED, SHIPPED, VISUAL_PASS, PACKED, 박스포장, 시리얼, 박스라벨, 빈 박스 삭제]
related: [SHIP_PALLET, QC_OQC, SHIP_CONFIRM, SHIP_HISTORY]
---

# 제품포장관리 — 운영 가이드

## 시스템 목적·역할
`/shipping/pack`은 외관검사 합격 완제품 FG를 박스 단위 출하 재고로 확정하는 처리 화면입니다. 업무 흐름은 박스 생성 → 시리얼 추가/제거 → 박스 마감 → 박스 라벨 출력 → 팔레트 적재 → OQC → 출하확정 순서입니다.

## 데이터 구조
```text
BOX_MASTERS (PK: COMPANY + PLANT_CD + BOX_NO)
  ├─ ITEM_CODE -> ITEM_MASTERS.ITEM_CODE
  ├─ SERIAL_LIST -> FG_LABELS.FG_BARCODE JSON 배열
  ├─ PALLET_NO -> PALLET_MASTERS.PALLET_NO
  └─ STATUS: OPEN -> CLOSED -> SHIPPED

FG_LABELS
  상태 전이: ISSUED -> VISUAL_PASS -> PACKED -> SHIPPED
  박스 마감 시 BOX_NO 설정 및 PACKED 처리

OQC_REQUESTS / OQC_REQUEST_BOXES
  박스 마감 시 AUTO_CREATED_FROM_BOX:{boxNo} 기준으로 자동 생성
```

## ① 박스 목록 — BOX_MASTERS
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 박스번호 | `BOX_NO` | 박스 자연키입니다. 라벨 바코드와 후속 팔레트/OQC/출하 추적 기준입니다. |
| 품목코드 | `ITEM_CODE` | 한 박스에 담을 완제품 품목입니다. 시리얼 추가 시 FG 품목과 반드시 일치해야 합니다. |
| 품목명 | `ITEM_MASTERS.ITEM_NAME` | 화면 표시용 조인 항목입니다. 마스터 누락 시 `-`로 표시됩니다. |
| 포장수량 | `QTY` | 박스에 담긴 FG 시리얼 수입니다. `SERIAL_LIST` 배열 길이와 일치해야 합니다. |
| 박스입수량 | `ITEM_MASTERS.BOX_QTY` | 품목별 최대 구성 수량입니다. 화면은 `QTY / BOX_QTY` 형태로 표시합니다. |
| 상태 | `STATUS` | `OPEN`, `CLOSED`, `SHIPPED`. 공통코드 `BOX_STATUS` 배지로 표시합니다. |
| 마감일시 | `CLOSE_TIME` | 박스 마감 시각입니다. 화면 DTO에서는 `closeAt`으로 사용합니다. |
| 팔레트번호 | `PALLET_NO` | 팔레트 적재 후 부여됩니다. 값이 있으면 재오픈과 빈 박스 삭제가 제한됩니다. |
| OQC 상태 | `OQC_STATUS` | 마감 후 OQC 대기/결과 상태입니다. OQC 이력이 있으면 빈 박스 삭제가 제한됩니다. |
| 감사/스코프 | `COMPANY`, `PLANT_CD`, `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 기본 스코프는 `COMPANY='40'`, `PLANT_CD='1000'`입니다. |

## ② 시리얼 상세 — FG_LABELS
| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 시리얼번호 | `FG_BARCODE` | 제품 담기 모달과 우측 박스 구성 목록의 식별값입니다. |
| 품목코드 | `ITEM_CODE` | 박스 품목과 일치해야 추가됩니다. |
| 상태 | `STATUS` | 추가 전 `VISUAL_PASS`, 마감 후 `PACKED`, 출하 후 `SHIPPED`로 이어집니다. |
| 검사합격 | `INSPECT_PASS_YN` | `Y`인 FG만 포장 대상입니다. |
| 박스번호 | `BOX_NO` | 시리얼이 담긴 박스입니다. 중복 포장을 막는 기준입니다. |

## 버튼·API·상태 전이
| 버튼/액션 | API 또는 서비스 | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| 새로고침 | `GET /shipping/boxes`, `GET /shipping/boxes/packable-serials` | 항상 | 박스 목록과 포장 대기 시리얼을 재조회합니다. 상태 미지정 시 `includeOpen=true`가 붙어 기간 밖 `OPEN` 박스도 포함합니다. |
| 포장 대기 | `GET /shipping/boxes/packable-serials` | 항상 | `VISUAL_PASS`이고 박스 미배정인 FG를 품목별로 확인합니다. 데이터 변경은 없습니다. |
| 박스 생성 | `POST /shipping/boxes { itemCode }` | 완제품 품목 선택 | `BOX_MASTERS`에 `OPEN`, `QTY=0`, `SERIAL_LIST=null` 박스를 생성합니다. `BOX_NO`는 서버에서 채번합니다. |
| 제품 담기 / 시리얼 추가 | `POST /shipping/boxes/:boxNo/serials` | 박스 `OPEN`, FG 검사합격, 품목 일치, 중복 없음, 입수량 미초과 | `SERIAL_LIST`와 `QTY`가 갱신됩니다. 입수량 도달 시 화면이 자동 마감과 라벨 출력을 이어서 실행합니다. |
| 시리얼 제거 | `DELETE /shipping/boxes/:boxNo/serials` | 박스 `OPEN`, 해당 시리얼이 현재 박스에 있음 | `SERIAL_LIST`와 `QTY`에서 해당 FG가 제거되고 FG는 포장 전 상태로 돌아갑니다. |
| 포장 완료 · 라벨 출력 | `POST /shipping/boxes/:boxNo/close` 후 라벨 모달 | 박스 `OPEN`, 담긴 시리얼 1건 이상 | 박스가 `CLOSED`가 되고 `FG_LABELS`는 `PACKED`로 확정됩니다. OQC 의뢰가 자동 생성되고 라벨 모달이 열립니다. |
| 박스 마감 | `POST /shipping/boxes/:boxNo/close` | 박스 `OPEN` | `BOX_MASTERS.STATUS=CLOSED`, `CLOSE_TIME` 설정, OQC 자동 생성. |
| 박스 재오픈 | `POST /shipping/boxes/:boxNo/reopen` | 박스 `CLOSED`, `PALLET_NO` 없음 | 박스가 `OPEN`으로 되돌아가고 자동 생성 OQC 의뢰가 정리됩니다. 구성 FG는 다시 포장 수정 가능 상태가 됩니다. |
| 라벨 재발행 | `GET /master/label-templates?category=box`, 브라우저 인쇄 | 선택 박스 `QTY > 0` | 박스 라벨 모달을 열고 기본 라벨 또는 라벨관리 `box` 템플릿으로 인쇄합니다. |
| 빈 박스 삭제 | `DELETE /shipping/boxes/:boxNo` | `OPEN`, `QTY=0`, `SERIAL_LIST` 없음, `PALLET_NO` 없음, `OQC_STATUS` 없음 | 잘못 생성한 빈 박스를 삭제합니다. 작업 이력이 생긴 박스는 삭제하지 않습니다. |

## 상태 코드
| 코드 | 표시 | 설명 |
|------|------|------|
| `OPEN` | 오픈 | 제품 담기, 시리얼 제거, 마감, 빈 박스 삭제가 가능한 작업 중 상태입니다. |
| `CLOSED` | 마감 | 박스 구성이 확정되고 OQC 대기 상태입니다. 팔레트 미할당이면 재오픈할 수 있습니다. |
| `SHIPPED` | 출하 | 출하확정 완료 상태입니다. 포장 화면에서 수정하지 않습니다. |

## 운영 절차
1. 포장 대기 모달에서 검사 합격 후 미포장 FG가 있는지 확인합니다.
2. 포장할 완제품 품목으로 박스를 생성합니다.
3. 생성된 `OPEN` 박스를 선택하고 제품 담기 모달에서 FG 바코드를 스캔합니다.
4. `QTY / BOX_QTY`를 확인하며 시리얼을 추가하거나 제거합니다.
5. 입수량 도달 자동 마감 또는 `포장 완료 · 라벨 출력`으로 박스를 마감합니다.
6. 라벨을 출력해 실물 박스에 부착합니다.
7. 이후 `/shipping/pallet`에서 팔레트 적재, `/quality/oqc`에서 출하검사, `/shipping/confirm`에서 출하확정을 진행합니다.

## 사전 설정 (마스터·공통코드)
- 품목마스터: 완제품 품목과 `BOX_QTY`가 관리되어야 합니다. `BOX_QTY`가 없으면 화면은 수량 제한 없이 담을 수 있게 동작합니다.
- 공통코드: `BOX_STATUS`, `OQC_STATUS`.
- 라벨관리: `category=box` 템플릿이 있으면 박스 라벨 모달에서 선택할 수 있습니다. 없으면 기본 라벨을 사용합니다.
- 검사 흐름: 포장 대상 FG는 외관검사 합격 후 `VISUAL_PASS` 상태여야 합니다.

## 권한
출하/포장 담당자는 박스 생성, 제품 담기, 마감, 재오픈, 라벨 출력, 빈 박스 삭제를 수행합니다. 조회 전용 권한 사용자는 목록과 상세만 확인하도록 제한해야 합니다.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 포장 대기 목록에 시리얼이 없음 | 검사 미합격, 이미 박스 배정, 품목/스코프 불일치 | FG 상태와 `BOX_NO` 배정 여부를 확인합니다. |
| 시리얼 추가 실패 | 박스가 `OPEN`이 아니거나, FG 품목 불일치, 중복 포장, 입수량 초과 | 화면 오류 메시지와 박스 품목/수량을 확인합니다. |
| 박스 마감 실패 | 시리얼 없음, 이미 마감/출하, 서버 검증 실패 | 박스 상태와 구성 시리얼을 확인한 뒤 재시도합니다. |
| 재오픈 버튼 비활성 | 박스가 `CLOSED`가 아니거나 팔레트가 배정됨 | 팔레트 적재 여부를 확인합니다. 적재 후에는 포장 화면에서 직접 수정하지 않습니다. |
| 빈 박스 삭제 불가 | 수량, 시리얼, 팔레트, OQC 이력 중 하나가 존재 | 실제로 빈 `OPEN` 박스인지 확인합니다. 이력이 있으면 삭제 대신 업무 취소 흐름을 사용합니다. |
| 라벨 양식이 기대와 다름 | `box` 라벨 템플릿 미등록 또는 기본 템플릿 사용 | `/master/label`에서 `box` 카테고리 템플릿과 기본 여부를 확인합니다. |

## 데이터·연계
- 주요 테이블: `BOX_MASTERS`, `FG_LABELS`, `OQC_REQUESTS`, `OQC_REQUEST_BOXES`, `PALLET_MASTERS`, `ITEM_MASTERS`.
- 주요 화면: `/shipping/pack`, `/shipping/pallet`, `/quality/oqc`, `/shipping/confirm`, `/shipping/history`.
- 주요 API: `GET/POST/DELETE /shipping/boxes`, `POST /shipping/boxes/:boxNo/serials`, `DELETE /shipping/boxes/:boxNo/serials`, `POST /shipping/boxes/:boxNo/close`, `POST /shipping/boxes/:boxNo/reopen`, `GET /master/label-templates`.
- 멀티테넌시: `COMPANY='40'`, `PLANT_CD='1000'` 스코프를 기준으로 조회/처리합니다.

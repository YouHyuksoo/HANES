---
sources: []
verifiedCommit: 8a7e96ea
---

# 자재LOT관리 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_LOT` |
| **URL** | `/material/lot` |
| **메뉴 경로** | 자재관리 > 자재LOT관리 |
| **화면 목적** | 자재 LOT별 이력/상태 조회 |
| **주요 사용자** | 자재관리 담당자 |

## 2. 화면

DataGrid + 통계카드(NORMAL/HOLD/DEPLETED 수) + 상세 모달

## 3. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/lots?limit=5000&matUid=&status=&iqcStatus=` | LOT 목록 조회 |

## 4. 백엔드 — MatLotService

- 엔티티: `MatLot` → `MAT_LOTS`
- `ItemMaster` 매핑 (itemName, unit)

## 5. DB 테이블

| 테이블 | 역할 |
|--------|------|
| `MAT_LOTS` | 자재시리얼 마스터 |
| `ITEM_MASTERS` | 품목 정보 |

## 6. LOT 상태

| 상태 | 설명 |
|------|------|
| NORMAL | 정상 |
| HOLD | 홀드 |
| DEPLETED | 전량 소진 |
| SCRAPPED | 폐기 |
| SPLIT | 분할됨 |
| MERGED | 병합됨 |

## 7. 비고

- **읽기 전용** (조회 + 상세 모달)
- **tenant scope**: company/plant 포함

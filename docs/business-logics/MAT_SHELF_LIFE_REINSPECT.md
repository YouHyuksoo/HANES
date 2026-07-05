---
sources: []
verifiedCommit: 8a7e96ea
---

# 유수명자재재검사 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_SHELF_LIFE_REINSPECT` |
| **URL** | `/material/shelf-life-reinspect` |
| **메뉴 경로** | 자재관리 > 유수명자재재검사 |
| **화면 목적** | 만료/임박 LOT 재검사 결과 등록 — 합격 시 연장, 불합격 시 폐기 |
| **주요 사용자** | 품질 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/shelf-life?limit=5000` | 만료/임박 LOT 목록 |
| 검사 등록 | `POST /material/shelf-life/reinspect` | 재검사 결과 등록 |

## 3. 백엔드 — ShelfLifeReInspectService.create()

PASS → MAT_LOTS.expireDate 연장 + IQC_LOGS INSERT (RETEST)
FAIL → MAT_LOTS.status='SCRAPPED' + IQC_LOGS INSERT

## 4. DB 테이블

| 테이블 | 변경 |
| --- | --- |
| `MAT_LOTS` | UPDATE expireDate / status |
| `IQC_LOGS` | INSERT (inspectType='RETEST') |

## 5. 비고

- **tenant scope**: company/plant 포함

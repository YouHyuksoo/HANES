# 유수명자재검사이력 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_SHELF_LIFE_HISTORY` |
| **URL** | `/material/shelf-life-history` |
| **메뉴 경로** | 자재관리 > 유수명자재검사이력 |
| **화면 목적** | 유수명자재 재검사(IQC RETEST) 결과 이력 조회 (읽기 전용) |
| **주요 사용자** | 품질 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/shelf-life/reinspect?limit=2000&result=` | 재검사 이력 조회 |

## 3. 백엔드 — ShelfLifeReInspectService.findAll()

- IQC_LOGS 테이블에서 inspectType='RETEST' 조건 조회
- 엔티티: `IqcLog` → `IQC_LOGS`

## 4. DB 테이블

| 테이블 | 역할 |
|--------|------|
| `IQC_LOGS` | IQC 검사 이력 (inspectType='RETEST') |
| `MAT_LOTS` | LOT 정보 조인 |

## 5. 비고

- **읽기 전용**, 상세 모달 지원
- **PASS/FAIL 결과 필터**
- **tenant scope**: company/plant 포함

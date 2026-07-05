---
sources: []
verifiedCommit: 8a7e96ea
---

# 출고이력조회 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_ISSUE_HIST` |
| **URL** | `/material/issue-history` |
| **메뉴 경로** | 자재관리 > 출고이력조회 |
| **화면 목적** | MAT_ISSUES 기반 출고 이력 조회 (읽기 전용) |
| **주요 사용자** | 자재관리 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/issues?page=&limit=&fromDate=&toDate=` | 출고 이력 조회 |

## 3. 백엔드 — MatIssueService.findAll()

- `MatIssue` → `MAT_ISSUES`

## 4. 비고

- **읽기 전용**
- **tenant scope**: company/plant 포함

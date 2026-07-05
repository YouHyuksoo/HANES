---
sources: []
verifiedCommit: 8a7e96ea
---

# 기타출고 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_ISSUE_OTHER` |
| **URL** | `/material/issue-other` |
| **메뉴 경로** | 자재관리 > 기타출고 |
| **화면 목적** | 양산 외 출고계정(불량/샘플/외주/폐기/반품) 처리, 3탭 구조 |
| **주요 사용자** | 자재출고 담당자 |

## 2. 화면 구성

3탭: 출고요청처리(MANUAL) / 바코드스캔(계정선택) / 이력조회

## 3. API

MAT_ISSUE와 동일한 Controller/Service (MatIssueController)

- `EXCLUDED_ISSUE_TYPES = ['PRODUCTION']` — 양산 계정 제외

## 4. 비고

- **탭 구조**: request(MANUAL) / scan(바코드) / history(이력)
- **@UseGuards(InventoryFreezeGuard)**: 재고프리즈 차단
- **tenant scope**: company/plant 포함

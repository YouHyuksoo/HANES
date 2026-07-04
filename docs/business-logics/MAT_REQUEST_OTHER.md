# 기타출고요청 — 비즈니스 로직 & 데이터 흐름 분석

> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

---

## 1. 화면 개요

| 항목 | 내용 |
|------|------|
| **메뉴 코드** | `MAT_REQUEST_OTHER` |
| **URL** | `/material/request-other` |
| **메뉴 경로** | 자재관리 > 기타출고요청 |
| **화면 목적** | 작업지시 없는 MANUAL 유형 출고요청 등록/조회 |
| **주요 사용자** | 자재관리 담당자 |

## 2. API

| 시점 | API | 용도 |
| --- | --- | --- |
| 초기 로드 | `GET /material/issue-requests?page=1&limit=50&issueType=MANUAL` | MANUAL 출고요청 목록 조회 |
| 요청 생성 | `POST /material/issue-requests` | 출고요청 생성 |
| 승인 | `PATCH .../approve` | 승인 |
| 반려 | `PATCH .../reject` | 반려 |
| 실출고 | `POST .../{requestNo}/issue` | 실출고 |

## 3. 백엔드 — IssueRequestService

MAT_REQUEST와 동일한 서비스. `issueType='MANUAL'` 필터.

## 4. 비고

- **MANUAL 필터**: 작업지시 없는 기타 출고요청만 표시
- **tenant scope**: company/plant 포함

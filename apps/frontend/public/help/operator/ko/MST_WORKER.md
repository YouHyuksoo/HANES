---
menuCode: MST_WORKER
audience: operator
title: 작업자관리 — 운영 가이드
summary: 작업자관리 전체 컬럼의 DB 매핑(WORKER_MASTERS), CRUD API, QR/사번 식별 로직, 사진 업로드, 권한, 트러블슈팅, 멀티테넌시 스코프
tags: [기준정보, 작업자, 마스터, 운영]
keywords: [WORKER_MASTERS, WORKER_CODE, QR_CODE, PROCESS_IDS, JOB_POSITION, USE_YN, 작업자, 사번, 키오스크, PDA, by-qr, upload-photo, 멀티테넌시, COMPANY, PLANT_CD]
related: []
---

# 작업자관리 — 운영 가이드

## 시스템 목적·역할
현장 작업자의 기준정보를 보유하는 **마스터 테이블 `WORKER_MASTERS`** 관리 화면입니다. 생산실적 등록, 키오스크/PDA의 작업자 식별(사번·QR 스캔)이 이 마스터를 `WORKER_CODE`로 참조합니다. PK는 자연키 `WORKER_CODE`이며 멀티테넌시(`COMPANY`, `PLANT_CD`)와 함께 복합 PK를 구성합니다.

## 데이터 구조
```
WORKER_MASTERS (PK: COMPANY, PLANT_CD, WORKER_CODE)
   ├─ QR_CODE       ──▶ 키오스크/PDA QR 스캔 식별 (GET /master/workers/by-qr/:qrCode)
   ├─ PROCESS_IDS   ──▶ CLOB(JSON 배열). 담당 공정 ID 목록
   └─ 참조: 생산실적 / 키오스크 / PDA (WORKER_CODE 기준)
```

## ① 전체 컬럼 — WORKER_MASTERS

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| **작업자코드/사번(workerCode)** | `WORKER_CODE` | PK 구성(자연키). 작업자 식별 고유 코드. 불변 권장 — 수정 폼에서 잠김(disabled). 생성 시 테넌트 내 중복이면 409 ConflictException. |
| **작업자명(workerName)** | `WORKER_NAME` | 필수. 표시명. DTO MaxLength 100. |
| **영문명(engName)** | `ENG_NAME` | 선택. nullable. |
| **부서(dept)** | `DEPT` | 부서명. 별도 인덱스(`@Index(['dept'])`). 목록에서 `dept LIKE %값%` 필터 가능(현재 화면 검색은 코드/이름 기준). |
| **직급(position)** | `POSITION` | 공통코드 JOB_POSITION 셀렉트 값. |
| **전화번호(phone)** | `PHONE` | 연락처. nullable. |
| **이메일(email)** | `EMAIL` | 이메일. nullable. |
| **입사일(hireDate)** | `HIRE_DATE` | `YYYY-MM-DD` 문자열(varchar2). DTO MaxLength 10. |
| **퇴사일(quitDate)** | `QUIT_DATE` | `YYYY-MM-DD` 문자열. 재직 중이면 비움(null). |
| **QR코드(qrCode)** | `QR_CODE` | 키오스크/PDA 스캔 식별 코드. 비면 by-qr 조회가 `WORKER_CODE`로 폴백. |
| **사진(photoUrl)** | `PHOTO_URL` | 업로드 파일 경로(`/uploads/workers/...`). 목록 아바타 소스. |
| **담당공정(processIds)** | `PROCESS_IDS` | CLOB에 JSON 배열로 저장. 서비스에서 `JSON.stringify`/`JSON.parse`로 변환. (현재 폼에는 입력 UI 없음 — API/시드로 관리) |
| **비고(remark)** | `REMARK` | 메모. varchar2(500). |
| **사용여부(useYn)** | `USE_YN` | `Y`만 활성(default 'Y'). `N`은 미사용. 목록 사용여부 필터(USE_YN 공통코드)와 연동. |
| **감사** | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 생성/수정자·일시. `CREATED_AT`/`UPDATED_AT`은 DEFAULT SYSTIMESTAMP. |
| **멀티테넌시** | `COMPANY`, `PLANT_CD` | PK 구성. `40` / `1000` 스코프. 모든 조회·수정·삭제에 테넌트 조건 적용. |

## 식별 로직 (QR / 사번 폴백)
`GET /master/workers/by-qr/:qrCode` (PDA/키오스크 연동):
1. 1차: `QR_CODE = :qrCode`로 조회.
2. 2차: 없으면 `WORKER_CODE = :qrCode`로 재시도(QR에 사번이 인쇄된 경우 대비).
3. 둘 다 없으면 404 NotFoundException(`해당 QR 코드의 작업자를 찾을 수 없습니다`).
4. 반환은 `{ workerCode, workerName, dept }`만(최소 식별 정보).

## 사전 설정 (마스터·공통코드)
- 공통코드: `JOB_POSITION`(직급), `USE_YN`(사용여부).
- 부서(`DEPT`)는 부서 선택 컴포넌트(DepartmentSelect)가 제공하는 목록을 사용.

## 운영 절차
- **CRUD API** (`@Controller('master/workers')`):
  - `GET /master/workers` — 목록(query: `search`, `dept`, `useYn`, `page`, `limit`). 화면은 `search`/`useYn`/`limit=200` 전달, `CREATED_AT DESC` 정렬.
  - `GET /master/workers/:id` — 상세(id = WORKER_CODE).
  - `GET /master/workers/by-qr/:qrCode` — QR/사번 식별.
  - `POST /master/workers` — 생성(중복 시 409).
  - `PUT /master/workers/:id` — 수정(코드 변경 불가, 부분 업데이트).
  - `DELETE /master/workers/:id` — 삭제.
  - `POST /master/workers/upload-photo` — 사진 업로드(multipart, 이미지만, 5MB 제한, 저장 경로 `./uploads/workers`).
- 검색은 `WORKER_CODE LIKE %대문자% OR WORKER_NAME LIKE %원문%`.

## 권한
기준정보 관리자(등록/수정/삭제/사진 업로드). 일반 사용자는 조회. 키오스크/PDA는 by-qr 조회만 사용.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 저장 시 "이미 존재하는 작업자 코드" | 동일 `WORKER_CODE` 존재(테넌트 내) | 코드 확인(불변 키), 다른 코드로 등록 |
| 작업자코드 수정 불가 | 코드는 PK·불변(폼 disabled) | 삭제 후 재등록 또는 미사용 처리 |
| 키오스크/선택 목록에 안 보임 | `USE_YN='N'` | 사용여부 Y로 활성화 |
| QR 스캔이 작업자 못 찾음(404) | `QR_CODE` 미등록이고 사번도 불일치 | QR_CODE 등록 또는 QR에 사번 인쇄(by-qr 폴백) |
| 목록 사진 깨짐 | `PHOTO_URL` 경로 파일 없음 | 사진 재업로드(프론트는 기본 아바타 fallback) |
| 사진 업로드 실패 | 비이미지 또는 5MB 초과 | 이미지 파일·용량 확인 |
| 담당공정이 화면에 안 보임 | 폼에 입력 UI 없음 | `PROCESS_IDS`(CLOB JSON)는 API/시드로 관리 |

## 데이터·연계
- 테이블: `WORKER_MASTERS`
- 연계: 생산실적, 키오스크/PDA(작업자 식별·QR 스캔), 사진 업로드(`/uploads/workers`)
- 백엔드: `WorkerController`(`master/workers`), `WorkerService`, `WorkerMaster` 엔티티
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`

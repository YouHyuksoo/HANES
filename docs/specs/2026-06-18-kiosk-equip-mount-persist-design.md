# 입력 키오스크 설비 장착 상태(작업지시·작업자) 서버 영속화 설계

- 작성일: 2026-06-18
- 대상 화면: `/production/input-kiosk` (생산실적 키오스크)
- 작성자: claude

## 1. 배경 / 문제

입력 키오스크에서 선택한 **설비·작업지시·작업자** 상태가 현재 Zustand `persist`로
브라우저 **localStorage**(`harness-kiosk` 키)에만 저장된다 (`kioskStore.ts:218-231`).

이로 인한 문제:

- 상태가 **브라우저/단말에 종속**된다. 같은 설비를 다른 태블릿에서 열면 선택이 비어 있고,
  localStorage를 지우면 사라진다.
- 작업지시는 이미 `PATCH /equipment/equips/{code}/job-order`로 DB(`EQUIP_MASTERS.CURRENT_JOB_ORDER_ID`)에
  저장되지만, **설비 선택 시 이 서버 값을 다시 읽어 복원하는 흐름이 없어** localStorage에만 의존한다.
- 작업자는 DB에 전혀 저장되지 않는다 (localStorage + 실적 저장 시 PROD_RESULTS 기록뿐).

## 2. 목표

설비를 키(identity)로, 장착된 **작업지시 1건 + 작업자 1명**을 서버 DB에 저장하고,
명시적/자동 해제 전까지 유지한다. 어느 단말에서 그 설비를 선택해도 서버 기준으로 동일하게 복원된다.

확정된 도메인 결정:

1. **복원 범위**: 서버 기준 복원 — 어느 단말이든 설비 선택 시 서버에 장착된 작업지시·작업자를 표시.
2. **작업자**: 설비 기준 DB 저장/복원. **작업자는 설비당 1명(1:1)**.
3. **해제 시점**: 작업지시 완료(DONE) 시 자동 해제 + 수동 해제 버튼.

## 3. 비목표 (범위 밖 — 현행 유지)

- interlock(설비일일점검·작업자설비점검·자재스캔·소모품스캔) 상태와 자재/소모품 스캔 데이터,
  진행수량(PROD_RESULTS) 동기화는 **변경하지 않는다**. 이미 서버 재확인 로직이 있고 이번 범위가 아니다.
- 교대조/작업 시작시각 등 확장 메타데이터는 다루지 않는다(YAGNI).

## 4. 데이터 모델

`EQUIP_MASTERS` 테이블에 컬럼 **1개만 추가**한다. 신규 테이블 없음.

| 컬럼 | 타입 | 비고 |
|------|------|------|
| `CURRENT_JOB_ORDER_ID` | varchar2(50), nullable | **기존** — 작업지시 source of truth 유지 |
| `CURRENT_WORKER_ID` | varchar2(50), nullable | **신규** — 현재 작업자 1명, 작업지시와 대칭 |

- 작업자도 작업지시와 완전히 대칭 구조 — 단일 nullable 컬럼.
- 신규 컬럼은 nullable이므로 audit(`CREATED_AT`/`UPDATED_AT`) 영향 없음.
- DDL은 JSHANES 사이트에 적용(배포 서버와 DB 공유). 엔티티(`equip-master.entity.ts`) 동기화.

## 5. 백엔드 API

기준 모듈: `apps/backend/src/modules/equipment/`

### 5.1 mount 조회 (신규)
- `GET /equipment/equips/:code/mount`
- 응답: `{ orderNo, jobOrder, workerId, worker }`
  - `jobOrder`: 작업지시 상세(복원에 필요한 필드 — 기존 job-order 조회 재사용/ join)
  - `worker`: 작업자 상세(id, name 등)
  - 장착 없음이면 각 필드 null
- 목적: 설비 선택 시 작업지시·작업자 상태를 라운드트립 1회로 복원.

### 5.2 작업지시 할당 (기존 재사용)
- `PATCH /equipment/equips/:code/job-order` `{ orderNo | null }` — 변경 없음.

### 5.3 작업자 할당 (신규)
- `PATCH /equipment/equips/:code/worker` `{ workerId | null }`
- job-order 할당과 대칭. `CURRENT_WORKER_ID` 업데이트. null이면 해제.
- DTO/서비스/컨트롤러를 job-order 패턴과 동일하게 구성.

### 5.4 수동 해제 (신규)
- `DELETE /equipment/equips/:code/mount`
- `CURRENT_JOB_ORDER_ID` + `CURRENT_WORKER_ID`를 **둘 다 null**로 (작업 종료).

### 5.5 자동 해제 (신규 훅)
- 작업지시가 **DONE으로 전이되는 백엔드 지점**에서, 그 orderNo를 장착 중인 설비의 mount를 clear.
- 구현 단계에서 작업지시 상태 전이 서비스(job-order 상태 변경 경로)를 확인해 정확히 연결한다.

## 6. 프론트엔드

### 6.1 `kioskStore.ts`
- `partialize`에서 `selectedJobOrder`, `selectedWorkers` **제거** → 서버가 source of truth.
  - `selectedEquip`, `lotSize`, `interlock`은 "이 단말이 보는 설비/단말 설정"이므로 localStorage 유지.
- 작업자 1:1 반영: 작업자 선택을 누적(`addWorker`)에서 **교체(`setWorker`)**로 변경.
  - `selectedWorkers` 배열 구조는 유지하되 항상 0~1개만 담아 기존 `selectedWorkers.length` 검증 코드 영향 최소화.

### 6.2 `page.tsx`
- **설비 선택 시 복원**: `selectedEquip` 변경 → `GET .../mount` 호출 → 작업지시·작업자를 서버 값으로 세팅.
  - 새로고침/재진입/다른 단말이어도 동일 복원. localStorage의 jobOrder/worker 의존 제거.
- **작업자 선택**: `handleWorkerConfirm` → `setWorker` + `PATCH .../worker` 서버 저장(교체).
- **해제**: `EquipHeader`의 "작업 종료/해제" 버튼 → `DELETE .../mount` → 화면 상태 초기화(`clearAll` 또는 작업지시·작업자만 clear).

### 6.3 `EquipHeader.tsx`
- "작업 종료/해제" 버튼 추가(모달 확인 후 실행 — `confirm()` 금지, 모달 컴포넌트 사용).
- 작업자 표시를 1:1(단일 작업자) 기준으로 정리.

## 7. 동작 흐름

```
설비 선택 ──→ GET mount ──→ 작업지시·작업자 자동 복원 (서버 기준)
작업지시 선택 ─→ PATCH job-order (DB 저장, 기존)
작업자 선택 ──→ PATCH worker (DB 저장, 신규, 교체)
작업지시 DONE ─→ 자동 mount clear (작업지시+작업자)
해제 버튼 ───→ DELETE mount (작업지시+작업자 동시 해제) → 화면 초기화
```

## 8. 검증

- 백엔드/프론트 `tsc --noEmit` 0건.
- 로컬 3002 브라우저 시나리오:
  1. 설비 A에 작업지시·작업자 지정 → 새로고침 → 동일 복원.
  2. 다른 브라우저(localStorage 비어 있음)에서 설비 A 선택 → 작업지시·작업자 그대로 표시.
  3. 작업자 변경 → 서버 `CURRENT_WORKER_ID` 갱신 확인.
  4. 해제 버튼 → `CURRENT_JOB_ORDER_ID`/`CURRENT_WORKER_ID` 둘 다 null 확인.
  5. 작업지시 DONE → 자동 해제 확인.
- i18n: 신규 UI 문구(해제 버튼/모달) ko·en·zh·vi 4파일 동시 반영.
- 테스트 데이터(설비 mount)는 검증 후 원복.

## 9. 리스크 / 주의

- input-kiosk 영역은 codex가 활발히 작업 중. 편집 전 `LOCKS.md` 확인 및 본인 lock 기록.
- `DELETE/PATCH` 멀티테넌시 스코프(COMPANY/PLANT_CD)는 기존 equip-master 서비스 패턴을 따른다.
- DDL→의존 PL/SQL INVALID 가능성: EQUIP_MASTERS 의존 패키지 있으면 DDL 후 `ALTER ... COMPILE` 점검.

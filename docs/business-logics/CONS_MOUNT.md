---
sources: []
verifiedCommit: 8a7e96ea
---

# 소모품 장착/분리 관리 — 비즈니스 로직 & 데이터 흐름 분석
> **분석 기준 커밋:** `8a7e96ea`
> **분석 일자:** `2026-07-04`

## 1. 화면 개요

소모품(금형/지그/공구)을 설비에 장착(mount), 해제(unmount), 수리(repair), 수리완료(complete-repair) 처리하고 이력을 조회하는 메뉴.

| 항목 | 내용 |
|------|------|
| 메뉴 코드 | CONS_MOUNT |
| 경로 | `/consumables/mount` |
| 페이지 | `page.tsx` → `ConsumableMountPage` |
| 주요 역할 | 설비 장착/해제/수리 관리 |
| 권한 | JwtAuthGuard |
| API 베이스 | `POST /equipment/consumables/:code/{action}` |

## 2. 화면 구성

```mermaid
flowchart LR
  A["ConsumableMountPage"] --> B["DataGrid (ConsumableItem 목록)"]
  B -->|action 버튼| C["Action Modal<br/>(장착/해제/수리/복귀)"]
  B -->|History 버튼| D["History Modal<br/>(MountLog 테이블)"]
```

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `ConsumableMountPage` | `page.tsx` | 메인 페이지 |
| `createConsumableMountGridColumns` | `consumableMountColumns.tsx` | DataGrid 컬럼 + Action/History 버튼 |
| `EquipSelect` | `@/components/shared` | 설비 선택 (장착 시) |
| `ComCodeSelect` | `@/components/shared` | 카테고리/운영상태 필터 |
| `StatusBadge` | `@/components/shared/StatusBadge` | operStatus 배지 |

## 3. 상태 관리

| 상태 | 설명 |
|------|------|
| `data` | 소모품 목록 (GET /equipment/consumables) |
| `searchTerm, categoryFilter, operStatusFilter` | 그리드 필터 |
| `actionType` | 'mount'/'unmount'/'repair'/'completeRepair' |
| `selectedItem` | action 대상 소모품 |
| `equipCode, remark` | action 입력값 |
| `saving` | API 호출 중 |
| `historyItem, historyData, historyLoading` | 이력 모달 상태 |

## 4. API 호출 흐름

```mermaid
sequenceDiagram
  participant User
  participant FE as 프론트
  participant BE as ConsumableController<br/>(equipment/consumables)
  participant SVC as ConsumableService<br/>(equipment)
  participant DB as Oracle DB

  Note over FE: 목록 조회
  FE->>BE: GET /equipment/consumables?limit=5000&search=&category=&operStatus=
  BE->>SVC: findAll(query, company, plant)
  SVC->>DB: SELECT FROM CONSUMABLE_MASTERS (equipment module)
  DB-->>FE: [{ consumableCode, name, operStatus, mountedEquipCode, ... }]

  Note over FE: 장착
  User->>FE: 장착 버튼 → 설비 선택 → 확인
  FE->>BE: POST /equipment/consumables/{code}/mount { equipCode, remark }
  BE->>SVC: mountToEquip(id, dto, company, plant)
  SVC->>DB: UPDATE CONSUMABLE_MASTERS SET operStatus='MOUNTED', mountedEquipCode=...
  SVC->>DB: INSERT CONSUMABLE_MOUNT_LOGS (action='MOUNT')
  DB-->>FE: { success }

  Note over FE: 해제
  FE->>BE: POST /equipment/consumables/{code}/unmount { remark }
  BE->>SVC: unmountFromEquip(id, dto, company, plant)
  SVC->>DB: UPDATE CONSUMABLE_MASTERS SET operStatus='WAREHOUSE', mountedEquipCode=null
  SVC->>DB: INSERT CONSUMABLE_MOUNT_LOGS (action='UNMOUNT')

  Note over FE: 수리 전환
  FE->>BE: POST /equipment/consumables/{code}/repair { remark }
  BE->>SVC: setRepairStatus(id, dto, company, plant)
  SVC->>DB: UPDATE operStatus='REPAIR' (장착중이면 자동 unmount 후 수리)

  Note over FE: 수리 완료
  FE->>BE: POST /equipment/consumables/{code}/complete-repair { remark }
  BE->>SVC: completeRepair(id, dto, company, plant)
  SVC->>DB: UPDATE operStatus='WAREHOUSE'

  Note over FE: 이력 조회
  FE->>BE: GET /equipment/consumables/{code}/mount-logs
  BE->>SVC: getMountHistory(id, company, plant)
  SVC->>DB: SELECT FROM CONSUMABLE_MOUNT_LOGS WHERE consumableCode=...
  DB-->>FE: [{ mountDate, seq, equipCode, action, workerId, remark, createdAt }]
```

## 5. 백엔드 처리

```mermaid
flowchart TB
  subgraph Controller["ConsumableController (/equipment/consumables)"]
    LIST["GET /<br/>findAll()"]
    MOUNT["POST /:id/mount<br/>mountToEquip()"]
    UNMOUNT["POST /:id/unmount<br/>unmountFromEquip()"]
    REPAIR["POST /:id/repair<br/>setRepairStatus()"]
    COMPLETE["POST /:id/complete-repair<br/>completeRepair()"]
    HISTORY["GET /:id/mount-logs<br/>getMountHistory()"]
    INCREASE["POST /:id/increase<br/>increaseCount()"]
    REPLACE["POST /:id/replace<br/>registerReplacement()"]
  end

  subgraph Service["equipment ConsumableService"]
    MOUNT_LOGIC["mountToEquip():<br/>1. operStatus='MOUNTED'<br/>2. mountedEquipCode=설정<br/>3. MountLog INSERT"]
    UNMOUNT_LOGIC["unmountFromEquip():<br/>1. operStatus='WAREHOUSE'<br/>2. mountedEquipCode=null<br/>3. MountLog INSERT"]
    REPAIR_LOGIC["setRepairStatus():<br/>1. 장착중이면 먼저 unmount<br/>2. operStatus='REPAIR'<br/>3. MountLog INSERT"]
    COMPLETE_LOGIC["completeRepair():<br/>1. operStatus='WAREHOUSE'<br/>2. MountLog INSERT"]
  end

  subgraph Entities
    CM[ConsumableMaster<br/>CONSUMABLE_MASTERS]
    CML[ConsumableMountLog<br/>CONSUMABLE_MOUNT_LOGS]
  end

  Service --> Entities
```

## 6. 처리 규칙 및 검증

| 규칙 | 설명 |
|------|------|
| 장착 전제 | operStatus가 'WAREHOUSE' 이어야 함 |
| 해제 전제 | operStatus가 'MOUNTED' 이어야 함 |
| 수리 전제 | 장착중이면 자동 unmount 후 수리 전환 |
| 수리완료 전제 | operStatus가 'REPAIR' 이어야 함 |
| MountLog 복합PK | MOUNT_DATE + SEQ (일자 + 일련번호) |
| 사용 횟수 증가 | POST /:id/increase로 currentCount 증가 |

## 7. 상태 전이 (ConsumableMaster.operStatus)

```mermaid
flowchart LR
  WAREHOUSE["WAREHOUSE<br/>(창고)"] -->|mount| MOUNTED["MOUNTED<br/>(설비장착)"]
  MOUNTED -->|unmount| WAREHOUSE
  MOUNTED -->|repair| REPAIR["REPAIR<br/>(수리중)"]
  WAREHOUSE -->|repair| REPAIR
  REPAIR -->|complete-repair| WAREHOUSE
```

## 8. 상태 코드 및 공통코드

| 코드 그룹 | 값 | 설명 |
|-----------|-----|------|
| `CONSUMABLE_OPER_STATUS` | WAREHOUSE, MOUNTED, REPAIR | 설비 연계 운영 상태 |
| `CONSUMABLE_CATEGORY` | MOLD, JIG, TOOL, ETC | 소모품 분류 |
| `CONSUMABLE_STATUS` | NORMAL, WARNING, REPLACE | 수명 상태 |

## 9. DB 테이블 영향 및 엔티티

| 테이블 | 엔티티 | 설명 |
|--------|--------|------|
| `CONSUMABLE_MASTERS` | `ConsumableMaster` | operStatus, mountedEquipCode 변경 |
| `CONSUMABLE_MOUNT_LOGS` | `ConsumableMountLog` | 장착/해제 이력 |

ConsumableMountLog 컬럼:
- `MOUNT_DATE` + `SEQ` (복합PK)
- `CONSUMABLE_CODE`, `EQUIP_CODE`, `ACTION` (MOUNT/UNMOUNT)
- `WORKER_CODE`, `REMARK`, `CON_UID`
- `COMPANY`, `PLANT_CD`

## 10. 에러 코드

| HTTP | 상황 |
|------|------|
| 200 | action 성공 |
| 404 | 소모품 미존재 |
| 409 | 이미 장착된 금형 (mount 시 중복 장착) |
| 400 | 잘못된 상태 전이 |

## 11. 비고

- `CONS_MOUNT`는 `equipment/consumables` 경로 사용 (equipment 모듈 소속)
- CRUD 기본은 `consumables` 모듈이 정식, `equipment/consumables`는 설비 모듈 내 편의용
- DataGrid sqlQuery 표시는 CONSUMABLE_MASTERS 기준
- Action 버튼 가시성: operStatus에 따라 조건부 렌더링 (ex. MOUNTED면 unmount만 표시)

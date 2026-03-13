# IATF 16949 누락 모듈 구현 마스터 플랜

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan.

**Goal:** HARNESS MES에 누락된 IATF 16949 품질규정 대응 모듈을 순차적으로 추가한다.

**Architecture:** 기존 NestJS + Next.js 모노레포 패턴(Entity→DTO→Service→Controller→Frontend)을 100% 따른다. 각 모듈은 독립적으로 동작하며, 기존 quality/production 모듈과 연동한다.

**Tech Stack:** NestJS, TypeORM (Oracle), Next.js 14, TanStack Table, Tailwind CSS, i18n(ko/en/zh/vi)

---

## 실행 순서 (Phase 1~4)

### Phase 1: IATF 핵심 품질 모듈 (이번 세션)
1. **4M 변경점관리 (ECN)** — IATF 8.5.6
2. **CAPA 시정/예방조치** — IATF 10.2
3. **고객클레임 관리 (8D)** — IATF 10.2.6
4. **초물검사 (FAI)** — IATF 8.3.4.4

### Phase 2: 품질 고도화 (다음 세션)
5. SPC 통계적 공정관리 — IATF 9.1.1
6. MSA 계측기 교정 — IATF 7.1.5
7. Control Plan 관리 — IATF 8.5.1.1

### Phase 3: 운영 효율화 (향후)
8. PPAP 관리
9. 교육훈련 관리
10. 문서관리 (DCC)
11. 내부감사
12. 금형 전용 관리

### Phase 4: 하드웨어 연동 (별도)
13. 바코드/라벨 프린터 연동
14. PDA 앱
15. 설비 시리얼 통신

---

## Phase 1 상세 설계

---

### Module 1: 4M 변경점관리 (Engineering Change Management)

**IATF 8.5.6**: 생산 4M(Man, Machine, Material, Method) 변경 시 사전 평가 및 승인 필수

#### 상태 흐름
```
DRAFT → SUBMITTED → REVIEWING → APPROVED → IN_PROGRESS → COMPLETED → CLOSED
                  → REJECTED (반려 시)
```

#### 엔티티: CHANGE_ORDERS
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ID | number (PK, SEQ) | |
| CHANGE_NO | varchar(30) | 자동채번 ECN-YYYYMMDD-NNN |
| CHANGE_TYPE | varchar(30) | MAN/MACHINE/MATERIAL/METHOD |
| TITLE | varchar(200) | 변경 제목 |
| DESCRIPTION | varchar(2000) | 변경 내용 상세 |
| REASON | varchar(1000) | 변경 사유 |
| RISK_ASSESSMENT | varchar(1000) | 위험성 평가 |
| AFFECTED_ITEMS | varchar(2000) | 영향 품목 (JSON) |
| AFFECTED_PROCESSES | varchar(2000) | 영향 공정 (JSON) |
| PRIORITY | varchar(20) | HIGH/MEDIUM/LOW |
| STATUS | varchar(30) | 상태 |
| REQUESTED_BY | varchar(50) | 요청자 |
| REQUESTED_AT | timestamp | 요청일 |
| REVIEWER_CODE | varchar(50) | 검토자 |
| REVIEWED_AT | timestamp | 검토일 |
| REVIEW_COMMENT | varchar(1000) | 검토 의견 |
| APPROVER_CODE | varchar(50) | 승인자 |
| APPROVED_AT | timestamp | 승인일 |
| APPROVE_COMMENT | varchar(1000) | 승인 의견 |
| EFFECTIVE_DATE | date | 시행일 |
| COMPLETION_DATE | date | 완료일 |
| COMPANY | varchar(50) | |
| PLANT | varchar(20) | |
| CREATED_BY | varchar(50) | |
| UPDATED_BY | varchar(50) | |
| CREATED_AT | timestamp | |
| UPDATED_AT | timestamp | |

#### API 엔드포인트
| Method | Path | 설명 |
|--------|------|------|
| GET | /quality/changes | 목록 조회 |
| GET | /quality/changes/stats | 통계 |
| GET | /quality/changes/:id | 단건 조회 |
| POST | /quality/changes | 등록 |
| PUT | /quality/changes/:id | 수정 |
| PATCH | /quality/changes/:id/submit | 제출 (DRAFT→SUBMITTED) |
| PATCH | /quality/changes/:id/review | 검토 (SUBMITTED→REVIEWING→APPROVED/REJECTED) |
| PATCH | /quality/changes/:id/approve | 승인 |
| PATCH | /quality/changes/:id/start | 시행 시작 |
| PATCH | /quality/changes/:id/complete | 완료 |
| DELETE | /quality/changes/:id | 삭제 (DRAFT만) |

#### 파일 구조
```
apps/backend/src/
  entities/change-order.entity.ts
  modules/quality/
    dto/change-order.dto.ts
    services/change-order.service.ts
    controllers/change-order.controller.ts
    quality.module.ts (수정 — 엔티티/서비스/컨트롤러 추가)

apps/frontend/src/
  app/(authenticated)/quality/change-control/page.tsx
  app/(authenticated)/quality/change-control/components/ChangeFormPanel.tsx
  locales/{ko,en,zh,vi}.json (키 추가)
  config/menuConfig.ts (메뉴 추가)
```

#### ComCode
- `CHANGE_TYPE`: MAN, MACHINE, MATERIAL, METHOD
- `CHANGE_STATUS`: DRAFT, SUBMITTED, REVIEWING, APPROVED, REJECTED, IN_PROGRESS, COMPLETED, CLOSED
- `CHANGE_PRIORITY`: HIGH, MEDIUM, LOW

---

### Module 2: CAPA 시정/예방조치

**IATF 10.2**: 부적합 발생 시 근본 원인 분석 및 시정/예방 조치

#### 상태 흐름
```
OPEN → ANALYZING → ACTION_PLANNED → IN_PROGRESS → VERIFYING → CLOSED
```

#### 엔티티: CAPA_REQUESTS
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ID | number (PK, SEQ) | |
| CAPA_NO | varchar(30) | 자동채번 CA-YYYYMMDD-NNN / PA-YYYYMMDD-NNN |
| CAPA_TYPE | varchar(20) | CORRECTIVE / PREVENTIVE |
| SOURCE_TYPE | varchar(30) | DEFECT / COMPLAINT / AUDIT / REWORK |
| SOURCE_ID | number | 원인 레코드 ID (DefectLog, Complaint 등) |
| TITLE | varchar(200) | |
| DESCRIPTION | varchar(2000) | 부적합 내용 |
| ROOT_CAUSE | varchar(2000) | 근본 원인 분석 (5Why, FTA 등) |
| ACTION_PLAN | varchar(2000) | 시정/예방 조치 계획 |
| TARGET_DATE | date | 목표 완료일 |
| RESPONSIBLE_CODE | varchar(50) | 담당자 |
| STATUS | varchar(30) | |
| PRIORITY | varchar(20) | |
| VERIFICATION_RESULT | varchar(1000) | 유효성 검증 결과 |
| VERIFIED_BY | varchar(50) | 검증자 |
| VERIFIED_AT | timestamp | |
| CLOSED_AT | timestamp | |
| ITEM_CODE | varchar(50) | 관련 품목 |
| LINE_CODE | varchar(50) | 관련 라인 |
| COMPANY | varchar(50) | |
| PLANT | varchar(20) | |
| CREATED_BY / UPDATED_BY | varchar(50) | |
| CREATED_AT / UPDATED_AT | timestamp | |

#### 엔티티: CAPA_ACTIONS (조치 항목)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ID | number (PK, SEQ) | |
| CAPA_ID | number (FK) | CAPA_REQUESTS.ID |
| SEQ | number | 순서 |
| ACTION_DESC | varchar(1000) | 조치 내용 |
| RESPONSIBLE_CODE | varchar(50) | 담당자 |
| DUE_DATE | date | 기한 |
| STATUS | varchar(20) | PENDING / IN_PROGRESS / DONE |
| RESULT | varchar(1000) | 조치 결과 |
| COMPLETED_AT | timestamp | |
| CREATED_AT / UPDATED_AT | timestamp | |

#### API 엔드포인트
| Method | Path | 설명 |
|--------|------|------|
| GET | /quality/capas | 목록 |
| GET | /quality/capas/stats | 통계 |
| GET | /quality/capas/:id | 단건 (actions 포함) |
| POST | /quality/capas | 등록 |
| PUT | /quality/capas/:id | 수정 |
| PATCH | /quality/capas/:id/analyze | 원인 분석 완료 |
| PATCH | /quality/capas/:id/plan | 조치 계획 등록 |
| PATCH | /quality/capas/:id/start | 조치 시작 |
| PATCH | /quality/capas/:id/verify | 유효성 검증 |
| PATCH | /quality/capas/:id/close | 종료 |
| POST | /quality/capas/:id/actions | 조치항목 추가 |
| PATCH | /quality/capas/:id/actions/:actionId | 조치항목 수정 |
| DELETE | /quality/capas/:id | 삭제 (OPEN만) |

#### 파일 구조
```
apps/backend/src/
  entities/capa-request.entity.ts
  entities/capa-action.entity.ts
  modules/quality/
    dto/capa.dto.ts
    services/capa.service.ts
    controllers/capa.controller.ts

apps/frontend/src/
  app/(authenticated)/quality/capa/page.tsx
  app/(authenticated)/quality/capa/components/CapaFormPanel.tsx
  app/(authenticated)/quality/capa/components/ActionList.tsx
```

---

### Module 3: 고객클레임 관리

**IATF 10.2.6**: 고객 불만 접수 → 원인 분석 → 대응 → 재발 방지

#### 상태 흐름
```
RECEIVED → INVESTIGATING → RESPONDING → RESOLVED → CLOSED
```

#### 엔티티: CUSTOMER_COMPLAINTS
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ID | number (PK, SEQ) | |
| COMPLAINT_NO | varchar(30) | CC-YYYYMMDD-NNN |
| CUSTOMER_CODE | varchar(50) | 고객 코드 |
| CUSTOMER_NAME | varchar(200) | 고객명 |
| COMPLAINT_DATE | date | 접수일 |
| ITEM_CODE | varchar(50) | 클레임 품목 |
| LOT_NO | varchar(100) | 관련 LOT |
| DEFECT_QTY | number | 불량 수량 |
| COMPLAINT_TYPE | varchar(30) | QUALITY / DELIVERY / DAMAGE |
| DESCRIPTION | varchar(2000) | 클레임 내용 |
| URGENCY | varchar(20) | CRITICAL / HIGH / MEDIUM / LOW |
| STATUS | varchar(30) | |
| INVESTIGATION | varchar(2000) | 조사 내용 |
| ROOT_CAUSE | varchar(2000) | 근본 원인 |
| CONTAINMENT_ACTION | varchar(1000) | 긴급 봉쇄 조치 |
| CORRECTIVE_ACTION | varchar(1000) | 시정 조치 |
| PREVENTIVE_ACTION | varchar(1000) | 예방 조치 |
| RESPONSE_DATE | date | 회신일 |
| RESPONSIBLE_CODE | varchar(50) | 담당자 |
| CAPA_ID | number | 연계된 CAPA ID (nullable) |
| COST_AMOUNT | decimal(12,2) | 클레임 비용 |
| RESOLVED_AT | timestamp | |
| COMPANY / PLANT | varchar | |
| CREATED_BY / UPDATED_BY / CREATED_AT / UPDATED_AT | |

#### API 엔드포인트
| Method | Path | 설명 |
|--------|------|------|
| GET | /quality/complaints | 목록 |
| GET | /quality/complaints/stats | 통계 |
| GET | /quality/complaints/:id | 단건 |
| POST | /quality/complaints | 등록 |
| PUT | /quality/complaints/:id | 수정 |
| PATCH | /quality/complaints/:id/investigate | 조사 시작 |
| PATCH | /quality/complaints/:id/respond | 대응 완료 |
| PATCH | /quality/complaints/:id/resolve | 해결 |
| PATCH | /quality/complaints/:id/close | 종료 |
| PATCH | /quality/complaints/:id/link-capa | CAPA 연계 |
| DELETE | /quality/complaints/:id | 삭제 |

#### 파일 구조
```
apps/backend/src/
  entities/customer-complaint.entity.ts
  modules/quality/
    dto/complaint.dto.ts
    services/complaint.service.ts
    controllers/complaint.controller.ts

apps/frontend/src/
  app/(authenticated)/quality/complaint/page.tsx
  app/(authenticated)/quality/complaint/components/ComplaintFormPanel.tsx
```

---

### Module 4: 초물검사 (First Article Inspection)

**IATF 8.3.4.4**: 신규/변경 품목의 첫 생산품 검증

#### 상태 흐름
```
REQUESTED → SAMPLING → INSPECTING → PASS / FAIL / CONDITIONAL
```

#### 엔티티: FAI_REQUESTS
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ID | number (PK, SEQ) | |
| FAI_NO | varchar(30) | FAI-YYYYMMDD-NNN |
| TRIGGER_TYPE | varchar(30) | NEW_PART / ECN / PROCESS_CHANGE / LONG_STOP |
| TRIGGER_REF | varchar(100) | 변경점 참조 번호 |
| ITEM_CODE | varchar(50) | 검사 품목 |
| ORDER_NO | varchar(50) | 작업지시 |
| LINE_CODE | varchar(50) | |
| SAMPLE_QTY | number | 샘플 수량 |
| INSPECTOR_CODE | varchar(50) | 검사자 |
| STATUS | varchar(30) | |
| INSPECT_DATE | date | 검사일 |
| RESULT | varchar(20) | PASS / FAIL / CONDITIONAL |
| REMARKS | varchar(1000) | |
| APPROVAL_CODE | varchar(50) | 승인자 |
| APPROVED_AT | timestamp | |
| COMPANY / PLANT | varchar | |
| CREATED_BY / UPDATED_BY / CREATED_AT / UPDATED_AT | |

#### 엔티티: FAI_ITEMS (검사항목별 결과)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| ID | number (PK, SEQ) | |
| FAI_ID | number (FK) | FAI_REQUESTS.ID |
| SEQ | number | |
| INSPECT_ITEM | varchar(200) | 검사 항목명 |
| SPEC_MIN | decimal(12,4) | 규격 하한 |
| SPEC_MAX | decimal(12,4) | 규격 상한 |
| MEASURED_VALUE | decimal(12,4) | 측정값 |
| UNIT | varchar(20) | 단위 |
| RESULT | varchar(10) | OK / NG |
| REMARKS | varchar(500) | |
| CREATED_AT / UPDATED_AT | |

#### API 엔드포인트
| Method | Path | 설명 |
|--------|------|------|
| GET | /quality/fai | 목록 |
| GET | /quality/fai/stats | 통계 |
| GET | /quality/fai/:id | 단건 (items 포함) |
| POST | /quality/fai | 등록 |
| PUT | /quality/fai/:id | 수정 |
| PATCH | /quality/fai/:id/start | 검사 시작 |
| PATCH | /quality/fai/:id/complete | 검사 완료 (판정) |
| PATCH | /quality/fai/:id/approve | 승인 |
| POST | /quality/fai/:id/items | 검사항목 일괄 등록 |
| DELETE | /quality/fai/:id | 삭제 |

#### 파일 구조
```
apps/backend/src/
  entities/fai-request.entity.ts
  entities/fai-item.entity.ts
  modules/quality/
    dto/fai.dto.ts
    services/fai.service.ts
    controllers/fai.controller.ts

apps/frontend/src/
  app/(authenticated)/quality/fai/page.tsx
  app/(authenticated)/quality/fai/components/FaiFormPanel.tsx
  app/(authenticated)/quality/fai/components/FaiItemList.tsx
```

---

## 공통 작업 (모든 모듈 완료 후)

### 메뉴 등록 (menuConfig.ts)
```typescript
// QUALITY children에 추가
{ code: "QC_CHANGE", labelKey: "menu.quality.changeControl", path: "/quality/change-control" },
{ code: "QC_CAPA", labelKey: "menu.quality.capa", path: "/quality/capa" },
{ code: "QC_COMPLAINT", labelKey: "menu.quality.complaint", path: "/quality/complaint" },
{ code: "QC_FAI", labelKey: "menu.quality.fai", path: "/quality/fai" },
```

### i18n 키 (4개 언어)
- `quality.change.*` — 변경점관리
- `quality.capa.*` — CAPA
- `quality.complaint.*` — 고객클레임
- `quality.fai.*` — 초물검사

### ComCode 시드
- CHANGE_TYPE, CHANGE_STATUS, CHANGE_PRIORITY
- CAPA_TYPE, CAPA_STATUS, CAPA_SOURCE_TYPE, CAPA_ACTION_STATUS
- COMPLAINT_TYPE, COMPLAINT_STATUS, COMPLAINT_URGENCY
- FAI_TRIGGER_TYPE, FAI_STATUS, FAI_RESULT

### 역할 시드 (seed-roles.ts)
- 새 메뉴 코드 4개를 admin/manager 역할에 추가

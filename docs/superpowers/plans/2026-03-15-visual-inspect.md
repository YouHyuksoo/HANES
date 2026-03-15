# 외관검사 이력 등록 구현 계획

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공정의 외관검사 결과를 생산실적(ProdResult)에 연동하여 등록/조회하는 페이지 구현

**Architecture:** 기존 `InspectResult` 엔티티와 `inspect-result` API를 그대로 활용. 프론트엔드 `quality/inspect/page.tsx`를 외관검사 전용 페이지로 재작성. 좌측에 생산실적 목록, 우측 패널에서 검사 등록.

**Tech Stack:** NestJS (백엔드 기존 API), Next.js + React (프론트엔드), ComCode (불량항목 관리)

---

## Chunk 1: 백엔드 준비

### Task 1: ComCode 시드 — VISUAL_DEFECT 불량 항목

**Files:**
- Modify: `scripts/migration/seed_form_comcodes.sql`

- [ ] **Step 1: VISUAL_DEFECT 그룹 + 항목 INSERT 추가**

```sql
-- 외관검사 불량 유형
INSERT INTO COM_CODE_GROUPS (GROUP_CODE, GROUP_NAME, DESCRIPTION, USE_YN)
VALUES ('VISUAL_DEFECT', '외관불량유형', '외관검사 불량 항목 분류', 'Y');

INSERT INTO COM_CODES (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN)
VALUES ('VISUAL_DEFECT', 'SCRATCH', '스크래치', 1, 'Y');
INSERT INTO COM_CODES (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN)
VALUES ('VISUAL_DEFECT', 'DISCOLOR', '변색', 2, 'Y');
INSERT INTO COM_CODES (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN)
VALUES ('VISUAL_DEFECT', 'DENT', '찍힘', 3, 'Y');
INSERT INTO COM_CODES (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN)
VALUES ('VISUAL_DEFECT', 'FOREIGN', '이물질', 4, 'Y');
INSERT INTO COM_CODES (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN)
VALUES ('VISUAL_DEFECT', 'CRACK', '크랙', 5, 'Y');
INSERT INTO COM_CODES (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN)
VALUES ('VISUAL_DEFECT', 'BURR', '버(Burr)', 6, 'Y');
INSERT INTO COM_CODES (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN)
VALUES ('VISUAL_DEFECT', 'DIMENSION', '치수불량', 7, 'Y');
INSERT INTO COM_CODES (GROUP_CODE, DETAIL_CODE, CODE_NAME, SORT_ORDER, USE_YN)
VALUES ('VISUAL_DEFECT', 'OTHER', '기타', 99, 'Y');
```

- [ ] **Step 2: JSHANES DB에 시드 실행**

```bash
cd /c/Users/hsyou/.claude/skills/oracle-db
python scripts/oracle_connector.py --site JSHANES --execute-file /c/Project/HANES/scripts/migration/seed_visual_defect.sql
```

- [ ] **Step 3: 커밋**

```bash
git add scripts/migration/seed_form_comcodes.sql
git commit -m "feat: 외관검사 불량유형 ComCode 시드 추가"
```

### Task 2: inspect-result API에 inspectType 필터 확인

**Files:**
- Read: `apps/backend/src/modules/quality/dto/inspect-result.dto.ts`
- Modify (필요 시): `apps/backend/src/modules/quality/services/inspect-result.service.ts`

현재 `InspectResultQueryDto`에 `inspectType` 필터가 있는지 확인하고, 없으면 추가.

- [ ] **Step 1: DTO에 inspectType 필터 존재 확인**

`inspect-result.dto.ts`의 `InspectResultQueryDto` 클래스에 `inspectType` 프로퍼티가 있는지 확인.

- [ ] **Step 2: 없으면 DTO에 추가**

```typescript
@IsOptional()
@IsString()
inspectType?: string;
```

- [ ] **Step 3: 서비스 findAll에 inspectType 필터 적용 확인**

`inspect-result.service.ts`의 `findAll()` 메서드에서 `query.inspectType`으로 WHERE 조건 추가되어 있는지 확인. 없으면:

```typescript
if (query.inspectType) {
  qb.andWhere('ir.inspectType = :inspectType', { inspectType: query.inspectType });
}
```

- [ ] **Step 4: 커밋 (변경 있는 경우)**

---

## Chunk 2: 프론트엔드 — 외관검사 페이지 재작성

### Task 3: 타입 정의

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/inspect/types.ts`

- [ ] **Step 1: 타입 파일 생성**

```typescript
/**
 * @file quality/inspect/types.ts
 * @description 외관검사 이력 타입 정의
 */
import type { UseYn } from "@/types";

/** 생산실적 (외관검사 대상) */
export interface ProdResultRow {
  id: number;
  orderNo: string;
  equipCode: string;
  workerId: string;
  processCode: string;
  goodQty: number;
  defectQty: number;
  startAt: string;
  endAt: string | null;
  status: string;
  /** 검사 완료 여부 (프론트에서 계산) */
  inspected?: boolean;
}

/** 검사결과 레코드 */
export interface InspectRecord {
  id: number;
  prodResultId: number;
  inspectType: string;
  passYn: string;
  errorCode: string | null;
  errorDetail: string | null;
  inspectData: string | null;
  inspectAt: string;
  inspectorId: string | null;
}

/** 불량 체크리스트 항목 */
export interface DefectCheckItem {
  code: string;
  name: string;
  checked: boolean;
  qty: number;
  remark: string;
}
```

### Task 4: 메인 페이지 재작성

**Files:**
- Rewrite: `apps/frontend/src/app/(authenticated)/quality/inspect/page.tsx`

페이지 구조:
- 상단: StatCard (총건수, 검사완료, 미검사, 합격률)
- 메인: DataGrid — 생산실적 목록 (외관검사 공정, processCode 필터)
- 행 클릭 → 우측 패널 오픈 → 검사 등록/조회

- [ ] **Step 1: 페이지 파일 재작성**

주요 구현:
1. `GET /production/prod-results?processCode=VISUAL&limit=5000` 로 생산실적 조회
2. `GET /quality/inspect-results?inspectType=VISUAL&limit=5000` 로 기존 검사이력 조회 (병렬)
3. 생산실적에 검사이력 매핑 → 검사완료/미검사 상태 표시
4. StatCard: 총건수, 검사완료, 미검사, 합격률
5. DataGrid 컬럼: 작업지시, 품목, 공정, 양품수, 불량수, 검사상태, 판정결과
6. 행 클릭 → InspectFormPanel 오픈
7. 필터: 날짜범위, 검사상태(전체/완료/미검사), 판정(전체/합격/불합격)

- [ ] **Step 2: 검색 디바운스 적용** (기존 패턴 문제 수정)

```typescript
const [searchText, setSearchText] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
  return () => clearTimeout(timer);
}, [searchText]);
```

fetchData의 dependency에 `debouncedSearch` 사용.

### Task 5: 검사 등록 패널 컴포넌트

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/inspect/components/InspectFormPanel.tsx`

- [ ] **Step 1: 패널 컴포넌트 생성**

구성:
1. **상단 — 생산실적 정보 (읽기전용)**
   - 작업지시번호, 품목명, 공정, 양품수량, 설비, 작업자
2. **중간 — 판정 영역**
   - 합격 / 불합격 버튼 (크게, 색상 구분)
   - 검사원 선택 (WorkerSelect)
3. **하단 — 불합격 시 체크리스트** (passYn === 'N' 일 때만 표시)
   - ComCode `VISUAL_DEFECT` 기반 체크리스트
   - 각 항목: 체크박스 + 불량수량 + 비고
   - 불량코드 (대표 불량코드 선택)
   - 상세 사유 텍스트
4. **저장**: `POST /quality/inspect-results` 호출
   - `prodResultId`: 선택된 생산실적 ID
   - `inspectType`: `'VISUAL'`
   - `passYn`: `'Y'` 또는 `'N'`
   - `errorCode`: 대표 불량코드
   - `errorDetail`: 상세 사유
   - `inspectData`: JSON 문자열 (체크리스트 결과)
   - `inspectorId`: 검사원 ID
5. **이미 검사 완료된 실적**: 결과 읽기전용 표시

### Task 6: i18n 키 추가

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: 4개 파일에 quality.inspect 키 업데이트**

```json
// ko.json (quality.inspect 섹션 교체)
"inspect": {
  "title": "외관검사",
  "subtitle": "외관검사 이력 등록 및 조회",
  "totalCount": "총 건수",
  "inspected": "검사완료",
  "notInspected": "미검사",
  "passRate": "합격률",
  "statusAll": "전체",
  "statusDone": "완료",
  "statusPending": "미검사",
  "pass": "합격",
  "fail": "불합격",
  "judgement": "판정",
  "inspector": "검사원",
  "defectChecklist": "불량 체크리스트",
  "defectQty": "불량수량",
  "defectRemark": "비고",
  "mainDefectCode": "대표 불량코드",
  "detailReason": "상세 사유",
  "alreadyInspected": "검사 완료됨",
  "inspectInfo": "생산실적 정보",
  "searchPlaceholder": "작업지시번호, 품목코드 검색"
}
```

- [ ] **Step 2: Grep으로 4개 파일에 키 존재 확인**

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/quality/inspect/
git add apps/frontend/src/locales/
git commit -m "feat: 외관검사 이력 등록 페이지 구현"
```

---

## Chunk 3: 메뉴 및 ComCode 번역

### Task 7: 메뉴 설정 업데이트

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts`

- [ ] **Step 1: QC_INSPECT 메뉴 이름 확인/수정**

메뉴명이 "검사실적"에서 "외관검사"로 변경되어야 하면 i18n 키로 대응 (menuConfig은 i18n 키 사용).

### Task 8: ComCode 번역 키 (선택)

**Files:**
- Modify: `apps/frontend/src/locales/ko.json` (comCode 섹션)
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: VISUAL_DEFECT ComCode 번역 추가**

```json
// ko.json - comCode 섹션
"VISUAL_DEFECT": {
  "SCRATCH": "스크래치",
  "DISCOLOR": "변색",
  "DENT": "찍힘",
  "FOREIGN": "이물질",
  "CRACK": "크랙",
  "BURR": "버(Burr)",
  "DIMENSION": "치수불량",
  "OTHER": "기타"
}
```

- [ ] **Step 2: 커밋**

---

## 구현 순서 요약

| 순서 | Task | 설명 |
|:----:|:----:|------|
| 1 | Task 1 | ComCode VISUAL_DEFECT 시드 |
| 2 | Task 2 | 백엔드 inspectType 필터 확인/보완 |
| 3 | Task 3 | 프론트 타입 정의 |
| 4 | Task 4 | 메인 페이지 재작성 |
| 5 | Task 5 | 검사 등록 패널 컴포넌트 |
| 6 | Task 6 | i18n 4개 파일 |
| 7 | Task 7-8 | 메뉴 + ComCode 번역 |

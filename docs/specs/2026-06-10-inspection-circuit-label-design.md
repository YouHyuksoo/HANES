# 통전검사 회로라벨 매핑 설계

- 날짜: 2026-06-10
- 화면: `/inspection/result` (통전검사 관리)
- 모듈: `quality/continuity-inspect`

## 목표

검사 대상 제품 바코드를 스캔하여 검사를 진행하고, **합격(PASS) 시 설비에서 자동 출력된 회로라벨 바코드를 스캔**하여 검사결과에 매핑·저장한다. 화면 이력 그리드에 회로라벨 컬럼을 표시한다.

## 결정 사항 (사용자 확정)

1. **적용 범위:** 스캔 모드(`FG_BARCODE_ISSUE_TIMING` = `ON_PRODUCTION` / `PRE_ISSUE`)에만 적용. `ON_INSPECT` 모드는 변경하지 않는다.
2. **스캔 시점:** PASS 직전 입력칸에 회로라벨을 스캔(제품 바코드 스캔 → 회로라벨 스캔 → PASS). 단일 트랜잭션.
3. **저장 위치:** `INSPECT_RESULTS.CIRCUIT_LABEL` (`VARCHAR2(200)`, nullable).
4. **필수 여부:** 스캔 모드 PASS 시 회로라벨 필수(서버 강제).
5. **중복 차단:** 동일 회로라벨이 이미 다른 `INSPECT_RESULTS` 행에 존재하면 거부(company/plant 스코프).

## 변경 내역

### 1. DB 마이그레이션
- `apps/backend/src/migrations/2026-06-10_inspect_result_circuit_label.sql`
- `ALTER TABLE INSPECT_RESULTS ADD (CIRCUIT_LABEL VARCHAR2(200))`
- JSHANES 적용 후 실DB 쿼리로 컬럼 존재 확인. nullable 추가라 기존 행 안전.

### 2. 엔티티 — `InspectResult`
- `@Column({ type: 'varchar2', name: 'CIRCUIT_LABEL', length: 200, nullable: true }) circuitLabel: string | null;`

### 3. DTO — `ContinuityInspectDto`
- `@IsOptional() @IsString() @MaxLength(200) circuitLabel?: string;`
- 필수성은 DTO가 아닌 서비스 로직으로 강제(모드/PASS 조건부).

### 4. 서비스 — `ContinuityInspectService.inspect()`
- 스캔 모드(`timing !== 'ON_INSPECT'`) + `passYn === 'Y'`:
  - `!dto.circuitLabel` → `BadRequestException('합격 시 회로라벨 스캔이 필요합니다.')`
  - 회로라벨 중복 검사: `inspectResultRepo.count({ circuitLabel, company, plant })` > 0 → `BadRequestException('이미 사용된 회로라벨입니다.')` (트랜잭션 내 `queryRunner.manager` 사용)
- `InspectResult` 생성 시 `circuitLabel: dto.circuitLabel ?? null` 저장(FAIL/ON_INSPECT 경로엔 null 허용).

### 5. 이력 그리드 표시 — `findFgLabelsByOrder()`
- 라벨 조회 후 `inspectResultId` 목록을 모아 `InspectResult`를 `In()` 단일 쿼리로 조회(`{ resultNo, circuitLabel }`), 메모리 매핑하여 각 라벨 행에 `circuitLabel` 부여.
- 조인 키: `FG_LABELS.INSPECT_RESULT_ID = INSPECT_RESULTS.RESULT_NO`.
- N+1 금지. Oracle 대문자/별칭 함정 회피 위해 `getRawAndEntities` 대신 2쿼리 + 메모리 매핑 사용.

### 6. 프론트엔드 — `InspectPanel.tsx` (스캔 모드만)
- 제품 바코드 입력칸 아래 회로라벨 스캔 입력칸 추가. 제품 바코드 Enter → 회로라벨 입력칸 포커스 이동.
- PASS 버튼: 스캔 모드에서 제품 바코드 또는 회로라벨 미입력 시 비활성화(`scanDisabled` 확장).
- `handlePass` payload에 `circuitLabel` 포함. FAIL은 회로라벨 미포함.
- 이력 그리드 columns에 `회로라벨` 컬럼 추가.
- `types.ts`: `FgLabelRow.circuitLabel?: string` 추가.
- i18n 4파일(ko/en/zh/vi) 동시 수정, BOM 금지: 회로라벨 헤더 / 스캔 placeholder / 미스캔 경고 키.

## 검증
- 백엔드/프론트 `tsc` 0
- continuity-inspect spec 회귀 통과(+ 회로라벨 필수/중복 케이스 추가)
- JSHANES 마이그레이션 적용 후 실DB 컬럼 확인
- i18n 키 4파일 Grep 검증

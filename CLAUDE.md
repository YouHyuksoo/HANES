# HARNESS MES 프로젝트 설정

## 패키지 매니저

- **pnpm 전용** (`pnpm@10.28.1`) — npm 사용 금지
- Turborepo + pnpm 모노레포 구조
- 명령어: `pnpm install`, `pnpm dev`, `pnpm build`

## 데이터베이스

- **Oracle DB 사용** — DDL 실행은 반드시 `oracle-db` 스킬 사용
- 컬럼 타입 변경(예: NVARCHAR2) **사용자 승인 없이 절대 금지**
- 스키마 변경(DDL) 실행 전 반드시 사용자 확인
- DDL/DML 실행 시 `--site` 파라미터 명시 (기본: JSHANES). 타임아웃 시 **다른 사이트로 자동 전환 금지**
- DB INSERT/시드 SQL 작성 시 **실제 테이블 스키마(`user_tab_columns`) 먼저 조회** — 엔티티 기준 추정 금지

## 테스트 & 검증

- **Playwright 사용 금지** — 브라우저 테스트는 사용자가 직접 수행
- 검증은 API 호출, CLI 체크, `pnpm build` 사용
- 사용자가 이미 dev 서버 실행 중이면 **중복 실행 금지**
- 프론트엔드 개발 서버 포트: **3002** (3000, 3001 사용 금지)

## UI 규칙

- `alert()`, `confirm()`, `prompt()` 사용 금지 — Modal/ConfirmModal 사용
- 통계 카드는 `StatCard` 컴포넌트(`@/components/ui`) 사용
- DataGrid 'split'/'pin' 요청 = **고정/핀 컬럼** (split-pane 듀얼 그리드 아님)
- flex 스크롤: `overflow-y-auto` 사용 시 반드시 `min-h-0` 함께 적용
- 코드/마스터 데이터 입력은 **셀렉트/콤보박스 우선** — 텍스트 직접입력은 자유 텍스트(비고 등)만
- 필터는 `components/shared/` 공용 컴포넌트 우선 사용 (`labelPrefix` 패턴)

## 공통코드(ComCode)

- 코드값 컬럼은 반드시 `ComCodeBadge` + `useComCodeOptions` 사용
- 하드코딩된 한국어 라벨/색상 **절대 금지**
- 상세 사용법 → [docs/comcode-guide.md](docs/comcode-guide.md) 참조

## 코드 품질

- 에러를 하드코딩 기본값/폴백으로 숨기지 말 것 — `|| '기본값'`, `?? '기본값'` 패턴 금지
- TypeScript catch 변수는 반드시 타입 지정 (예: `catch (error: unknown)`)
- `as any` 타입 회피 금지 — 처음부터 올바른 타입으로 작성
- 멀티테넌시 기능 구현 시 COMPANY, PLANT_CD 컬럼 반드시 포함
- 수정 후 `pnpm build` 에러 0건 확인 후에만 완료 보고

## 엔티티 규칙

- `@PrimaryGeneratedColumn` 사용 금지 — `@PrimaryColumn` 자연키/복합키 사용
- PK 우선순위: 자연키 > 부모FK+seq > 비즈니스일자+seq > 채번(`PKG_SEQ_GENERATOR`)
- 모든 컬럼에 `name: 'UPPER_SNAKE_CASE'` 명시 (Oracle 컨벤션)
- 재고수량은 **MatStock 단일 관리** — MatLot에 재고수량 컬럼 사용 금지

## API 규칙

- 백엔드 컨트롤러 경로 확정 후 프론트엔드 작성 — 경로 불일치 방지
- 경로 패턴: `/<모듈>/<리소스복수형>` (예: `/master/parts`, `/material/lots`)

## 워크플로우

- 큰 아키텍처 가정 전 **먼저 확인** 요청
- 수정 요청 시 **해당 부분만 수정** — 새로운 가정으로 재구현 금지


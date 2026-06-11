# codex Handoff

## Last Update

2026-06-12 05:59

## Completed

- `T-KIOSK-AUTOISSUE-BOM-MISMATCH-GUARD`: 키오스크 투입스캔 LOT가 BOM 품목과 불일치하면 실적처리/자동차감 전 중단하도록 `AutoIssueService`에 방어 추가. `JOB_MATERIAL_LOTS.itemCode`와 실제 `MAT_LOTS.itemCode`를 유효 BOM child 품목과 대조하고, 불일치/누락 시 `BadRequestException`을 던진다. 검증은 auto-issue 단위 테스트 13건, job-material-lot+auto-issue 17건, backend tsc 통과.
- `T-CUSTOMER-INTRO-PPTX-EXPORT`: 고객 소개 HTML 23장 기준으로 `docs/presentation/hanes-mes-introduction.pptx`를 편집 가능한 PPTX로 재생성 완료. 제목/본문/절차 박스/메뉴 표/캡션/하단 문구는 PowerPoint 텍스트·도형 객체이며, 실제 화면 캡처와 회사 배경 이미지는 이미지 객체다. 검증은 PPTX 패키지 슬라이드 23장, 미디어 25개, 빈 미디어 0개, PowerPoint PNG 렌더 23장 및 대표 슬라이드 시각 확인.
- `T-QUALITY-INSPECT-USEMEMO`: `/quality/inspect` 외관검사 화면의 `useMemo is not defined` 런타임 오류 수정 완료. 원인은 통계 카드 제거 과정에서 React import의 `useMemo`가 같이 빠졌지만 DataGrid `columns` 정의는 계속 `useMemo`를 사용한 것. `useMemo` import만 복원했고 `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false` 통과, 같은 누락 패턴 추가 검색 결과 없음.
- `T-DATA-CLEAN-HNS02`: JSHANES HNS02 BOM 기준 데이터 클린징 완료. `BOM_MASTERS.BOM_GRP='HNS02'` parent/child 합산 47개 기준으로 `ITEM_MASTERS=47`, `BOM_MASTERS=47`만 유지. 입하/입고/IQC/자재입출고/재고/제품재고/제품실적/작업지시/창고입고/검사의뢰/품질검사/시뮬레이션 데이터 제거 완료. 최종 검증 결과 비-HNS02 `ITEM_CODE` 잔여 없음, 요청 업무 테이블 잔여 없음.
- `T-INV-TRANSACTION-CARDS`: `/inventory/transaction` 재고수불현황 상단 정보카드 3개 제거 완료. `StatCard` 렌더링과 카드 전용 통계 상태/계산/import만 제거했고 그리드 조회·필터·MAT UID 검색·내보내기는 유지했다. `inventory/transaction` 잔여 참조 검색과 diff check 통과, URL HTTP 200 확인. frontend typecheck는 1차 통과 후 최종 재실행에서 다른 변경 파일 `quality/inspect/page.tsx`의 `useMemo` import 누락/implicit any 오류로 실패했다. 기존 `next lint` 스크립트는 ESLint 설정 프롬프트로 실패하고 `browse.exe`는 자체 서버 시작 타임아웃으로 DOM 검증을 못 했다.
- `T-MAT-LOT-IQC-UID-SEPARATE`: JSHANES에서 `MAT_LOTS`와 `IQC_LOGS`가 같은 `MAT_UID`를 공유하던 시드성 LOT를 분리했다. IQC 이력은 `VH1-RM...` 그대로 두고 재고/LOT 쪽 `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`만 `MLT-RM...`으로 변경했다. 검증 결과 `MAT_LOT_IQC_OVERLAP=0`, 파일 재실행 성공.
- `T-IQC-SAMPLE-REMOVE`: IQC 검사구분에서 `SAMPLE` 제거 완료. `IQC_GROUPS.INSPECT_METHOD`와 `ITEM_MASTERS.INSPECT_METHOD`는 `FULL/SKIP`만 쓰고, JSHANES 공통코드 `IQC_INSPECT_METHOD/SAMPLE`은 비활성화했다. 기존 `IQC_GROUPS` SAMPLE 4건은 FULL로 정규화. `IQC_LOGS.INSPECT_CLASS`는 별도/legacy 이력 컬럼이라 기존 SAMPLE 10건은 그대로 두고, 신규 수입검사 입력에서 검사구분 값을 inspectClass로 보내지 않도록 끊었다. 구조 테스트 7건, FE/BE tsc, IqcGroupService 테스트, DB 검증 통과.
- `T-IQC-METHOD-LABELS`: IQC 검사/무검사 구분 표시를 통일했다. `IQC_INSPECT_METHOD` 공통코드는 코드값은 유지하고 JSHANES 표시를 `FULL=검사`, `SAMPLE=검사`, `SKIP=무검사`로 적용했다. 품목정보, IQC 검사그룹, 수입검사 목록/입력, 검사이력 범위 라벨은 `검사구분`으로 맞췄고 ko/en/zh/vi locale 및 fallback 문자열을 갱신했다. 구조 테스트 5건, frontend typecheck, JSHANES 조회 통과.
- `T-IQC-CODE-ALIGN`: IQC 검사방법/검사유형 코드 매핑 통일 완료. 원인은 `FULL/SAMPLE/SKIP`가 필요한 IQC 검사방법이 일반 `INSPECT_METHOD`(VISUAL/MEASUREMENT 등)와 이름만 공유하고, IQC 이력 `INITIAL/RETEST`가 `IQC_TYPE`(IQC/PQC/FQC/OQC)으로 표시된 것. `IQC_INSPECT_METHOD`, `IQC_INSPECT_TYPE` 공통코드를 JSHANES에 추가하고 품목정보/IQC 검사그룹/수입검사/검사입력/IQC 이력 화면을 전용 그룹으로 변경했다. 검사입력 legacy `NONE`은 `SKIP`으로 정규화. 구조 테스트, FE/BE tsc, DB 코드 확인, ERD 문서 재생성 완료.
- `T-PROCESS-EQUIP-SEED`: 공정별 설비 마스터/공정-설비 매핑 시드를 추가하고 JSHANES에 적용했다. `apps/backend/src/migrations/2026-06-11_process_equipment_seed.sql`은 활성 공정 21개 기준으로 WIRE/TERMINAL/INSPECTION은 2대, ASSEMBLY/HEAT/미분류는 1대씩 `EQ-<PROCESS_CODE>-NN` 설비를 생성한다. 실DB 검증 결과 `EQUIP_MASTERS` 시드 36건, `PROCESS_EQUIPMENTS` 시드 36건, 모든 활성 공정 21개에 시드 매핑 존재. 기존 이상 매핑은 삭제하지 않았다.
- `T-MENU-SHELF-LIFE-REINSPECT`: `MAT_SHELF_LIFE_REINSPECT`가 미배치 후 메뉴관리에서 사라지고 카테고리 이동이 실패하는 문제 수정. 원인은 `menuConfig.ts` leaf가 백엔드 `menu-code-validator.ts`에 누락된 것. 누락 leaf 7개를 validator에 추가하고 구조 테스트를 추가했다. JSHANES에는 유수명 3개 메뉴를 MATERIAL 카테고리로 복구하고 MANAGER 권한을 보강했다. `/menu-categories/tree`와 `/menu-category-items/move` 실측 성공.
- `T-FE-THEME-PRESET`: 상단 팔레트 아이콘에서 `default → custom → orchid` 순환 선택 가능하게 변경. Orchid 테마는 사용자가 제공한 OKLCH 토큰을 `data-color-theme="orchid"` preset으로 추가. dev 서버는 `http://localhost:3004`에서 응답 200 확인. `pnpm --filter @harness/frontend build`는 컴파일/타입 단계 통과 후 기존 누락 라우트 `PageNotFoundError`로 정적 생성 실패.
- `T-TAB-LIMIT-10`: 페이지 탭 제한 개수를 10개로 변경 완료. `MAX_TABS=10`, `MAX_ALIVE=10`으로 맞췄고 frontend typecheck 및 layout 구조 테스트 2건 통과.
- `T-CUSTOMER-INTRO-WORK-INSTRUCTION`: 고객용 제품 소개 자료를 다음에도 동일 기준으로 재생성할 수 있도록 작업지시 문서 작성 완료. 산출물은 `docs/presentation/hanes-mes-introduction-work-instruction.md`.
- `T-CUSTOMER-INTRO-HTML-DESIGN`: 고객 소개 HTML의 카드형 AI 느낌을 줄이기 위해 공통 CSS를 재정리했다. 흰 카드+상단 컬러바 문법을 제거하고 산화동/황동/스틸/세이지 계열의 공정 보드 스타일로 변경. 산출물은 `docs/presentation/hanes-mes-introduction.html`.
- `T-CUSTOMER-INTRO-HTML-V2`: 작업지시서 기준 고객 소개 HTML을 22장 가로형 슬라이드로 재구성 완료. 산출물은 `docs/presentation/hanes-mes-introduction.html`. 정적 검증 결과 슬라이드 22장, 이미지 56개, 누락 0개. 이번 단계에서는 PPTX를 생성하지 않았다.
- `T-CUSTOMER-INTRO-MENU-SCREEN-DECK`: 현재 메뉴 화면 캡처 기반 고객용 제품 소개 자료 확장 완료. 산출물은 `docs/presentation/hanes-mes-introduction.pptx`, `docs/presentation/hanes-mes-introduction.html`, 캡처는 `docs/presentation/assets/menu-captures/*`. PPTX 15장/미디어 47개/빈 미디어 0개, HTML 15장/이미지 누락 0개, 레이아웃 오류 0개 확인.
- `T-CUSTOMER-INTRO-PRODUCT-DECK`: 기존 구성안 느낌의 자료를 고객용 제품 소개 자료로 전면 재작성 완료. 산출물은 `docs/presentation/hanes-mes-introduction.html`, `docs/presentation/hanes-mes-introduction.pptx`. PPTX 10장/미디어 7개/빈 미디어 0개, HTML 10장/이미지 누락 0개 확인.
- `T-CUSTOMER-INTRO-PPTX`: 고객 소개용 HANES MES 가로형 PowerPoint 문서 생성 완료. 산출물은 `docs/presentation/hanes-mes-introduction.pptx`. 12장, 미디어 9개, 빈 미디어 0개, 레이아웃 오류 0개 확인.
- `T-CUSTOMER-INTRO-HTML-REV`: 고객 소개 HTML 자료를 12장 워크플로우형으로 보강 완료. 글자 크기 축소, 메뉴 노출 확대, 워크플로우 순서 재구성, overflow 검증 완료.
- `T-CUSTOMER-INTRO-HTML`: 고객 소개용 HANES MES 가로형 HTML 자료 생성 완료. 산출물은 `docs/presentation/hanes-mes-introduction.html`, 화면 캡처는 `docs/presentation/assets/*.png`.
- .ai-coordination 작업추적 문서 초기화 완료.

## Next AI Should

1. Read `AGENTS.md`.
2. Read `.ai-coordination/README.md`, `STATE.md`, `TASKS.md`, `DECISIONS.md`, and `LOCKS.md`.
3. Read `PROTOCOL.md` for conflicts, stale locks, broad changes, DB changes, or review handoff.
4. Claim files in `LOCKS.md` before editing.
5. Keep `TASKS.md` active-work-only.
6. Update `JOURNAL.md` and its own handoff file before stopping.

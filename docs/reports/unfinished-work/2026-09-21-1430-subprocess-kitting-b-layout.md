# 미완료 작업 기록: 실적입력(서브공정) 키팅 B 배치 시안

- 작성시각: 2026-09-21 14:30 KST
- 작성자: claude
- 작업 범위: `/production/subprocess-kitting-b` 신규 라우트 + A안 컨트롤러 훅 분리 + 메뉴 등록
- 현재 상태: 검증대기 (ko 렌더 확인 완료 / en·zh·vi 렌더 미확인, 설비정지 추가 여부 사용자 대기)

## 완료한 것

- **A안 로직 분리**: `subprocess-kitting/page.tsx` 770줄 → 배치 전용 246줄 + `hooks/useSubprocessKittingController.ts` 599줄.
  원본 라인을 그대로 옮겨 동작을 바꾸지 않았다. `input-kiosk` 가 2026-09-20 에 밟은 것과 같은 방식이다.
- **B안 신규 라우트**: `subprocess-kitting-b/` — page.tsx + 배치 컴포넌트 4개
  (`KitContextBar`, `KitReferencePanels`, `KitWorkStepper`, `KitMetricsStrip`, `KitResultEntry`).
  `input-kiosk-b` 의 4영역 구성(컨텍스트 띠 / 좌 작업지도서+참조 / 우 작업순서 스테퍼 / 하단 지표 띠)을 키팅 도메인에 매핑.
  스캔 패널·액션바·라벨 출력 호스트는 A안 컴포넌트를 import 재사용한다. B 파일은 배치 껍데기만 갖는다.
- **메뉴 등록 4곳**: `menuConfig.ts`, backend `menu-code-validator.ts`, `seeds/menu-config.json`,
  locale 4종(`menu.production.kittingB`).
- **DB 적용**: `JSHANES` 에 `MENU_CATEGORY_ITEMS` 1건(`PROD_KITTING_B`, PRODUCTION, SORT_ORDER=51).
  pre-check 0건 → post-check 1건, 재실행 멱등 확인(CNT 유지 1).
  마이그레이션 파일: `apps/backend/src/migrations/2026-09-21_subprocess_kitting_b_menu.sql`
- **i18n 누락 11키 보강**: B안 t() 키 전수 추출 → ko.json 대조 → 4개 locale 동시 삽입. BOM 없음 확인.
- **구조 테스트 회귀 수정 2건** (아래 `주의사항` 참고).

## 미완료 / 남은 것

- **en/zh/vi 로케일 렌더 확인을 하지 못했다.** ko 는 사용자가 확인했다(그 과정에서 ④단계 배치
  깨짐이 나와 고쳤다 — 구조 테스트도 typecheck 도 못 잡는 종류였다). B안 t() 는 전부 한국어 fallback 을 달고 있어
  키가 빠져도 ko 에서는 정상으로 보인다(이번에 11키가 실제로 빠져 있었다).
- A안/B안 채택 결정은 사용자 몫이다. 채택 시 A안 배치를 B 구성으로 바꾸고 `-b` 라우트와
  `PROD_KITTING_B` 메뉴(코드 4곳 + DB 1행)를 정리한다.

## 변경 파일

신규:
- `apps/frontend/src/app/(authenticated)/production/subprocess-kitting/hooks/useSubprocessKittingController.ts`
- `apps/frontend/src/app/(authenticated)/production/subprocess-kitting-b/page.tsx`
- `apps/frontend/src/app/(authenticated)/production/subprocess-kitting-b/components/{KitContextBar,KitReferencePanels,KitWorkStepper,KitMetricsStrip,KitResultEntry}.tsx`
- `apps/backend/src/migrations/2026-09-21_subprocess_kitting_b_menu.sql`

수정:
- `apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx` (배치 전용으로 축소)
- `apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.structure.test.mjs`
- `apps/frontend/src/app/(authenticated)/production/input-kiosk/shared-worker-slot.structure.test.mjs`
- `apps/frontend/src/config/menuConfig.ts`
- `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`
- `apps/backend/src/seeds/menu-config.json`
- `apps/frontend/src/locales/{ko,en,zh,vi}.json`

## 검증 상태

| 항목 | 결과 |
| --- | --- |
| frontend typecheck | 통과 (exit 0) |
| backend typecheck | 통과 (exit 0) |
| `subprocess-kitting/page.structure.test.mjs` | 20/20 통과 |
| `input-kiosk/shared-worker-slot.structure.test.mjs` | 2/2 통과 |
| 프론트 구조 테스트 전수 | 실패 10건 — **전부 기존 실패**. HEAD(3311009e) worktree 에서 동일 10건이 동일 개수로 실패함을 대조 확인. 이번 작업으로 인한 회귀 0건 |
| DB 적용 | pre 0 → post 1, 멱등 재실행 확인 |
| i18n 4-locale 키 감사 | 45키 × 4 locale 누락 0, BOM 없음 |
| 화면 렌더 (ko) | 사용자가 확인 — 메뉴 노출 OK, ④단계 배치 깨짐 발견·수정 완료 |
| **화면 렌더 (en/zh/vi)** | **미실행** |

## 중단 사유

검증 자체가 막힌 것은 아니다. 백엔드(3003)가 사용자 터미널에서 내려가 있었고,
dev 서버는 사용자가 watch 출력을 봐야 하므로 이쪽에서 띄우지 않았다.

## 다음 작업자가 바로 할 일

1. `pnpm dev:restart` 로 3002/3003 기동
2. `/production/subprocess-kitting` (A안) 열어 **기존과 동일하게 동작하는지** 확인 —
   설비 선택 → 작업지시 복원 → 자재 스캔 → SFG 스캔 → 키팅 실행 → 실물 확정
3. `/production/subprocess-kitting-b` 열어 4영역 배치 확인
4. 로케일을 en 또는 vi 로 바꿔 B안을 다시 열어 **한국어가 새어나오는 곳이 없는지** 확인

## 이번 세션에서 실제로 고친 것 (화면 확인 후)

- **④단계 글자가 세로로 찌그러지고 빈 공간이 생김** — A안 `SubKitActionBar` 의 `lg:flex-row` 는
  뷰포트 기준이라 440px 열 안에서도 가로로 펴진다. `flex-1 min-w-0` 안내문이 한 글자 폭이 되고
  그 높이가 행을 밀어올렸다. 좁은 열 전용 세로형 `KitResultEntry.tsx` 를 새로 만들어 붙였다.
  **A안 `SubKitActionBar` 는 무변경** — 동작·API·호출 함수는 동일하고 배치만 다르다.
  발행 전(판정+발행)과 발행 후(발행번호+실물 스캔+취소)를 한 화면에 같이 두지 않고 갈랐다.

## 사용자 대기 중인 결정

- **설비정지 · 관리자호출을 키팅 화면에 넣을지.** 현재 A안·B안 모두 없다(원래 없었다).
  `useEquipStop` / `EquipActionButtons` / `ManagerCallModal` 은 실적입력(가공) A·B 와
  통전·단자검사(`inspection/result`, 커밋 b1f883a4)에만 있다.
  넣는다면 `inspection/result` 선례대로:
  ① 공용 훅에 `useEquipStop` 추가(→ A·B 동시 적용) ② 정지 중 `canIssue` 차단 + 배너
  ③ B안은 하단 지표 띠 우측에 `EquipActionButtons` ④ 서버 `issue-sg-label`/`confirm-subkit` 정지 게이트(백엔드 변경)
  ①~③(프론트만)과 ④까지 중 어디까지 할지 미정.

## 주의사항

- **훅 분리 시 소스 정규식 테스트가 같이 깨진다.** 이번에 2건이 걸렸다.
  `subprocess-kitting/page.structure.test.mjs` 는 예상했지만,
  `input-kiosk/shared-worker-slot.structure.test.mjs` 는 다른 디렉터리에 있어 놓칠 뻔했다
  (`useEquipWorkers(` 단언이 훅으로 이동). 둘 다 `page.tsx + 훅` 합본을 읽도록 고쳤다 —
  `input-kiosk` 가 2026-09-20 에 쓴 것과 같은 패턴이다. 단언 자체는 하나도 약화시키지 않았다.
  앞으로 다른 화면에서 같은 분리를 할 때도 **그 page.tsx 를 읽는 테스트를 전수 grep** 할 것.
- **A안/B안은 같은 localStorage 키(`SUBKIT_SELECTED_EQUIP_KEY`)와 같은 `useKioskStore` 를 공유한다.**
  설비 선택이 두 라우트 간에 이어지고, B안에서도 `persistCurrentJobOrder` 가 서버 설비 상태를 실제로 갱신한다.
  시안 비교 목적상 의도된 동작이다. 두 라우트를 동시에 열어두지 말 것.
- **`ROLE_MENU_PERMISSIONS` 행은 일부러 만들지 않았다.** A안 `PROD_KITTING` 에도 권한 행이 없다
  (2026-09-21 실측: `MENU_CATEGORY_ITEMS` 166건 중 49건이 권한 행 없음).
  B안이 A안과 같은 사용자에게 보여야 비교가 되므로 A안 상태를 그대로 따랐다.
  A안에 권한을 부여하게 되면 B안에도 같이 부여해야 한다.
- **B안 회로 선택은 공용 `Select` 대신 네이티브 `<select>` 를 쓴다.** 어두운 컨텍스트 띠 위 스타일링
  때문이다. 회로는 기준정보성 값이므로 AGENTS.md §6 관점에서 의도적 이탈이며, 채택 검토 시 함께 판단할 항목이다.
  옵션 자체는 A안과 같은 `circuitOptions` 를 쓴다.

## 재개 절차

1. `git log --oneline -3` 으로 HEAD 확인
2. 위 `변경 파일` 목록을 현재 HEAD 에서 다시 읽는다 (이 기록의 내용을 현재 상태로 가정하지 않는다)
3. `pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false` 로 출발점이 깨끗한지 확인
4. `다음 작업자가 바로 할 일` 4단계 수행

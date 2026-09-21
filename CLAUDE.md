@AGENTS.md

# CLAUDE.md - HANES Claude Code 보조 지침

공통 프로젝트 규칙은 위 `AGENTS.md`가 단일 출처다. 이 문서는 **Claude Code에만 해당하는 내용**만 담는다. 두 문서가 충돌하면 `AGENTS.md`를 우선한다.

공통 규칙(작업 시작 절차, coordination 문서 운영, 패키지 매니저·포트·빌드, DB와 마이그레이션, 코드/UI 규칙, 검증, 리뷰, 미완료 기록, Windows 도구, 과거 실수 기록)을 여기에 다시 적지 않는다. 추가하거나 고칠 일이 생기면 `AGENTS.md`를 고친다.

## 1. Claude 전용 협업 규칙

- coordination이 켜져 있을 때 `LOCKS.md`에는 `owner: claude` 또는 실제 세션 이름으로 기록한다.
- 세션 종료 전 `.ai-coordination/HANDOFF/claude.md`를 갱신한다.
- 협업 문서 변경과 기능 변경은 가능하면 별도 커밋으로 분리한다.

## 2. Claude 전용 검증 명령

`AGENTS.md` 7절의 typecheck 명령 대신 아래 축약형을 써도 된다. 결과는 동일하다.

```powershell
pnpm.cmd run typecheck:frontend
pnpm.cmd run typecheck:backend
```

## 3. DB 접속 설정의 단일 출처

- DB 접속 설정의 단일 출처는 `apps/backend/.env`(`.env.local` 우선)다.
- 앱·마이그레이션 CLI·시드는 `src/database/oracle-env.ts`를 쓴다.
- 파이썬 스크립트·ERD 생성기는 `tools/hanes_db.py`를 쓴다.
- 새 스크립트에 접속값이나 사이트명을 직접 박지 않는다.

## 4. TypeScript 스타일

- `catch (error: unknown)` 형태를 유지한다.
- `as any` 사용을 피한다. (백엔드 eslint의 `no-explicit-any`는 off라서 기계적으로 강제되지 않는다.)

## 5. 브라우저 자동화

- 브라우저 자동화는 **`aside`를 기본으로 사용한다.** 사용자의 기존 브라우저 세션에 붙어 HANES 로그인 상태를 유지한 채 화면을 조작·캡처할 수 있다.
- `mcp__aside__repl`이 기본이다. Playwright API + `page`, `snapshot(page)`, `listBrowserTabs()`, `attachBrowserTab(targetId)`를 쓴다.
  - 열려 있는 HANES 탭을 찾을 때는 `listBrowserTabs()` → `attachBrowserTab(targetId)` 순서로 붙는다. 새 탭을 함부로 열지 않는다.
  - `page.waitForTimeout()`은 이 환경에 없다. `await new Promise(r => setTimeout(r, ms))`를 쓴다.
  - REPL은 단일 영속 스코프다. 호출마다 **변수명을 새로 짓는다**(같은 이름 재선언 시 에러).
- 탐색·다단계 조작을 맡길 때는 `mcp__aside__exec`를 쓴다.
- `claude-in-chrome`은 쓰지 않는다. `chrome-devtools`는 lighthouse 감사, heap snapshot, 정밀 퍼포먼스 트레이스 등 `aside`에 없는 devtools 전용 기능이 필요할 때만 예외적으로 사용한다.

## 6. 프론트 신규 라우트 추가 시

이 프로젝트는 탭 유지(`TabKeepAlive`)를 위해 Next 라우터 대신 `history.pushState` + 생성된 레지스트리로 페이지를 찾는다.

- `app/(authenticated)/**/page.tsx`를 새로 만들면 `apps/frontend/src/components/layout/pageRegistry.generated.ts`에 등록돼야 한다.
- 등록이 빠지면 **URL과 탭은 바뀌는데 본문이 직전 화면 그대로 남는다.** 에러도 안 난다.
- `predev`/`prebuild`에 걸려 있어 dev 서버를 재시작하면 자동 생성된다. dev 서버를 띄운 채 라우트를 추가했다면 직접 실행한다.

```powershell
node apps/frontend/scripts/gen-page-registry.mjs
```

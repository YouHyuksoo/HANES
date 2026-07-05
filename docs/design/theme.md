---
sources:
  - apps/frontend/src/app/globals.css
  - docs/standards/theme-system-spec.md
verifiedCommit: 90ecd475
---

# 테마/토큰 디자인 규칙

`apps/frontend/src/app/globals.css`를 단일 출처로 실측했다. 별도의 `tailwind.config.*` 파일은 존재하지 않는다 —
이 프로젝트는 **Tailwind CSS v4 CSS-first 설정**(`@import "tailwindcss"`, `@theme inline`)을 쓰며 색상 토큰은 전부 CSS 변수로 정의된다.

## 규칙
| 항목 | 규칙 | 근거 |
|---|---|---|
| 색상 정의 방식 | 색상은 hex/rgb 리터럴이 아니라 `oklch(L C H)` 형식으로 `:root`/`.dark`에 정의해야 한다 | `globals.css` L53-71 등 전 색상 변수가 `oklch(...)` |
| 다크모드 전환 | 다크모드는 `.dark` 클래스 토글 방식이며 `@custom-variant dark (&:where(.dark, .dark *))`로 등록한다. `prefers-color-scheme` 미디어쿼리를 컴포넌트에서 직접 쓰지 않는다 | `globals.css` L32 |
| 컬러 테마 전환 | 브랜드 컬러(핑크 `--primary`) 외 커스텀 팔레트는 `[data-color-theme="custom"]`/`[data-color-theme="orchid"]` 속성 선택자로 오버라이드해야 한다. 페이지별 인라인 색상 오버라이드를 금지한다 | `globals.css` L235-385, `docs/standards/theme-system-spec.md` |
| 의미 기반 토큰 우선 | 컴포넌트는 `bg-primary`, `bg-surface`, `bg-background`, `text-text`, `text-text-muted`, `border-border` 같은 의미 토큰을 우선 사용해야 하고, `bg-[#xxxxxx]` 같은 임의값을 남발해서는 안 된다 | `docs/standards/theme-system-spec.md`(토큰 규칙) |
| 동적 배지 클래스 | DB(`COM_CODES.ATTR1`)에 저장된 Tailwind 클래스 문자열(예: `bg-green-100 text-green-700`)을 그대로 className으로 쓰는 컴포넌트는 반드시 `globals.css`의 `@source inline(...)` safelist에 해당 색상 범위가 포함돼 있어야 한다. 새 색상을 추가하면 safelist도 함께 갱신해야 한다 | `globals.css` L34-45 |
| 파스텔 셰이드 배제 | safelist는 `{100,200,300,600,700,800,900}` 셰이드만 포함하고 `-50`은 명시적으로 제외돼 있다. 배지/카드 색상에 `-50` 셰이드를 추가해서는 안 된다 | `globals.css` L44 |
| 폰트 역할 분리 | `--font-sans`(Outfit, 기본 UI 텍스트), `--font-mono`(Fira Code, 코드/ID/수치), `.font-data`(Inter 계열, 그리드 데이터)로 역할을 분리해야 한다 | `globals.css` L91-93, L644-647 |
| 반경/그림자 토큰 | 카드/버튼/입력의 모서리는 `--radius`(0.5rem 기준) 파생값(`--radius-sm`~`--radius-4xl`)만 사용하고, 임의 `rounded-[Npx]`를 남발하지 않는다 | `globals.css` L96, L456-463 |

## 사용 컴포넌트/토큰
- 전역 스타일 진입점: `apps/frontend/src/app/globals.css`
- 라이트 모드 기본 토큰: `--background #f6f7f8 계열`, `--card #ffffff`, `--text #111418 계열`(oklch 값은 파일 참조)
- 다크 모드 기본 토큰: `--background #101922 계열`, `--card #1a2632 계열`, `--text #e0e6ed 계열`
- 상태 색상: `--success:#22c55e`, `--warning:#f59e0b`, `--error:#ef4444`, `--info:#3b82f6`
- 호환용 별칭 변수: `--text`, `--text-muted`, `--text-secondary`, `--surface`, `--surface-hover`, `--card-hover`, `--primary-hover`, `--border-hover` — 기존 코드 호환을 위해 유지되므로 신규 컴포넌트도 이 별칭을 사용해도 된다
- 폼 요소 다크모드: `select`, `input[type=date|time|datetime-local|number]`, `textarea`에 `color-scheme: light|dark`를 명시(`globals.css` L523-539)
- 관련 표준 문서: `docs/standards/theme-system-spec.md`(저장 store, provider 적용 흐름 — `themeStore.ts`, `providers.tsx`)

## 금지 (안티패턴)
- 컴포넌트 내부에 hex 색상 리터럴을 직접 하드코딩하는 방식(의미 토큰 우회).
- `tailwind.config.js/ts` 파일을 새로 만들어 이중 설정을 추가하는 방식 — 이 프로젝트는 CSS-first 단일 출처를 쓴다.
- 다크모드 여부를 페이지별 `document.documentElement.classList` 직접 조작으로 처리하는 방식(`theme-system-spec.md` 금지 규칙과 동일).
- 배지/카드 색상에 safelist에 없는 임의 Tailwind 클래스 문자열을 DB(ATTR1)에 저장하는 방식 — JIT purge로 색이 사라진다.

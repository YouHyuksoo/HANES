# 도움말(Help) 시스템 설계

- 작성일: 2026-06-21
- 상태: 승인됨 (설계)
- 관련 화면: 전체 (1차 콘텐츠 시작점: `/quality/aql`)

## 1. 목적과 배경

현재 시스템에는 **필드 단위 도움말(`HelpTooltip`)**만 존재하고, 화면/시스템 단위 도움말 체계가 없다. 사용자와 운영자가 각 화면의 목적·사용법·운영 절차를 참조할 수 있는 도움말 시스템을 구축한다.

요구사항:

1. 각 페이지에서 "지금 이 화면"의 도움말을 바로 열 수 있다.
2. 전체 목차부터 자세한 사용법·기능설명·시스템 목적까지 훑는 전체 도움말이 있다.
3. **사용자 도움말**과 **시스템 운영자 도움말** 두 종류를 제공한다.
4. 도움말 콘텐츠는 **별도 파일**로 분리해 나중에 (비개발자도) 수정 가능해야 한다.
5. 먼저 **틀(아키텍처)**을 만들고, 콘텐츠는 요청 시 화면별로 하나씩 채운다.

## 2. 핵심 설계 결정 (확정)

| 항목 | 결정 | 이유 |
|---|---|---|
| 콘텐츠 포맷 | **Markdown(.md) + 런타임 렌더** | 빌드 없이 파일만 교체해도 즉시 반영. 비개발자 수정 용이. 이미지/표/코드/링크 기본 지원 |
| 렌더러 | `react-markdown` + `remark-gfm` (+ `rehype-raw`) | GFM 표/체크박스, 이미지 width 등 제한적 인라인 HTML 허용 |
| 진입 구조 | **하이브리드** | 페이지 도움말 = 슬라이드 패널(작업 흐름 유지), 전체 도움말 = `/help` 라우트(목차·검색·넓은 화면) |
| 버튼 위치 | **전역 Header 버튼 1개** | 모든 페이지(AQL 포함) 자동 커버, 현재 경로 자동 인식, 한 번만 구현 |
| 사용자/운영자 | **단순 탭 구분(권한 무관)** | 누구나 두 탭 모두 열람. 구현 단순 |
| 다국어 | 1차 **ko 단일**, 경로에 lang 자리 확보 | 장문 도움말 4언어 동시 유지 부담 회피, 추후 확장 가능 |

## 3. 콘텐츠 저장 구조

위치: `apps/frontend/public/help/`

```
apps/frontend/public/help/
  manifest.json            # 전체 목차·카테고리·순서·제목 정의 (목차/검색 소스)
  user/
    QC_AQL.md              # 사용자 도움말 — 메뉴코드 기준 파일명
    MST_PART.md
    ...
  operator/
    QC_AQL.md              # 운영자 도움말
    ...
  images/
    aql-overview.png       # 도움말 이미지 (MD에서 /help/images/... 로 참조)
```

- `public/` 하위라 정적 자산으로 서빙되며, 파일 교체 시 빌드 없이 즉시 반영(런타임 fetch).
- 파일명 키는 **메뉴코드(`MENU_CODE`)** (예: `QC_AQL`). 경로(`/quality/aql`)가 바뀌어도 코드가 안정적.
- 향후 다국어 확장 시 `user/{lang}/QC_AQL.md` 형태로 한 단계 추가 (fetch 경로에 lang 자리 확보).

### manifest.json 스키마(초안)

```json
{
  "version": 1,
  "categories": [
    {
      "key": "quality",
      "title": "품질관리",
      "items": [
        { "menuCode": "QC_AQL", "title": "AQL 기준관리", "path": "/quality/aql" }
      ]
    }
  ]
}
```

- 목차/검색은 manifest를 소스로 한다. `menuConfig`와 별개로 두어 도움말 전용 그룹·순서·표시 제목을 자유롭게 관리한다.
- 특정 항목에 실제 .md 파일이 아직 없어도 manifest에 등재 가능 → 목차에는 보이되 본문은 "준비중" fallback.

## 4. 페이지 ↔ 도움말 매핑

1. 현재 경로 → `findMenuCodeByPath(pathname)` → `MENU_CODE`
2. `/help/{user|operator}/{MENU_CODE}.md` fetch
3. 매핑 실패(메뉴코드 없음) 또는 파일 없음(404) → **fallback**: "이 화면의 도움말은 준비 중입니다" + "전체 도움말 보기" 링크
4. fallback 덕분에 콘텐츠가 비어 있어도 시스템은 먼저 동작한다(틀 우선 구축 가능).

## 5. 진입점 (하이브리드)

### 5.1 페이지 도움말 — 슬라이드 패널
- 전역 `Header`에 도움말(`?`/`HelpCircle`) 버튼 1개.
- 클릭 → 우측 슬라이드 패널(`HelpPanel`):
  - 상단 `[사용자 / 운영자]` 탭
  - 본문: 현재 페이지 `MENU_CODE`의 선택 탭 .md 렌더
  - 하단: "전체 도움말 보기" → `/help` 이동
- 패널은 현재 화면 위에 오버레이되어 작업 흐름을 끊지 않는다.

### 5.2 전체 도움말 — `/help` 라우트
- `app/(authenticated)/help/page.tsx`
- 레이아웃: 좌측 목차 트리(manifest 기반) + 우측 본문
- 상단 `[사용자 / 운영자]` 탭, 제목/내용 검색 입력
- 목차 항목 클릭 → 해당 `MENU_CODE` .md 본문 렌더

## 6. 컴포넌트 구조

| 단위 | 책임 | 의존 |
|---|---|---|
| `HelpButton` | Header에 배치, 패널 열기 토글 | help 상태 |
| `HelpPanel` | 우측 슬라이드 패널, 현재 페이지 도움말, 탭 | `useHelpDoc`, `MarkdownRenderer`, `usePathname` |
| `MarkdownRenderer` | react-markdown 래퍼. 표·코드·이미지(width)·링크 스타일 통일 | react-markdown, remark-gfm, rehype-raw |
| `useHelpDoc(menuCode, tab)` | `.md` fetch + 로딩/404 fallback 상태 반환 | fetch |
| `useHelpManifest()` | `manifest.json` fetch (목차/검색 소스) | fetch |
| `help/page.tsx` | 전체 목차 페이지(목차 트리 + 본문 + 탭 + 검색) | `useHelpManifest`, `useHelpDoc`, `MarkdownRenderer` |
| help 상태 (경량 store 또는 상위 상태) | 패널 open 여부, 활성 탭(user/operator) | — |

설계 원칙: `MarkdownRenderer`와 `useHelpDoc`은 패널과 전체 페이지 양쪽에서 **공유**한다. 도움말 렌더/조회 로직은 한 곳에만 둔다.

## 7. 콘텐츠 템플릿 (화면별로 한 개씩 채울 표준 틀)

### 7.1 사용자용 (`user/{MENU_CODE}.md`)
```markdown
# {화면명}

## 화면 목적
이 화면이 무엇을 위한 것인지 한두 문장.

## 주요 기능
- 기능 1
- 기능 2

## 사용 순서
1. 단계 1
2. 단계 2

## 입력 항목 설명
| 항목 | 설명 |
|------|------|

## 자주 묻는 질문
- Q. ... / A. ...

## 관련 화면
- [관련 화면명](경로 또는 메뉴코드)
```

### 7.2 운영자용 (`operator/{MENU_CODE}.md`)
```markdown
# {화면명} — 운영 가이드

## 시스템 목적·역할
이 기능이 전체 시스템에서 차지하는 역할.

## 사전 설정 (마스터·공통코드)
선행되어야 하는 마스터/코드/권한.

## 운영 절차
정상 운영 시 절차와 점검 포인트.

## 권한
이 화면을 사용/관리하는 권한 구분.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|

## 데이터·연계
관련 테이블, 연계 화면/배치/외부 연동.
```

## 8. 이번 1차 구현 범위

- **틀 구축**: 의존성 설치(react-markdown/remark-gfm/rehype-raw), `MarkdownRenderer`, `useHelpDoc`, `useHelpManifest`, `HelpButton`(Header 연동), `HelpPanel`, `/help` 라우트, `manifest.json` 골격, 콘텐츠 템플릿.
- **예시 콘텐츠**: `QC_AQL`의 사용자/운영자 .md 1세트만 시작점으로 작성(틀 검증용).
- **i18n**: 도움말 버튼 라벨/탭/패널 UI 문자열은 ko/en/zh/vi 4개 언어 추가(콘텐츠 본문은 ko).
- **나머지 화면 콘텐츠**: 이후 사용자가 요청할 때 화면별로 하나씩 작성.

## 9. 범위 밖 (YAGNI)

- 권한별 도움말 게이팅(운영자 탭 숨김) — 단순 탭 구분으로 결정됨.
- 도움말 콘텐츠 4언어 동시 작성 — 1차 ko 단일.
- 도움말 편집 UI(앱 내에서 .md 편집) — 파일 직접 수정으로 충분.
- MDX/인터랙티브 컴포넌트 삽입 — 런타임 수정 목표와 충돌.

## 10. 검증 기준

- Header 도움말 버튼 클릭 시 현재 화면 도움말 패널이 열린다.
- 콘텐츠 없는 화면에서 fallback("준비중" + 전체 도움말 링크)이 표시된다.
- `/help`에서 목차·탭·검색이 동작하고 항목 선택 시 본문이 렌더된다.
- `public/help/`의 .md 파일을 교체하면 (빌드 없이) 새로고침만으로 반영된다.
- `tsc --noEmit` 통과, i18n 4파일 키 정합.

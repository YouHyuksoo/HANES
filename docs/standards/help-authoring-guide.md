---
sources:
  - apps/frontend/src/config/menuConfig.ts
  - apps/frontend/src/hooks/useHelpDoc.ts
verifiedCommit: 2e8d7f56
---

# 도움말(Help) 콘텐츠 작성 가이드

- 대상: 화면 도움말을 작성·수정하는 사람(운영자, 기획, AI 세션)
- 시스템 설계 근거: `../specs/2026-06-21-help-system-design.md`
- 모범 예시: `apps/frontend/public/help/user/QC_AQL.md`, `apps/frontend/public/help/operator/QC_AQL.md`
- 작성 템플릿: `apps/frontend/public/help/_templates/user.md`, `operator.md`

이 문서는 **모든 화면의 도움말을 동일한 형태로** 만들기 위한 규칙과 스펙이다. 새 화면 도움말은 반드시 이 가이드를 따른다.

---

## 1. 저장 위치 · 파일명 규칙

```
apps/frontend/public/help/
  manifest.json              # 전체 목차(카테고리/순서) — 항목 등재 필수
  user/
    ko/{MENU_CODE}.md        # 사용자 도움말 (한국어)
    en/{MENU_CODE}.md        # 사용자 도움말 (영어)
    zh/{MENU_CODE}.md        # 사용자 도움말 (중국어)
    vi/{MENU_CODE}.md        # 사용자 도움말 (베트남어)
  operator/
    ko/{MENU_CODE}.md        # 운영자 도움말 (한국어)
    en/{MENU_CODE}.md        # 운영자 도움말 (영어)
    zh/{MENU_CODE}.md        # 운영자 도움말 (중국어)
    vi/{MENU_CODE}.md        # 운영자 도움말 (베트남어)
  images/{MENU_CODE}-*.png   # 도움말 이미지
  _templates/                # 작성 템플릿(참조용, 화면 도움말 아님)
```

- 파일명 키는 **메뉴코드(`MENU_CODE`)**다. 경로가 아니라 코드로 식별한다(경로가 바뀌어도 안정적).
- 메뉴코드 확인: `apps/frontend/src/config/menuConfig.ts`에서 해당 화면의 `code`. 예) `/quality/aql` → `QC_AQL`, `/master/part` → `MST_PART`.
- `public/` 하위라 **빌드 없이** 파일만 교체/추가하면 새로고침으로 즉시 반영된다.
- 사용자용·운영자용은 **항상 한 쌍**으로 만든다(둘 중 하나만 있으면 다른 탭은 "준비 중" fallback).

## 2. frontmatter 스펙 (필수)

모든 `.md`는 **1번째 줄부터** `---` 블록으로 시작한다. (앞에 빈 줄·BOM 금지 — 파서가 `^---`를 요구)

```yaml
---
menuCode: QC_AQL            # 필수. 파일명과 동일한 메뉴코드
audience: user              # 필수. user | operator (파일이 든 폴더와 일치)
title: AQL 기준관리          # 필수. 화면 제목
summary: 한 줄 요약          # 권장. 목차·검색·AI 컨텍스트에 사용
tags: [품질, IQC, AQL]      # 권장. 분류 태그(인라인 배열)
keywords: [합격품질한계, Ac, Re, 샘플수]  # 권장. 동의어·검색어(인라인 배열)
related: [MST_PART]         # 선택. 관련 화면 메뉴코드(인라인 배열)
---
```

형식 규칙:
- 배열은 **인라인 형식** `[a, b, c]`만 지원한다(`- item` 여러 줄 형식 미지원 — 자체 경량 파서 `parseHelpDoc` 기준).
- 값에 콜론·대괄호·콤마가 들어가면 따옴표로 감싼다.
- **UTF-8 BOM 절대 금지**(JSON·MD 공통). 첫 글자는 `-`여야 한다.
- `audience`는 폴더(`user`/`operator`)와 반드시 일치시킨다.

### keywords 작성 규칙 (AI 활용 핵심)
- 화면/컬럼의 **공식 용어 + 사용자가 다르게 부르는 표현 + 약어**를 모두 넣는다. 예: AQL이면 `합격품질한계, Major, Minor, Ac, Re, 샘플수, 치명결함`.
- 향후 AI 도움말 어시스턴트가 이 keywords로 관련 문서를 검색·인용한다. **검색에 걸리길 원하는 모든 말**을 넣는 것이 목적이다.

## 3. 본문 표준 구조

### 3.1 사용자용 (`user/{MENU_CODE}.md`)
순서대로 작성한다(해당 없으면 생략 가능).

1. `# {화면명}`
2. `## 화면 목적` — 무엇을 위한 화면인지 1~3문장
3. `## 화면 구성` — 영역(좌/우/탭 등) 구조. 복잡한 화면일수록 권장
4. (개념이 있으면) 관계도 — 코드블록 다이어그램
5. `## ① {블록명} 컬럼` … — **모든 컬럼**을 표로(아래 4장 규칙)
6. `## 버튼별 기능` — 화면에 보이는 버튼·아이콘·모달 버튼을 전부 표로 설명
7. `## 업무 흐름` — 실제 작업자가 누르는 순서대로 번호 단계
8. `## 입력 규칙 / 검증` — 저장 차단 조건 등
9. `## 자주 묻는 질문`
10. `## 관련 화면` — `[화면명](/경로)` 링크

### 3.2 운영자용 (`operator/{MENU_CODE}.md`)

1. `# {화면명} — 운영 가이드`
2. `## 시스템 목적·역할` — 전체 시스템에서의 위치
3. `## 데이터 구조` — 테이블 계층/관계도(코드블록)
4. `## ① {블록명} — {TABLE_NAME} (전체 컬럼)` … — **화면항목 ↔ DB컬럼 ↔ 의미·운영포인트** 표
5. `## 버튼·API·상태 전이` — 버튼/액션, 호출 API, 허용 상태, 결과 상태, DB 부수효과
6. `## {판정/계산} 로직` — 해당 시 동작 순서
7. `## 사전 설정 (마스터·공통코드)`
8. `## 운영 절차`
9. `## 권한`
10. `## 문제 해결 (트러블슈팅)` — 증상/원인/조치 표
11. `## 데이터·연계` — 테이블, 연계 화면, 멀티테넌시 스코프

### 3.3 생성 전 소스 확인 규칙

AI나 스크립트가 도움말을 생성할 때는 템플릿 추정으로 쓰지 말고, 아래 소스를 먼저 확인한다.

1. 메뉴 경로와 메뉴코드: `apps/frontend/src/config/menuConfig.ts`
2. 화면 엔트리: `page.tsx` 또는 route 컴포넌트
3. 분리된 컬럼 파일: `*Columns.tsx`, `columns.tsx`, DataGrid column factory
4. 폼/모달/패널 컴포넌트: `components/` 하위 파일
5. 액션 핸들러와 API 호출: `onClick`, `handle*`, `api.get/post/put/delete`, fetch 함수
6. 실제 화면 라벨: `t("...")` 키와 `apps/frontend/src/locales/ko.json` fallback 문구
7. 상태 전이와 업무 순서: service/controller, workflow 문서, 시나리오 QA 결과 중 현재 코드와 맞는 근거

생성 결과에는 최소한 다음이 들어가야 한다.

- 실제 조회 조건과 기본 필터. 임의의 `기간, 상태, 품목, 바코드, 담당자` 같은 범용 문구 금지.
- 화면에 보이는 모든 버튼·아이콘·모달 버튼의 기능, 활성 조건, 실행 후 결과.
- 작업자가 실제로 수행하는 업무 흐름. 조회 화면이면 조회 흐름, 처리 화면이면 생성/스캔/확정/취소/재오픈 같은 처리 흐름.
- 운영자용에는 각 버튼이 호출하는 API, 상태 전이, 주요 테이블 변경을 표로 연결한다.
- 소스에서 확인하지 못한 항목은 일반론으로 채우지 말고 `확인 필요`로 표시하거나 생성 범위에서 제외한다.

## 4. 컬럼/필드 작성 규칙 (가장 중요)

- **그 화면의 모든 컬럼·입력 필드를 빠짐없이** 표로 설명한다. 그리드 컬럼, 폼 필드, 하위 테이블(rules 등) 모두 포함.
- 처리 화면은 컬럼·입력 필드뿐 아니라 **버튼·아이콘·모달 액션**도 빠짐없이 설명한다. 버튼 설명은 `버튼`, `언제 사용`, `동작`, `결과/주의`를 포함한다.
- 각 컬럼은 **이름 + 역할(무엇) + 의미(왜 그렇게 동작)**까지 쓴다. "코드입니다" 수준 금지.
  - 나쁨: `AQL 값: AQL 값입니다.`
  - 좋음: `AQL 값: 합격품질한계 수치(0.65/1.0/2.5 등). 작을수록 엄격하며, 샘플수와 결합해 Ac/Re를 결정.`
- 사용자용 표 헤더: `| 컬럼 | 역할 / 의미 |`
- 운영자용 표 헤더: `| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |`
- 컬럼명은 `**한글명(코드명)**` 형태로 병기한다. 예: `**정책 코드(policyCode)**`.
- 코드값이 있는 필드는 의미를 풀어 쓴다. 예: `criticalMode: IMMEDIATE_FAIL = 치명결함 1건이라도 즉시 불합격`.
- 멀티테넌시 컬럼(`COMPANY`, `PLANT_CD`)은 운영자용에 스코프로 명시한다.

## 5. 표현·스타일

- 용어는 공통코드/도메인 용어를 그대로 쓰고, 처음 등장 시 풀이를 붙인다(예: `AQL(합격품질한계)`).
- 핵심 주의/정의는 `>` 인용으로 강조한다.
- 표·번호목록·코드블록(다이어그램/예시)을 적극 사용한다(MarkdownRenderer가 GFM 표·코드 지원).
- 예시를 넣는다(예: `n=13, Ac=1, Re=2 → 불량 1개까지 합격`).
- 화면 라벨은 실제 UI 문구와 일치시킨다.

## 6. 이미지

- 위치: `apps/frontend/public/help/images/`, 파일명 `{MENU_CODE}-{설명}.png`.
- 본문 참조: `![설명](/help/images/QC_AQL-overview.png)`.
- 크기 제어가 필요하면 제한적으로 `<img src="/help/images/..." width="480" />`(rehype-raw 허용).

## 7. manifest 등재 (목차 노출)

`apps/frontend/public/help/manifest.json`에 항목을 추가해야 `/help` 목차·검색에 나온다.

```json
{
  "version": 1,
  "categories": [
    { "key": "quality", "title": "품질관리",
      "items": [ { "menuCode": "QC_AQL", "title": "AQL 기준관리", "path": "/quality/aql" } ] }
  ]
}
```
- 카테고리 `key`/`title`은 메뉴 대분류를 따른다(품질관리/기준정보/생산 등).
- `.md`가 아직 없어도 등재 가능(목차엔 보이고 본문은 "준비 중").

## 8. 다국어 정책

- 도움말 파일은 언어별 서브폴더(`ko/`, `en/`, `zh/`, `vi/`)로 나누어 관리한다.
- 현재 **ko만 실제 작성**되어 있으며, `en/zh/vi`는 빈 상태로 존재한다.
- `useHelpDoc` 훅이 현재 언어로 fetch하고, 해당 언어 파일이 없으면 자동으로 `ko`로 fallback한다. (fallback 시 사용자에게 언어 전환 안내는 하지 않음 — 콘텐츠가 없으면 "준비 중" 표시)
- 도움말 **UI 라벨**(버튼/탭/검색)은 `help.*` i18n 키로 4개 언어(co/ko/en/zh/vi) 이미 관리 중이다.
- 신규 다국어 파일 작성 시 `{lang}/{MENU_CODE}.md` 경로에 저장하고, `manifest.json`은 변경할 필요가 없다(menuCode 기반이라 언어와 무관).
- 다국어 작성 체크리스트:
  1. [ ] `ko/`의 원본 파일을 기준으로 번역
  2. [ ] `en/{MENU_CODE}.md`에 영문 frontmatter + 본문 저장
  3. [ ] frontmatter의 `title`/`summary`/`tags`/`keywords`도 해당 언어로 번역
  4. [ ] `zh/`, `vi/` 동일하게 진행
  5. [ ] dev 서버에서 언어 전환 후 도움말이 정상 표시되는지 확인

## 9. 새 화면 도움말 추가 절차 (체크리스트)

1. [ ] `menuConfig.ts`에서 화면의 `MENU_CODE` 확인
2. [ ] 화면 소스에서 컬럼, 입력 필드, 버튼, 모달, 액션 핸들러, API 호출을 확인
3. [ ] `public/help/user/{MENU_CODE}.md` 작성 (frontmatter + 3.1 구조 + 전체 컬럼 + 버튼별 기능 + 업무 흐름)
4. [ ] `public/help/operator/{MENU_CODE}.md` 작성 (frontmatter + 3.2 구조 + DB 매핑 + 버튼/API/상태 전이)
5. [ ] 필요 시 이미지 `public/help/images/` 추가
6. [ ] `manifest.json`에 항목 등재(카테고리/title/path)
7. [ ] frontmatter 검증: 1번째 줄 `---`, BOM 없음, `audience`=폴더, 인라인 배열
8. [ ] dev 서버에서 `?` 패널 + `/help` 목차로 표시 확인(빌드 불필요)

## 10. 검증 기준

- frontmatter가 `parseHelpDoc`로 파싱되고 본문이 정상 렌더된다(BOM/형식 오류 없음).
- 화면의 모든 컬럼이 도움말에 포함된다(누락 0).
- 처리 화면의 모든 버튼·모달 액션이 도움말에 포함된다(누락 0).
- 사용자용은 실제 작업 순서를 따라갈 수 있어야 한다. 범용 템플릿 문구나 실제 화면에 없는 컬럼명으로 채우면 실패다.
- 운영자용은 버튼/API/상태 전이/테이블 부수효과를 연결해야 한다.
- manifest 등재로 `/help` 목차·검색에 노출된다.
- 사용자/운영자 두 탭 모두 내용이 있다.

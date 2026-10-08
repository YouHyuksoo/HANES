---
name: reverse-deliverables
description: 완성된 HANES MES 코드·문서에서 SI 프로젝트 산출물(요구사항 정의서, 개발 설계서, 시험 운영 결과 보고서, 사용자 매뉴얼, 전산 운영자 매뉴얼)을 추적번호로 연결해 HTML로 역산 생성한다. "산출물 만들어", "요구사항 정의서/설계서/시험결과보고서/매뉴얼 역으로 작성", "산출물 갱신", "전달용으로 묶어줘" 요청에 사용한다. 소스코드 문서와 테스트 실행은 포함하지 않는다.
---

# 역산 산출물 생성 (HANES MES)

2026-10-08에 처음 만든 방식을 재사용한다. 메뉴·DB·업무 로직 문서를 읽어 5종 HTML과 목록 페이지를 만든다.

## 산출물과 추적번호

| 문서 | 파일 | 번호 | 추적번호 |
|---|---|---|---|
| 요구사항 정의서 | 01-requirements.html | HNS-MES-RQ-001 | REQ-모듈-NNN, NFR-NN |
| 개발 설계서 | 02-design.html | HNS-MES-DS-001 | FUN, SCR, TBL-모듈-NN |
| 시험 운영 결과 보고서 | 03-trial-report.html | HNS-MES-TR-001 | TST-모듈-001 |
| 사용자 매뉴얼 | 04-user-manual.html | HNS-MES-UM-001 | MUS-모듈 |
| 전산 운영자 매뉴얼 | 05-operator-manual.html | HNS-MES-OM-001 | - |
| 목록 | index.html | HNS-MES-IX-001 | 전체 매트릭스 |

연결: `REQ-MAT-005 → FUN-MAT-005 → SCR-MAT-005 → TBL-MAT-xx → TST-MAT-001 → MUS-MAT`. REQ=FUN=SCR은 같은 번호(메뉴 1개당 1건)이고, 번호는 클릭 가능한 문서 간 링크다. 출력은 `docs/reports/deliverables/`(docs/README.md의 reports 규정에 맞는 위치)다.

## 실행 순서

```
python3 .claude/skills/reverse-deliverables/scripts/extract.py   # data.json 추출 (임시폴더 /tmp/hanes_deliverables)
python3 .claude/skills/reverse-deliverables/scripts/build12.py   # 01, 02 문서
python3 .claude/skills/reverse-deliverables/scripts/build345.py  # 03, 04, 05 문서와 index
python3 .claude/skills/reverse-deliverables/scripts/pack.py      # 전달용 zip + Artifact 메인 페이지
```

환경변수: `HANES_ROOT`(저장소 루트, 기본 git 루트), `HD_WORK`(임시 데이터 폴더), `HD_OUT`(출력 폴더).

데이터 원천: `menuConfig.ts`와 `locales/ko.json`(화면·경로·메뉴코드), `docs/business-logics/*.md`(화면 목적), `docs/database/table-catalog.md`(테이블), `docs/workflows/definitions/*.md`(업무 흐름·문제 해결), `ecosystem.config.js`와 `AGENTS.md`(운영 규칙).

## 다시 쓸 때 반드시 갱신할 것

스크립트가 자동으로 새로 읽는 것은 화면·테이블 수와 목록뿐이다. 아래는 build 파일 안에 사람이 쓴 내용이라 현재 상태에 맞게 고쳐야 한다.

1. **시험 운영 결과 보고서의 시험 회차(RND)와 모듈별 결과(MR)** — `build345.py`. `docs/reports/`와 `docs/reports/unfinished-work/`의 새 보고서를 읽어 회차·결과·잔여 항목을 추가한다.
2. **운영자 매뉴얼의 포트·설정 키 표** — `ecosystem.config.js`(운영 프론트 3100, 개발 3002, 백엔드 3003)와 SYS_CONFIGS 현재 값을 확인해 반영한다.
3. **모듈 약어·설명(MODS)과 테이블→모듈 분류 규칙(TRULES)** — `lib.py`. 새 메뉴 그룹이나 테이블 접두어가 생기면 추가한다. 분류되지 않은 테이블은 기준정보(MST)로 간다.
4. **비기능 요구사항(NFR)** — `build12.py`. 규칙이 바뀌면 AGENTS.md와 맞춘다.

## 지켜야 할 규칙 (사용자 지시)

- 소스코드 문서는 만들지 않는다. 테스트도 새로 실행하지 않는다. 저장소에 이미 있는 보고서의 결과만 인용한다.
- 시험 운영 결과 보고서는 빈칸을 두지 않는다. 기록에 없는 값(참여 인원, 서명, 일수 등)은 만들지 않고, 모듈별로 근거 회차와 자동화 시험 파일 수를 서술한다. 미해결 항목은 "후속 조치/관리 중"으로 그대로 적는다. 보고서 안에 "작성 근거 안내" 박스를 유지한다.
- 코드 자체를 대화에 보여 달라는 요청이 없으면 소스를 길게 제시하지 않는다.
- 문서 형식은 HTML이다. docx/PDF가 필요하다고 하면 HTML을 변환한다(pandoc, LibreOffice).
- `.claude/` 아래 graft 자동 갱신 파일(graft-hooks.cjs, graft-statusline.cjs, settings.json, .mcp.json)은 커밋하지 않는다.

## 전달 방법

- **zip**: `pack.py`가 만든 `HANES_MES_deliverables.zip`을 `SendUserFile`로 전달한다. 같은 폴더에 두고 `index.html`을 열면 된다(외부 의존 없음).
- **Artifact**: `pack.py`가 만든 `page.html`을 메인 페이지로, 나머지 5개 HTML을 `files`로 발행한다(`files`에 index.html을 넣으면 거부되므로 메인 페이지가 곧 index다). 먼저 `Artifact quickstart`를 호출한다. Artifact는 기본 비공개이므로 공유는 사용자가 Share 메뉴에서 한다.
- 파일 전송 도구의 `render`는 화면에 뜨는지 확인할 수 없다. 사용자가 보지 못했다고 하면 Artifact나 zip으로 안내한다.

## 알려진 한계

- 화면 설명은 `business-logics` 문서의 목적을 쓴다. 문서가 없거나 목적이 없는 화면은 "○○ 업무의 △△ 처리"라는 일반 문구가 들어간다(2026-10 기준 189개 중 48개).
- 요구사항 우선순위(상/중)는 핵심 업무 흐름 소속 여부로 정한 값이다.
- git 이력이 얕은 클론에서는 커밋 수·기간 같은 값을 쓰지 않는다.

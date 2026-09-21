# apps/frontend/src/hooks - 보조 지침

이 디렉터리 아래 파일을 다룰 때만 로드된다. 공통 규칙은 리포지토리 루트 `AGENTS.md`가 단일 출처다.

같은 디렉터리의 `AGENTS.md`와 내용이 동일하다. Claude Code는 이 파일을, 그 외 에이전트는 `AGENTS.md`를 읽는다. **한쪽만 고치지 말고 두 파일을 같이 고친다.**

## jsPDF + autotable 한글 폰트 (2026-06-17 기록)

- `html2canvas`는 Tailwind CSS `lab()` 색상 함수 파싱 실패로 사용하지 않는다.
- jsPDF + autotable 한글 출력은 TTF를 VFS에 넣고 `Identity-H` CID 인코딩으로 등록한다.
- autotable의 `styles.font`, `headStyles.font`, `bodyStyles.font`, `alternateRowStyles.font`, `didParseCell`에 같은 폰트를 지정한다.
- Regular 폰트만 등록했다면 `headStyles.fontStyle = "normal"`을 명시한다. 기본 bold fallback 때문에 헤더만 깨질 수 있다.
- 관련 파일: `apps/frontend/src/hooks/useExport.ts`, `public/fonts/NotoSansKR-*.ttf`

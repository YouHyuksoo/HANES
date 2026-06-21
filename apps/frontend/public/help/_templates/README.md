# 도움말 작성 템플릿

이 폴더의 `user.md` / `operator.md`는 화면 도움말 작성용 **템플릿**입니다(실제 도움말 아님).

새 화면 도움말을 만들 때는 **반드시 작성 가이드를 먼저 확인**하세요:

➡️ `docs/standards/help-authoring-guide.md`

요약:
- 파일: `public/help/user/{MENU_CODE}.md`, `public/help/operator/{MENU_CODE}.md`
- 1번째 줄부터 frontmatter `---` (BOM 금지, `audience`=폴더명, 배열은 `[a, b]` 인라인)
- 화면의 **모든 컬럼**을 역할·의미까지 표로 작성
- `manifest.json`에 항목 등재해야 `/help` 목차에 노출
- 모범 예시: `public/help/user/QC_AQL.md`, `public/help/operator/QC_AQL.md`

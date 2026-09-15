import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('.', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

test('page is a thin workspace composition root', () => {
  const source = read('page.tsx');
  assert.match(source, /useControlPlanWorkspace/);
  assert.match(source, /DocumentPackageList/);
  assert.match(source, /DocumentWorkspaceTabs/);
  assert.doesNotMatch(source, /api\.(get|post|put|delete)/);
  assert.ok(source.split('\n').length < 150);
});

test('API, state, actions and validation navigation are separated', () => {
  assert.match(read('controlPlanApi.ts'), /listPackages/);
  assert.match(read('useControlPlanWorkspace.ts'), /selectValidationIssue/);
  assert.match(read('components/ControlPlanWorkspaceHeader.tsx'), /자동 초안/);
  assert.match(read('components/DocumentPackageList.tsx'), /PFD/);
  assert.match(read('components/DocumentWorkspaceTabs.tsx'), /RevisionHistoryTab/);
  assert.match(read('controlPlanApi.ts'), /type === 'PFD'.*data\.rows/s);
  assert.match(read('components/RevisionHistoryTab.tsx'), /compareRevisions/);
  assert.match(read('components/RevisionHistoryTab.tsx'), /listEvents/);
  assert.match(read('components/DocumentWorkspaceTabs.tsx'), /RevisionReferenceSelector/);
  assert.match(read('components/RevisionReferenceSelector.tsx'), /참조 PFD Revision/);
});

test('A3 출력센터는 세로와 가로 문서 끝까지 스크롤할 수 있다', () => {
  const output = read('components/OutputCenterTab.tsx');
  const preview = read('components/ControlPlanDocumentPreview.tsx');
  assert.match(output, /h-full min-h-0[^"']*overflow-auto/);
  assert.match(preview, /overflow-scroll/);
  assert.match(preview, /scrollbar-gutter:stable_both-edges/);
});

test('낮은 화면에서도 편집폼 아래 문서표까지 세로 스크롤할 수 있다', () => {
  assert.match(read('components/DocumentWorkspaceTabs.tsx'), /flex-1 overflow-auto overscroll-contain/);
  assert.match(read('components/DocumentTable.tsx'), /min-h-48 flex-1 overflow-auto/);
});

test('문서 미리보기는 새 창 대신 출력센터 내부 영역을 교체한다', () => {
  const output = read('components/OutputCenterTab.tsx');
  assert.doesNotMatch(output, /window\.open/);
  assert.doesNotMatch(output, /previewUrl|<iframe/);
  assert.match(output, /setPreviewType\(type\)/);
  assert.match(output, /<QualityPlanDocumentPreview model=\{model\} type=\{previewType\}/);
});

test('문서 미리보기는 PDF와 분리된 동일 HTML 문서를 크게 볼 수 있다', () => {
  const preview = read('components/QualityPlanDocumentPreview.tsx');
  assert.match(preview, /미리보기 크게 보기/);
  assert.match(preview, /setIsExpanded\(true\)/);
  assert.match(preview, /<QualityPlanDocumentPreview model=\{model\} type=\{type\} expanded/);
  assert.match(preview, /\[&>div\]:!h-\[72vh\]/);
});

test('API 실패 시 서버 메시지를 표시하고 생성 모달을 유지한다', () => {
  assert.match(read('controlPlanApi.ts'), /getControlPlanErrorMessage/);
  assert.match(read('components/OutputCenterTab.tsx'), /getControlPlanErrorMessage/);
  assert.match(read('components/NewPackageModal.tsx'), /result !== undefined/);
  assert.match(read('components/RevisionCreateModal.tsx'), /result !== undefined/);
});

test('참조 Revision 변경 시 편집기를 초기화하고 구 Revision 행 저장을 막는다', () => {
  const tabs = read('components/DocumentWorkspaceTabs.tsx');
  assert.match(tabs, /key=\{`\$\{revision\.revisionId\}:\$\{revision\.refPfdRevisionId/);
  assert.match(read('components/PfmeaTab.tsx'), /pfdRows\.some/);
  assert.match(read('components/ControlPlanTab.tsx'), /pfmeaRows\.some/);
});

test('PFMEA 날짜 전용 값은 로컬 날짜 유틸로 편집폼에 복원한다', () => {
  const source = read('components/PfmeaTab.tsx');
  assert.match(source, /formatDateOnly\(row\.TARGET_DATE/);
  assert.match(source, /formatDateOnly\(row\.COMPLETION_DATE/);
  assert.doesNotMatch(source, /row\.(?:TARGET_DATE|COMPLETION_DATE).*slice\(0,\s*10\)/);
});

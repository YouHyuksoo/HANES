import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inspection/protocol/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inspection/protocol/protocolColumns.tsx', 'utf8');

test('/inspection/protocol extracts DataGrid columns into protocolColumns.tsx factory', () => {
  assert.match(columns, /export function createProtocolGridColumns\(/);
  assert.match(columns, /\}: CreateProtocolGridColumnsOptions\): ColumnDef<Protocol>\[\]/);
});

test('/inspection/protocol page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProtocolGridColumns \} from "\.\/protocolColumns"/);
  assert.match(page, /createProtocolGridColumns\(\{[\s\S]*onEditProtocol:[\s\S]*onDeleteProtocol:[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "protocolId"/);
});

test('/inspection/protocol exposes measurement valueIndex/valueUnit (계측기 수치 수신)', () => {
  const form = fs.readFileSync('apps/frontend/src/app/(authenticated)/inspection/protocol/components/ProtocolFormPanel.tsx', 'utf8');
  assert.match(form, /valueIndex: number \| null;/);
  assert.match(form, /valueUnit: string \| null;/);
  assert.match(form, /t\("inspection\.protocol\.valueIndex"\)/);
  assert.match(form, /t\("inspection\.protocol\.valueUnit"\)/);
  assert.match(form, /valueIndex: form\.valueIndex !== "" \? Number\(form\.valueIndex\) : null/);
  assert.match(columns, /accessorKey: "valueIndex"/);
});

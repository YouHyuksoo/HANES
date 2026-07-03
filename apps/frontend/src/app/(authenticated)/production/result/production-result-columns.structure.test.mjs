import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/result/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/result/productionResultColumns.tsx', 'utf8');

test('/production/result extracts DataGrid columns into productionResultColumns.tsx factory', () => {
  assert.match(columns, /export function createProductionResultGridColumns\(/);
  assert.match(columns, /\}: CreateProductionResultGridColumnsOptions\): ColumnDef<ProdResult>\[\]/);
});

test('/production/result action column is first and uses icon-only buttons', () => {
  assert.match(columns, /return \[\s*\{\s*id: 'actions'/);
  assert.match(columns, /import \{ Edit2, Trash2 \} from "lucide-react";/);
  assert.match(columns, /<Edit2 className="w-4 h-4 text-primary" \/>/);
  assert.match(columns, /<Trash2 className="w-4 h-4 text-red-500" \/>/);
  assert.match(columns, /className="p-1 hover:bg-surface rounded disabled:opacity-30/);
  assert.match(columns, /aria-label=\{t\('common\.edit'\)\}/);
  assert.match(columns, /aria-label=\{t\('common\.delete'\)\}/);
  assert.doesNotMatch(columns, /from "@\/components\/ui"[\s\S]*Button/);
});

test('/production/result shows a status badge column and locks actions for canceled/downstream-progressed rows', () => {
  assert.match(columns, /import StatusBadge from "@\/components\/shared\/StatusBadge";/);
  assert.match(columns, /accessorKey: 'status'[\s\S]*<StatusBadge codeType="PROD_RESULT_STATUS" value=\{getValue\(\) as string\} \/>/);
  assert.match(columns, /hasDownstreamProgress\?: boolean;/);
  assert.match(columns, /const locked = row\.original\.status === 'CANCELED' \|\| !!row\.original\.hasDownstreamProgress;/);
  assert.match(columns, /disabled=\{locked\}/);
});

test('/production/result shows production type as 시생산 or 양산', () => {
  assert.match(columns, /productionType: 'TRIAL' \| 'MASS' \| string;/);
  assert.match(columns, /accessorKey: 'productionType'/);
  assert.match(columns, /value === 'MASS' \? '양산' : '시생산'/);
});

test('/production/result page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProductionResultGridColumns, ProdResult \} from "\.\/productionResultColumns"|import \{ createProductionResultGridColumns, ProdResult \} from '\.\/productionResultColumns'/);
  assert.match(page, /createProductionResultGridColumns\(\{[\s\S]*onEditResult: openEdit[\s\S]*onDeleteResult: setDeleteTarget[\s\S]*\}\)/);
  assert.match(page, /enableColumnPinning defaultPinnedColumns=\{\{ left: \['actions'\] \}\}/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: 'resultNo'/);
});

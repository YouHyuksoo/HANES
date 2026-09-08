import test from 'node:test';
import assert from 'node:assert/strict';
import { createTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/react-table';
// @ts-ignore Node native TypeScript test entry.
import { sumGridValues } from './gridSummary.ts';
// @ts-ignore Node native TypeScript test entry.
import { numberRangeFilterFn } from './numberFilterFn.ts';
// @ts-ignore Node native TypeScript test entry.
import { dateRangeFilterFn } from './dateFilterFn.ts';
// @ts-ignore Node native TypeScript test entry.
import { textInFilterFn } from './textFilterFn.ts';

test('숫자/숫자 문자열과 취소 음수 합산, NULL/비수치 제외', () => {
  assert.equal(sumGridValues([10, '20', -5, null, undefined, 'bad', Infinity, true]), 25);
  assert.equal(sumGridValues([]), 0);
});

test('페이지가 바뀌어도 조회 합계 유지, 컬럼 필터 변경은 합계 반영', () => {
  const table = createTable({
    data: [{ item: 'A', qty: 10 }, { item: 'A', qty: 20 }, { item: 'B', qty: 99 }],
    columns: [{ accessorKey: 'item' }, { accessorKey: 'qty' }],
    state: { pagination: { pageIndex: 0, pageSize: 1 }, columnFilters: [] },
    onStateChange: () => {}, renderFallbackValue: null,
    filterFns: { numberRange: numberRangeFilterFn, dateRange: dateRangeFilterFn, textIn: textInFilterFn },
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(),
  });
  const total = () => sumGridValues(table.getFilteredRowModel().rows.map(row => row.getValue('qty')));
  assert.equal(table.getRowModel().rows.length, 1);
  assert.equal(total(), 129);
  table.setOptions(prev => ({ ...prev, state: { ...prev.state, pagination: { pageIndex: 1, pageSize: 1 } } }));
  assert.equal(total(), 129);
  table.setOptions(prev => ({ ...prev, state: { ...prev.state, columnFilters: [{ id: 'item', value: 'A' }] } }));
  assert.equal(total(), 30);
});

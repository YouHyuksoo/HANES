import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modalSource = readFileSync(new URL('./IqcModal.tsx', import.meta.url), 'utf8');

test('IQC modal uses expanded compact scanner-first layout', () => {
  assert.match(modalSource, /<Modal isOpen=\{isOpen\} onClose=\{onClose\} title=\{t\("material\.iqc\.modalTitle"\)\} size="full">/);
  assert.match(modalSource, /className="flex h-\[calc\(75vh-32px\)\] max-h-\[620px\] flex-col gap-2 overflow-hidden"/);
  assert.doesNotMatch(modalSource, /min-h-\[620px\]/);
  assert.match(modalSource, /className="grid min-h-0 flex-1 grid-cols-12 gap-2"/);
  assert.match(modalSource, /className="col-span-3 flex min-h-0 flex-col gap-2\.5 overflow-y-auto/);
  assert.match(modalSource, /className="relative"/);
  assert.match(modalSource, /className="h-9 w-full pl-8 pr-3 text-sm rounded-md/);
});

test('IQC modal keeps judge body visible without separate bottom form blocks', () => {
  assert.match(modalSource, /className="col-span-6 flex min-h-0 flex-col overflow-hidden rounded-lg border border-border"/);
  assert.match(modalSource, /className="grid min-h-0 flex-1 grid-cols-12 gap-2"/);
  assert.match(modalSource, /className="min-h-0 flex-1 overflow-y-auto"/);
  assert.match(modalSource, /className="px-3 py-1\.5 bg-surface border-t border-border flex items-center justify-between gap-2"/);
  assert.doesNotMatch(modalSource, /<div className="grid grid-cols-2 gap-4">/);
  assert.doesNotMatch(modalSource, /<div className="grid grid-cols-3 gap-4">/);
  assert.doesNotMatch(modalSource, /className="flex justify-end gap-2 pt-4 border-t border-border"/);
});

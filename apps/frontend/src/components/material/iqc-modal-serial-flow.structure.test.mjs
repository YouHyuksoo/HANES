import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modalSource = readFileSync(new URL('./IqcModal.tsx', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('../../hooks/material/useIqcData.ts', import.meta.url), 'utf8');

test('IQC modal is scanner-first and stores selected serial inspection details', () => {
  assert.match(modalSource, /serialScanInputRef/);
  assert.match(modalSource, /scannedSerials/);
  assert.match(modalSource, /selectedSerial/);
  assert.match(modalSource, /serialInspectionMap/);
  assert.match(modalSource, /handleSerialScan/);
  assert.match(modalSource, /scanSerialError/);
  assert.match(modalSource, /serialInspectionPayload/);
  assert.doesNotMatch(modalSource, /setAllSerials/);
});

test('IQC submit accepts structured serial details instead of only measurement rows', () => {
  assert.match(hookSource, /details\?: unknown/);
  assert.match(hookSource, /JSON\.stringify\(details\)/);
});

test('IQC modal records defect codes instead of direct severity count inputs', () => {
  assert.match(modalSource, /defectRows/);
  assert.match(modalSource, /useComCodeList\('DEFECT_TYPE'\)/);
  assert.match(modalSource, /defectCode/);
  assert.match(modalSource, /defectGrade/);
  assert.match(hookSource, /defects\?: Array<\{ defectCode: string; qty: number \}>/);
  assert.match(hookSource, /defects: extra\?\.defects/);

  assert.doesNotMatch(modalSource, /defectCritical/);
  assert.doesNotMatch(modalSource, /defectMajor/);
  assert.doesNotMatch(modalSource, /defectMinor/);
});

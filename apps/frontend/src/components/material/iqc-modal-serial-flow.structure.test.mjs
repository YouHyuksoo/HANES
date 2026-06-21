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
  assert.match(modalSource, /\/quality\/defect-codes\/options/);
  assert.doesNotMatch(modalSource, /useComCodeList\('DEFECT_TYPE'\)/);
  assert.match(modalSource, /defectCode/);
  assert.match(modalSource, /defectGrade/);
  assert.match(hookSource, /defects\?: Array<\{ defectCode: string; qty: number \}>/);
  assert.match(hookSource, /defects: extra\?\.defects/);

  assert.doesNotMatch(modalSource, /defectCritical/);
  assert.doesNotMatch(modalSource, /defectMajor/);
  assert.doesNotMatch(modalSource, /defectMinor/);
});

test('IQC modal aligns defect-code entry with actual failed inspection evidence', () => {
  assert.match(modalSource, /hasDefectCodeRows/);
  assert.match(modalSource, /needsDefectCode/);
  assert.match(modalSource, /hasContradictingDefectCodes/);
  assert.match(modalSource, /canSubmit[\s\S]*!needsDefectCode[\s\S]*hasDefectCodeRows/);
  assert.match(modalSource, /canSubmit[\s\S]*!hasContradictingDefectCodes/);
});

test('IQC modal does not send every scanned serial into 500-byte SAMPLE_BARCODE', () => {
  assert.match(modalSource, /function\s+buildSampleBarcode/);
  assert.match(modalSource, /MAX_SAMPLE_BARCODE_BYTES\s*=\s*500/);
  assert.match(modalSource, /sampleBarcode:\s*buildSampleBarcode\(scannedSerials\.map\(\(serial\)\s*=>\s*serial\.matUid\)\)/);
  assert.doesNotMatch(modalSource, /sampleBarcode:\s*scannedSerials\.join\(","\)/);
});

test('IQC modal allows repeated scans of the same material serial as separate samples', () => {
  assert.match(modalSource, /interface\s+ScannedSerialSample/);
  assert.match(modalSource, /scanKey:\s*string/);
  assert.match(modalSource, /matUid:\s*string/);
  assert.match(modalSource, /scanSequenceRef/);
  assert.match(modalSource, /setScannedSerials\(\(prev\)\s*=>\s*\[\.\.\.prev,\s*sample\]\)/);
  assert.match(modalSource, /serialInspectionMap\[sample\.scanKey\]/);
  assert.match(modalSource, /serialInspectionPayload[\s\S]*matUid:\s*sample\.matUid/);
  assert.doesNotMatch(modalSource, /prev\.includes\(matched\.matUid\)/);
});

import * as fs from 'fs';
import * as path from 'path';

const srcRoot = path.resolve(__dirname, '..');
const migrationsRoot = path.join(srcRoot, 'migrations');
const runtimeRoots = [path.join(srcRoot, 'modules'), path.join(srcRoot, 'shared')];

const historicalMigrationBaseline = new Set([
  '2026-05-26_create_log_sequences.sql',
  '2026-05-26_iqc005_daily_reset_jobs.sql',
  '2026-05-26_iqc005_serial_sequences.sql',
  '2026-06-08_box_no_daily_sequence.sql',
  '2026-06-11_seq_pallet_no_daily.sql',
]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function relative(filePath: string): string {
  return path.relative(srcRoot, filePath).replace(/\\/g, '/');
}

describe('numbering safety policy', () => {
  it('forbids runtime MAX+1 and last-number increment numbering', () => {
    const runtimeFiles = runtimeRoots
      .flatMap(walk)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));
    const offenders = runtimeFiles.flatMap((filePath) => {
      const source = read(filePath);
      const hasMaxLookup = /SELECT\s+(?:NVL\s*\(\s*)?MAX\s*\([^\r\n;]+\)/i.test(source);
      const hasLastNumberIncrement = /last(?:No|Id|Seq)[\s\S]{0,240}\+\s*1/i.test(source);
      return hasMaxLookup && hasLastNumberIncrement ? [relative(filePath)] : [];
    });

    expect(offenders).toEqual([]);
  });

  it('forbids new sequence reset and cycling migrations outside the frozen baseline', () => {
    const offenders = walk(migrationsRoot)
      .filter((filePath) => filePath.endsWith('.sql'))
      .filter((filePath) => !historicalMigrationBaseline.has(path.basename(filePath)))
      .filter((filePath) => /ALTER\s+SEQUENCE[\s\S]{0,120}\bRESTART\b|CREATE\s+SEQUENCE[\s\S]{0,500}\bCYCLE\b/i.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });
});

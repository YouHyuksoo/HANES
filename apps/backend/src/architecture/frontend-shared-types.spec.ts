import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const frontendSrcRoot = path.join(repoRoot, 'frontend', 'src');
const frontendTypesIndexPath = path.join(frontendSrcRoot, 'types', 'index.ts');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function relativeToFrontend(filePath: string): string {
  return path.relative(frontendSrcRoot, filePath).replace(/\\/g, '/');
}

describe('frontend shared type boundaries', () => {
  const frontendSourceFiles = walk(frontendSrcRoot).filter((filePath) => /\.(ts|tsx)$/.test(filePath));

  it('does not import from the legacy global @/types barrel', () => {
    const legacyBarrelImport = /from\s+['"]@\/types['"]/;
    const offenders = frontendSourceFiles
      .filter((filePath) => legacyBarrelImport.test(read(filePath)))
      .map(relativeToFrontend);

    expect(offenders).toEqual([]);
  });

  it('does not reintroduce broad domain model interfaces in src/types/index.ts', () => {
    const globalTypesSource = read(frontendTypesIndexPath);
    const broadDomainTypes = [
      'User',
      'ProductionResult',
      'MaterialLot',
      'InspectionResult',
      'DefectLog',
      'Equipment',
    ];

    const offenders = broadDomainTypes.filter((typeName) =>
      new RegExp(`export\\s+interface\\s+${typeName}\\b`).test(globalTypesSource),
    );

    expect(offenders).toEqual([]);
  });

  it('does not keep sample data placeholders in runtime frontend source', () => {
    const allowedPaths = new Set<string>();
    const placeholderPattern = /\b(mock|dummy|stub|fixture)\b|(?:mock|dummy|stub|fixture)[A-Z_]/;
    const runtimeFiles = frontendSourceFiles.filter((filePath) => {
      const relativePath = relativeToFrontend(filePath);
      return !allowedPaths.has(relativePath)
        && !/\.(spec|test)\.(ts|tsx)$/.test(relativePath)
        && !relativePath.includes('__tests__/');
    });

    const offenders = runtimeFiles
      .filter((filePath) => placeholderPattern.test(read(filePath)))
      .map(relativeToFrontend);

    expect(offenders).toEqual([]);
  });

  it('does not leave console.log debug output in runtime frontend source', () => {
    const runtimeFiles = frontendSourceFiles.filter((filePath) => {
      const relativePath = relativeToFrontend(filePath);
      return !/\.(spec|test)\.(ts|tsx)$/.test(relativePath)
        && !relativePath.includes('__tests__/');
    });

    const offenders = runtimeFiles
      .filter((filePath) => /\bconsole\.log\s*\(/.test(read(filePath)))
      .map(relativeToFrontend);

    expect(offenders).toEqual([]);
  });
});

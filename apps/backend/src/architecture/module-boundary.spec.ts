import * as fs from 'fs';
import * as path from 'path';

const srcRoot = path.resolve(__dirname, '..');
const modulesRoot = path.join(srcRoot, 'modules');
const sharedModulePath = path.join(srcRoot, 'shared', 'shared.module.ts');
const appModulePath = path.join(srcRoot, 'app.module.ts');
const aggregateModulePaths = [
  path.join(modulesRoot, 'quality', 'quality.module.ts'),
  path.join(modulesRoot, 'material', 'material.module.ts'),
];
const allowedDtoAnyFiles = new Set<string>();

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

function extractEntityColumnMappings(source: string): { table: string; column: string; property: string }[] {
  const mappings: { table: string; column: string; property: string }[] = [];
  const entityBlocks = source.split(/(?=@Entity\()/g);

  for (const block of entityBlocks) {
    const tableMatch = block.match(/@Entity\(\{\s*name:\s*'([^']+)'/);
    if (!tableMatch) continue;

    const table = tableMatch[1];
    const columnPattern = /@(PrimaryColumn|Column)\(([^)]*)\)\s*\r?\n\s*([A-Za-z_][A-Za-z0-9_]*)\??:/g;
    let columnMatch: RegExpExecArray | null;
    while ((columnMatch = columnPattern.exec(block)) !== null) {
      const args = columnMatch[2];
      const property = columnMatch[3];
      const dbColumn = args.match(/name:\s*'([^']+)'/)?.[1] ?? property;
      mappings.push({ table, column: dbColumn, property });
    }
  }

  return mappings;
}

function runtimeSourceFiles(): string[] {
  const roots = [
    path.join(srcRoot, 'common'),
    path.join(srcRoot, 'modules'),
    path.join(srcRoot, 'shared'),
    path.join(srcRoot, 'app.controller.ts'),
    path.join(srcRoot, 'app.service.ts'),
  ];

  return roots.flatMap((root) => {
    const stat = fs.statSync(root);
    return stat.isDirectory() ? walk(root) : [root];
  })
    .filter((filePath) => filePath.endsWith('.ts'))
    .filter((filePath) => !filePath.endsWith('.spec.ts'));
}

function extractPropertyArrayContents(source: string, propertyName: string): string[] {
  const contents: string[] = [];
  const propertyPattern = new RegExp(`${propertyName}:\\s*\\[`, 'g');
  let match: RegExpExecArray | null;
  while ((match = propertyPattern.exec(source)) !== null) {
    const arrayStart = source.indexOf('[', match.index);
    let depth = 0;
    for (let index = arrayStart; index < source.length; index += 1) {
      const char = source[index];
      if (char === '[') depth += 1;
      if (char === ']') depth -= 1;
      if (depth === 0) {
        contents.push(source.slice(arrayStart + 1, index));
        propertyPattern.lastIndex = index + 1;
        break;
      }
    }
  }
  return contents;
}

function extractArrayValues(source: string, propertyName: string): string[] {
  return extractPropertyArrayContents(source, propertyName).flatMap((content) =>
    [...content.matchAll(/\b[A-Z][A-Za-z0-9_]*\b/g)].map((match) => match[0]),
  );
}

function extractForFeatureEntities(moduleSource: string): string[] {
  const matches = moduleSource.matchAll(/TypeOrmModule\.forFeature\(\s*\[([\s\S]*?)\]\s*\)/g);
  return [...matches].flatMap((match) =>
    match[1]
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^[A-Z][A-Za-z0-9_]*$/.test(value)),
  );
}

describe('module repository boundaries', () => {
  const allSourceFiles = walk(modulesRoot).filter((filePath) => filePath.endsWith('.ts'));
  const moduleFiles = allSourceFiles.filter((filePath) => filePath.endsWith('.module.ts'));

  it('does not register User repositories in feature modules that do not inject User', () => {
    const offenders = moduleFiles
      .map((moduleFile) => {
        const moduleSource = read(moduleFile);
        const featureEntities = extractForFeatureEntities(moduleSource);
        if (!featureEntities.includes('User')) return null;

        const moduleDir = path.dirname(moduleFile);
        const moduleSources = allSourceFiles
          .filter((filePath) => filePath.startsWith(`${moduleDir}${path.sep}`))
          .filter((filePath) => !filePath.endsWith('.spec.ts'))
          .map(read)
          .join('\n');

        return /@InjectRepository\(\s*User\s*\)/.test(moduleSources)
          ? null
          : relative(moduleFile);
      })
      .filter(Boolean);

    expect(offenders).toEqual([]);
  });

  it('keeps shared guards out of feature module provider lists', () => {
    const guardNames = ['JwtAuthGuard', 'RolesGuard', 'InventoryFreezeGuard'];
    const offenders = moduleFiles
      .filter((moduleFile) => {
        const providers = extractArrayValues(read(moduleFile), 'providers');
        return guardNames.some((guardName) => providers.includes(guardName));
      })
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('keeps TransactionService provided through the global SharedModule', () => {
    const sharedModuleSource = read(sharedModulePath);
    const appModuleSource = read(appModulePath);

    expect(sharedModuleSource).toContain('@Global()');
    expect(extractArrayValues(sharedModuleSource, 'providers')).toContain('TransactionService');
    expect(extractArrayValues(sharedModuleSource, 'exports')).toContain('TransactionService');
    expect(extractArrayValues(appModuleSource, 'imports')).toContain('SharedModule');
  });

  it('does not provide TransactionService from feature modules', () => {
    const offenders = moduleFiles
      .filter((moduleFile) => extractArrayValues(read(moduleFile), 'providers').includes('TransactionService'))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('keeps manual QueryRunner transaction control inside TransactionService only', () => {
    const forbiddenPatterns = [
      /\bcreateQueryRunner\s*\(/,
      /\bstartTransaction\s*\(/,
      /\bcommitTransaction\s*\(/,
      /\brollbackTransaction\s*\(/,
    ];
    const allowedFiles = new Set([
      'shared/transaction.service.ts',
      'shared/transaction.service.spec.ts',
    ]);
    const allBackendSourceFiles = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts') || allowedFiles.has(relative(filePath)));

    const offenders = allBackendSourceFiles
      .filter((filePath) => !allowedFiles.has(relative(filePath)))
      .filter((filePath) => forbiddenPatterns.some((pattern) => pattern.test(read(filePath))))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('keeps direct oracledb driver usage inside Oracle infrastructure only', () => {
    const allowedFiles = new Set([
      'common/services/oracle.service.ts',
      'database/test-connection.ts',
      'database/migrate-postgres-to-oracle.ts',
    ]);
    const allBackendSourceFiles = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));

    const offenders = allBackendSourceFiles
      .filter((filePath) => !allowedFiles.has(relative(filePath)))
      .filter((filePath) => /(?:import[\s\S]*from\s+['"]oracledb['"]|require\(['"]oracledb['"]\))/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not import or provide OracleModule from feature modules', () => {
    const offenders = moduleFiles
      .filter((moduleFile) => {
        const source = read(moduleFile);
        return (
          extractArrayValues(source, 'imports').includes('OracleModule') ||
          extractArrayValues(source, 'providers').includes('OracleService')
        );
      })
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('keeps aggregate domain modules as thin submodule composition roots', () => {
    const offenders = aggregateModulePaths
      .map((moduleFile) => {
        const source = read(moduleFile);
        const hasRepositoryRegistrations = extractForFeatureEntities(source).length > 0;
        const hasControllers = extractArrayValues(source, 'controllers').length > 0;
        const hasProviders = extractArrayValues(source, 'providers').length > 0;
        return hasRepositoryRegistrations || hasControllers || hasProviders
          ? relative(moduleFile)
          : null;
      })
      .filter(Boolean);

    expect(offenders).toEqual([]);
  });

  it('does not add new dto as any update payload bypasses', () => {
    const allBackendSourceFiles = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));

    const offenders = allBackendSourceFiles
      .filter((filePath) => /dto\s+as\s+any/.test(read(filePath)))
      .map(relative)
      .filter((filePath) => !allowedDtoAnyFiles.has(filePath));

    expect(offenders).toEqual([]);
  });

  it('does not spread DTOs directly into repository update payloads', () => {
    const allBackendSourceFiles = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));

    const offenders = allBackendSourceFiles
      .filter((filePath) => /(?:const|let)\s+updateData:\s*any\s*=\s*\{\s*\.\.\.dto\s*\}/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not pass DTOs directly into repository updates', () => {
    const allBackendSourceFiles = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));

    const offenders = allBackendSourceFiles
      .filter((filePath) => {
        const source = read(filePath);
        return /(?:\b\w*(?:Repository|Repo)|\brepo)\.update\([\s\S]{0,240},\s*dto\s*\)/.test(source);
      })
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not use DTO rest destructuring as update payloads', () => {
    const allBackendSourceFiles = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));

    const offenders = allBackendSourceFiles
      .filter((filePath) => /const\s+\{[^}]*\.\.\.(?:updateData|rest|restDto)\s*\}\s*=\s*dto/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not map the same DB table column through multiple entity properties', () => {
    const entityFiles = walk(path.join(srcRoot, 'entities'))
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));

    const seen = new Map<string, string>();
    const offenders: string[] = [];

    for (const filePath of entityFiles) {
      for (const mapping of extractEntityColumnMappings(read(filePath))) {
        const key = `${mapping.table}.${mapping.column}`;
        const value = `${relative(filePath)}:${mapping.property}`;
        const existing = seen.get(key);
        if (existing && existing !== value) {
          offenders.push(`${key} -> ${existing}, ${value}`);
        } else {
          seen.set(key, value);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('does not use as any to reach unchecked runtime properties', () => {
    const allBackendSourceFiles = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));

    const offenders = allBackendSourceFiles
      .filter((filePath) => /\([^)]*\s+as\s+any\)\.[A-Za-z_]/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not type controller request body or request objects as any', () => {
    const offenders = runtimeSourceFiles()
      .filter((filePath) => /@Req\(\)\s+req:\s*any|@Body\(\)\s+\w+:\s*any|private\s+scope\(\s*req:\s*any/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not add new simple runtime any escape hatches', () => {
    const offenders = runtimeSourceFiles()
      .filter((filePath) => {
        const source = read(filePath);
        return /catch\s*\([^)]*:\s*any\)|queryRunner\?:\s*any|manager:\s*any|Promise<any>|map\(\([^)]*:\s*any\)|\b\w+:\s*any\[\]|Record<string,\s*any>/.test(source);
      })
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not add unsafe runtime type assertion escape hatches', () => {
    const offenders = runtimeSourceFiles()
      .filter((filePath) => /\bas unknown as\b|\bas never\b|\/\/\s*@ts-ignore|\/\/\s*@ts-expect-error|eslint-disable/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not trust JSON.parse result as a runtime record without validation', () => {
    const offenders = runtimeSourceFiles()
      .filter((filePath) => /JSON\.parse\([^\n]+\)\s+as\s+Record<string,\s*unknown>/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not cast request headers directly to string', () => {
    const offenders = runtimeSourceFiles()
      .filter((filePath) => /req\.headers\[[^\]]+\]\s+as\s+string/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not cast request objects to access authenticated user', () => {
    const offenders = runtimeSourceFiles()
      .filter((filePath) => /\([^)]*\s+as\s+[^)]*user[^)]*\)|\bas\s+AuthenticatedRequest\b|(?:req|request)\s+as\s+Request/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not cast caught errors to assumed runtime shapes', () => {
    const offenders = runtimeSourceFiles()
      .filter((filePath) => /\b(?:error|err|e)\s+as\s+(?:Error|\{)/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not cast repository or raw query results to domain entities', () => {
    const offenders = runtimeSourceFiles()
      .filter((filePath) => /\)\s+as\s+Promise<|saved\s*=\s*.*\s+as\s+[A-Z][A-Za-z0-9_]*|rows\s+as\s+[A-Z][A-Za-z0-9_]*\[\]/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not cast empty objects to runtime records', () => {
    const offenders = runtimeSourceFiles()
      .filter((filePath) => /(?:return|=)\s+\{\}\s+as\s+Record/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('does not read legacy user identity aliases from request user', () => {
    const allBackendSourceFiles = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));

    const offenders = allBackendSourceFiles
      .filter((filePath) => /(?:req\.user|user)\??\.(?:userId|userName|plantCd)\b/.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it('keeps test-only utilities out of runtime backend source folders', () => {
    const offenders = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'))
      .map(relative)
      .filter((filePath) => /(^|\/)(test|tests|test-utils|__mocks__)(\/|$)/.test(filePath));

    expect(offenders).toEqual([]);
  });

  it('does not keep mock placeholders in runtime backend source', () => {
    const placeholderPattern = /\b(mock|dummy|stub|fixture)\b|(?:mock|dummy|stub|fixture)[A-Z_]/;
    const allBackendRuntimeFiles = walk(srcRoot)
      .filter((filePath) => filePath.endsWith('.ts'))
      .filter((filePath) => !filePath.endsWith('.spec.ts'));

    const offenders = allBackendRuntimeFiles
      .filter((filePath) => placeholderPattern.test(read(filePath)))
      .map(relative);

    expect(offenders).toEqual([]);
  });
});

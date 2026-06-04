import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..', '..', '..');

const itemTypeSourceFiles = [
  'packages/shared/src/constants/com-code-values.ts',
  'apps/backend/src/modules/master/controllers/part.controller.ts',
  'apps/frontend/src/app/(authenticated)/master/bom/page.tsx',
  'apps/frontend/src/app/(authenticated)/inventory/product-hold/page.tsx',
  'apps/backend/src/database/create-hanes-schema.sql',
  'apps/backend/src/database/migrations/001-initial-schema.sql',
  'scripts/create_product_stocks.sql',
  'scripts/create_product_transactions.sql',
  'scripts/fix_product_tables_id.sql',
  'scripts/gen-business-process.js',
  'scripts/gen-code-definition.js',
  'scripts/gen-glossary.js',
  'scripts/verify-material-flow.py',
  'docs/standards/glossary.md',
];

describe('item type common code naming', () => {
  it('uses ITEM_TYPE instead of legacy PART_TYPE for 품목유형 runtime code', () => {
    const offenders = itemTypeSourceFiles.flatMap((relativePath) => {
      const source = readFileSync(join(repoRoot, relativePath), 'utf8');
      const legacyPatterns = [
        /PART_TYPE_VALUES/,
        /PartTypeValue/,
        /groupCode="PART_TYPE"/,
        /useComCodeOptions\("PART_TYPE"\)/,
        /\bPART_TYPE\b/,
      ];

      return legacyPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relativePath}: ${pattern.source}`);
    });

    expect(offenders).toEqual([]);
  });
});

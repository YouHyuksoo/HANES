import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const read = (relativePath) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const poFormPanel = read('apps/frontend/src/app/(authenticated)/material/po/components/PoFormPanel.tsx');
const partSearchModal = read('apps/frontend/src/components/shared/PartSearchModal.tsx');

test('PO enables bulk part selection from the part search modal', () => {
  assert.match(
    poFormPanel,
    /const handlePartSelectMany = useCallback\(\(parts: PartItem\[\]\) => \{/,
    'PO form should provide a bulk add handler',
  );

  assert.match(
    poFormPanel,
    /<PartSearchModal[\s\S]*?multiSelect[\s\S]*?onSelectMany=\{handlePartSelectMany\}[\s\S]*?itemType="RAW_MATERIAL"/,
    'PO form should opt into multi-select raw material search',
  );
});

test('PartSearchModal supports a larger multi-select picker with a bulk add action', () => {
  assert.match(
    partSearchModal,
    /multiSelect\?: boolean;/,
    'shared part search modal should expose opt-in multi-select mode',
  );

  assert.match(
    partSearchModal,
    /onSelectMany\?: \(parts: PartItem\[\]\) => void;/,
    'shared part search modal should expose a bulk select callback',
  );

  assert.match(
    partSearchModal,
    /const \[selectedItemCodes, setSelectedItemCodes\] = useState<Set<string>>\(\(\) => new Set\(\)\);/,
    'shared part search modal should track selected row keys',
  );

  assert.match(
    partSearchModal,
    /size=\{multiSelect \? "2xl" : "xl"\}/,
    'multi-select modal should open wider than the single-select modal',
  );

  assert.match(
    partSearchModal,
    /onClick=\{handleSelectMany\}[\s\S]*?selectedItemCodes\.size === 0[\s\S]*?선택 품목 추가/,
    'multi-select modal should render a disabled-aware bulk add button',
  );

  assert.match(
    partSearchModal,
    /maxHeight=\{multiSelect \? "560px" : "400px"\}/,
    'larger multi-select modal should give the grid more vertical room',
  );
});

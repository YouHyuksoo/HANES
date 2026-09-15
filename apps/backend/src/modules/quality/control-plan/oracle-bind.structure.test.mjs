import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const services = fileURLToPath(new URL('./services/', import.meta.url));

test('배열 바인딩 SQL은 자리표시자를 출현 순서대로 한 번씩 사용한다', () => {
  for (const file of readdirSync(services).filter((name) => name.endsWith('.service.ts'))) {
    const source = readFileSync(join(services, file), 'utf8');
    for (const match of source.matchAll(/`([\s\S]*?)`/g)) {
      const binds = [...match[1].matchAll(/:(\d+)/g)].map((token) => Number(token[1]));
      if (!binds.length) continue;
      assert.deepEqual(binds, Array.from({ length: binds.length }, (_, index) => index + 1), `${file}: positional bind mismatch`);
    }
  }
});

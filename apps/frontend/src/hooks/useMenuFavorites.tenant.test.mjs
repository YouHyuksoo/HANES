import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(new URL('../../package.json', import.meta.url));
const ts = require('typescript');
const { QueryClient, MutationObserver } = require(require.resolve('@tanstack/query-core', {
  paths: [dirname(require.resolve('@tanstack/react-query'))],
}));
const source = ts.transpileModule(fs.readFileSync(new URL('./useMenuFavorites.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

/** Execute the actual hook callbacks with the installed Query Core mutation lifecycle. */
function setup({ fail = false, loading = false, error = false } = {}) {
  const client = new QueryClient();
  const auth = { isAuthenticated: true, user: { email: 'review@example.com' }, selectedCompany: 'A', selectedPlant: 'P1' };
  const key = company => ['menu-favorites', 'me', auth.user.email, company, 'P1'];
  client.setQueryData(key('A'), { success: true, data: ['A-existing'] });
  client.setQueryData(key('B'), { success: true, data: ['B-existing'] });
  let release;
  let writes = 0;
  let pending;
  let observer;
  const gate = new Promise(resolve => { release = resolve; });
  const dependencies = {
    react: { useMemo: fn => fn(), useCallback: fn => fn },
    '@tanstack/react-query': {
      useQueryClient: () => client,
      useMutation: options => {
        if (observer) observer.setOptions(options);
        else observer = new MutationObserver(client, options);
        return { isPending: observer.getCurrentResult().isPending, mutate: variables => {
          pending = observer.mutate(variables);
          pending.catch(() => {});
        } };
      },
    },
    '@/hooks/useApi': { useApiQuery: queryKey => ({ data: client.getQueryData(queryKey), isLoading: loading, isError: error }) },
    '@/stores/authStore': { useAuthStore: () => auth },
    '@/services/api': { put: async () => {
      writes++;
      await gate;
      if (fail) throw new Error('request failed');
      return { data: { success: true, data: ['A-existing', 'A-added'] } };
    } },
    'react-hot-toast': { error: () => {} },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { exports: module.exports, require: name => {
    assert.ok(name in dependencies, `unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return { client, key, auth, render: module.exports.useMenuFavorites, release,
    writes: () => writes, pending: () => pending };
}

test('A save finishing after B switch only updates the request-time A cache', async () => {
  const env = setup();
  env.render().toggleFavorite('A-added');
  await Promise.resolve();
  env.auth.selectedCompany = 'B';
  env.render();
  env.release();
  await env.pending();
  assert.equal(JSON.stringify(env.client.getQueryData(env.key('A')).data), JSON.stringify(['A-existing', 'A-added']));
  assert.deepEqual(env.client.getQueryData(env.key('B')).data, ['B-existing']);
});

test('A save failure after B switch invalidates only the request-time A favorites', async () => {
  const env = setup({ fail: true });
  env.render().toggleFavorite('A-added');
  await Promise.resolve();
  env.auth.selectedCompany = 'B';
  env.render();
  env.release();
  await assert.rejects(env.pending(), /request failed/);
  assert.equal(env.client.getQueryState(env.key('A')).isInvalidated, true);
  assert.equal(env.client.getQueryState(env.key('B')).isInvalidated, false);
  assert.deepEqual(env.client.getQueryData(env.key('B')).data, ['B-existing']);
});

for (const state of [{ loading: true }, { error: true }]) {
  test(`unavailable original favorites cannot issue a replacement: ${JSON.stringify(state)}`, async () => {
    const env = setup(state);
    env.render().toggleFavorite('A-added');
    await Promise.resolve();
    assert.equal(env.writes(), 0);
    assert.deepEqual(env.client.getQueryData(env.key('A')).data, ['A-existing']);
  });
}

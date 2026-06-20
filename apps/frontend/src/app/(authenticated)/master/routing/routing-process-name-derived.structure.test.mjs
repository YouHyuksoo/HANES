import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manager = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/routing/components/RoutingGroupManager.tsx', 'utf8');
const service = fs.readFileSync('apps/backend/src/modules/master/services/routing-group.service.ts', 'utf8');
const spec = fs.readFileSync('apps/backend/src/modules/master/services/routing-group.service.spec.ts', 'utf8');

test('/master/routing process modal does not allow direct process name editing', () => {
  assert.doesNotMatch(
    manager,
    /<Input label=\{t\("master\.routing\.processName"\)\}[\s\S]*?onChange=\{\(e\) => setProcessForm\(\(f\) => \(\{ \.\.\.f, processName: e\.target\.value \}\)\)\}/,
  );
  assert.match(manager, /data-testid="routing-process-name-display"/);
});

test('/master/routing derives process name from selected process code option', () => {
  assert.match(manager, /const selectedProcessName = useMemo/);
  assert.match(manager, /selectedProcessOption\?\.processName \|\| processForm\.processName/);
  assert.match(manager, /processName: selectedProcessName/);
  assert.match(manager, /disabled=\{!processForm\.processCode \|\| !selectedProcessName\}/);
});

test('routing process service resolves process name from PROCESS_MASTERS', () => {
  assert.match(service, /@InjectRepository\(ProcessMaster\)/);
  assert.match(service, /private readonly processMasterRepo: Repository<ProcessMaster>/);
  assert.match(service, /resolveProcessMaster/);
  assert.match(service, /processName: processMaster\.processName/);
  assert.match(spec, /uses PROCESS_MASTERS name when creating a routing process/);
  assert.match(spec, /uses PROCESS_MASTERS name when updating a routing process code/);
});

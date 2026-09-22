import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

const stepIndex = (name) => workflow.indexOf(`- name: ${name}`);

test('deployment validates the candidate before stopping production', () => {
  const stop = stepIndex('Stop HANES processes only');
  const validationSteps = [
    'Backend Jest',
    'Oracle smoke',
    'Backend typecheck',
    'Frontend typecheck',
  ];

  assert.ok(stop >= 0, 'production stop step must exist');
  for (const name of validationSteps) {
    const validation = stepIndex(name);
    assert.ok(validation >= 0, `${name} step must exist`);
    assert.ok(validation < stop, `${name} must finish before production is stopped`);
  }
});

test('deployment builds only after production has stopped', () => {
  const stop = stepIndex('Stop HANES processes only');
  const build = stepIndex('Build');

  assert.ok(stop >= 0 && build >= 0, 'stop and build steps must exist');
  assert.ok(stop < build, 'production must stop immediately before the shared checkout build');
});

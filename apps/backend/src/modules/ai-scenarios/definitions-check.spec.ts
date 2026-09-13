import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateScenario } from './ai-scenarios.service';
import type { Scenario } from './scenario.types';

/**
 * definitions/*.json 이 규격을 통과하는지 확인한다.
 * 여기서 실패하면 배포해도 그 시나리오는 적재되지 않는다 — CI 에서 미리 잡는다.
 */
describe('definitions/*.json', () => {
  const dir = path.join(__dirname, 'definitions');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  it('시나리오 파일이 하나 이상 있다', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s 는 규격을 통과한다', (file) => {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Scenario;
    const errors = validateScenario(parsed, path.basename(file, '.json'));
    expect(errors).toEqual([]);
  });
});

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Scenario, ScenarioStep, ScenarioSummary } from './scenario.types';

/**
 * 시나리오 저장소.
 *
 * JSON 파일을 repo 에 커밋해 배포로 반영한다. DB 가 아닌 이유:
 * 시나리오는 "검증을 통과한 것만 올린다"가 전제라 버전 관리와 리뷰가 필요하고,
 * 화면 코드와 함께 움직여야 한다(셀렉터가 화면에 의존하므로).
 *
 * 부팅 시 한 번 읽고 검증한다. 규격을 어긴 파일은 **적재하지 않는다** —
 * 잘못된 시나리오가 배포되어도 실행 자체가 불가능해야 한다.
 */
@Injectable()
export class AiScenariosService {
  private readonly logger = new Logger(AiScenariosService.name);
  private readonly scenarios = new Map<string, Scenario>();

  constructor() {
    this.load();
  }

  /** 배포 형태(dist)와 개발 형태(src) 양쪽에서 찾는다 */
  private resolveDir(): string | null {
    const candidates = [
      path.join(__dirname, 'definitions'),
      path.join(process.cwd(), 'src/modules/ai-scenarios/definitions'),
      path.join(process.cwd(), 'apps/backend/src/modules/ai-scenarios/definitions'),
    ];
    return candidates.find((dir) => fs.existsSync(dir)) ?? null;
  }

  private load(): void {
    const dir = this.resolveDir();
    if (!dir) {
      this.logger.warn('시나리오 정의 폴더를 찾지 못했습니다. 등록된 시나리오가 없습니다.');
      return;
    }
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const full = path.join(dir, file);
      try {
        const parsed = JSON.parse(fs.readFileSync(full, 'utf8')) as Scenario;
        const errors = validateScenario(parsed, path.basename(file, '.json'));
        if (errors.length > 0) {
          this.logger.error(`시나리오 규격 위반으로 제외: ${file}\n  - ${errors.join('\n  - ')}`);
          continue;
        }
        this.scenarios.set(parsed.id, parsed);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`시나리오를 읽지 못했습니다: ${file} — ${message}`);
      }
    }
    this.logger.log(`시나리오 ${this.scenarios.size}건 적재`);
  }

  /** AI 가 선택에 쓰는 목록 — steps 는 빼고 내린다 */
  list(): ScenarioSummary[] {
    return [...this.scenarios.values()].map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      startRoute: s.startRoute,
      params: s.params ?? {},
      writeStepCount: s.steps.filter((step) => step.write).length,
    }));
  }

  /** 드라이버가 실행할 본문 */
  get(id: string): Scenario {
    const found = this.scenarios.get(id);
    if (!found) throw new NotFoundException(`시나리오를 찾을 수 없습니다: ${id}`);
    return found;
  }

  /** AI 가 채운 값이 required 를 만족하는지 — 실행 전에 거른다 */
  assertParams(id: string, params: Record<string, unknown>): void {
    const scenario = this.get(id);
    const missing = Object.entries(scenario.params ?? {})
      .filter(([key, spec]) => spec.required && (params[key] === undefined || params[key] === ''))
      .map(([, spec]) => spec.label);
    if (missing.length > 0) {
      throw new BadRequestException(`값이 필요합니다: ${missing.join(', ')}`);
    }
  }
}

const ACTIONS = new Set(['goto', 'click', 'fill', 'scan', 'waitForText', 'capture', 'waitMs']);
const TARGET_KEYS = ['testId', 'role', 'label', 'ariaLabel', 'placeholder', 'text', 'nthButton'];
const VAR_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * 규격 검증. 실행 전이 아니라 **적재 시점**에 거른다.
 * 작성 스킬도 같은 규칙을 참조해 생성물을 자체 검증한다.
 */
export function validateScenario(scenario: Scenario, fileBaseName: string): string[] {
  const errors: string[] = [];
  if (scenario.schemaVersion !== 1) errors.push(`schemaVersion 은 1 이어야 합니다 (현재 ${scenario.schemaVersion})`);
  if (scenario.id !== fileBaseName) errors.push(`id("${scenario.id}")가 파일명("${fileBaseName}")과 다릅니다`);
  if (!scenario.description?.trim()) errors.push('description 이 필요합니다 (AI 가 이걸 읽고 시나리오를 고릅니다)');
  if (!scenario.startRoute?.startsWith('/')) errors.push('startRoute 는 / 로 시작해야 합니다');
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    errors.push('steps 가 비어 있습니다');
    return errors;
  }

  const known = new Set(Object.keys(scenario.params ?? {}));
  scenario.steps.forEach((step: ScenarioStep, i) => {
    const where = `[${i}] ${step.action}`;
    if (!ACTIONS.has(step.action)) errors.push(`${where}: 알 수 없는 action`);
    if (['click', 'fill', 'scan', 'capture'].includes(step.action)) {
      if (!step.target) errors.push(`${where}: target 이 필요합니다`);
      else if (!TARGET_KEYS.some((k) => (step.target as Record<string, unknown>)[k] !== undefined)) {
        errors.push(`${where}: target 에 해석 가능한 키가 없습니다`);
      }
    }
    if (step.action === 'capture' && !step.as) errors.push(`${where}: as 가 필요합니다`);
    if (step.action === 'waitMs' && !step.note) {
      errors.push(`${where}: 고정 대기에는 이유를 적은 note 가 필요합니다`);
    }
    // 데이터가 박혀 있으면 안 된다 — 시나리오는 절차만 담는다
    for (const raw of [step.value, step.note]) {
      if (typeof raw !== 'string') continue;
      for (const m of raw.matchAll(VAR_PATTERN)) {
        if (!known.has(m[1])) errors.push(`${where}: 정의되지 않은 값 {{${m[1]}}} (params 에 선언하세요)`);
      }
    }
    if (step.as) known.add(step.as);
  });
  return errors;
}

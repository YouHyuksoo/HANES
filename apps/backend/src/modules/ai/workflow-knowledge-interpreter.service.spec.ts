import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { validate } from 'class-validator';

jest.mock('./ai.service', () => ({ AiService: class AiService {} }));

import { AiController } from './ai.controller';
import { WorkflowKnowledgeInterpretDto } from './dto/workflow-knowledge.dto';

type Interpreter = {
  interpret(query: string): Promise<{
    interpreted: boolean;
    candidates: Array<{ nodeId: string; reason: string; relationKinds: string[] }>;
    errorCode?: string;
  }>;
};

const loadInterpreter = (): new (aiService: { complete: jest.Mock }) => Interpreter => {
  // Runtime loading keeps the initial RED phase executable before the production file exists.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./workflow-knowledge-interpreter.service').WorkflowKnowledgeInterpreterService;
};

describe('WorkflowKnowledgeInterpreterService', () => {
  const create = (response: string | Error) => {
    const complete = response instanceof Error
      ? jest.fn().mockRejectedValue(response)
      : jest.fn().mockResolvedValue(response);
    const Service = loadInterpreter();
    return { service: new Service({ complete }), complete };
  };

  it('retains registered candidates and allowed semantic relation kinds', async () => {
    const { service } = create(JSON.stringify({ candidates: [{
      nodeId: 'activity:arrival-register',
      reason: '  입하 업무와 일치  ',
      relationKinds: ['precedes', 'references'],
    }] }));

    await expect(service.interpret('입하 등록')).resolves.toEqual({
      interpreted: true,
      candidates: [{
        nodeId: 'activity:arrival-register',
        reason: '입하 업무와 일치',
        relationKinds: ['precedes', 'references'],
      }],
    });
  });

  it('discards unknown nodes', async () => {
    const { service } = create(JSON.stringify({ candidates: [{
      nodeId: 'activity:not-registered', reason: 'unknown', relationKinds: ['precedes'],
    }] }));

    await expect(service.interpret('입하 등록')).resolves.toEqual({ interpreted: true, candidates: [] });
  });

  it('discards registered nodes that were not shortlisted', async () => {
    const { service } = create(JSON.stringify({ candidates: [{
      nodeId: 'activity:shipping-confirm', reason: 'off-shortlist', relationKinds: ['precedes'],
    }] }));

    await expect(service.interpret('입하 등록')).resolves.toEqual({ interpreted: true, candidates: [] });
  });

  it('discards unknown relation kinds while retaining the candidate', async () => {
    const { service } = create(JSON.stringify({ candidates: [{
      nodeId: 'activity:arrival-register', reason: 'match', relationKinds: ['precedes', 'ui-flow'],
    }] }));

    await expect(service.interpret('입하 등록')).resolves.toEqual({
      interpreted: true,
      candidates: [{ nodeId: 'activity:arrival-register', reason: 'match', relationKinds: ['precedes'] }],
    });
  });

  it('sends only shortlist identity fields and the runtime relation allowlist', async () => {
    const { service, complete } = create('{"candidates":[]}');

    await service.interpret('입하 등록');

    const prompt = JSON.stringify(complete.mock.calls[0][0]);
    expect(prompt).toContain('activity:arrival-register');
    expect(prompt).toContain('입하 등록');
    expect(prompt).toContain('precedes');
    expect(prompt).not.toContain('입하 시 품목 LOT_UNIT_QTY 기준으로 MAT_LOT을 발급한다.');
    expect(prompt).not.toContain('coverage');
    expect(prompt).not.toContain('description');
  });

  it('builds a bounded shortlist for a natural-language sentence and includes related data nodes', async () => {
    const { service, complete } = create('{"candidates":[]}');

    await service.interpret('입하 등록은 어떤 테이블을 쓰나요?');

    expect(complete).toHaveBeenCalledTimes(1);
    const userPayload = JSON.parse(complete.mock.calls[0][0][1].content);
    expect(userPayload.candidates.some((candidate: { nodeId: string }) => candidate.nodeId === 'activity:arrival-register')).toBe(true);
    expect(userPayload.candidates.some((candidate: { nodeId: string }) => candidate.nodeId.startsWith('data:'))).toBe(true);
    expect(userPayload.candidates.length).toBeGreaterThan(0);
    expect(userPayload.candidates.length).toBeLessThanOrEqual(12);
  });

  it('merges token search results without duplicate shortlist nodes', async () => {
    const { service, complete } = create('{"candidates":[]}');

    await service.interpret('입하 등록 MAT_LOTS');

    const userPayload = JSON.parse(complete.mock.calls[0][0][1].content);
    const ids = userPayload.candidates.map((candidate: { nodeId: string }) => candidate.nodeId);
    expect(ids).toContain('activity:arrival-register');
    expect(ids).toContain('data:MAT_LOTS');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('deduplicates AI candidates and relation kinds while preserving first order', async () => {
    const response = { candidates: [
      { nodeId: 'activity:arrival-register', reason: 'first', relationKinds: ['precedes', 'precedes', 'references'] },
      { nodeId: 'activity:arrival-register', reason: 'second', relationKinds: ['requires'] },
    ] };
    const { service } = create(JSON.stringify(response));

    await expect(service.interpret('입하 등록')).resolves.toEqual({
      interpreted: true,
      candidates: [{
        nodeId: 'activity:arrival-register', reason: 'first', relationKinds: ['precedes', 'references'],
      }],
    });
  });

  it('caps valid AI candidates at five and never above the shortlist size', async () => {
    const probe = create('{"candidates":[]}');
    await probe.service.interpret('입하');
    const shortlist = JSON.parse(probe.complete.mock.calls[0][0][1].content).candidates;
    const candidates = shortlist.map((candidate: { nodeId: string }, index: number) => ({
      nodeId: candidate.nodeId, reason: `candidate-${index}`, relationKinds: ['references'],
    }));
    const { service } = create(JSON.stringify({ candidates }));

    const result = await service.interpret('입하');
    expect(result.candidates.length).toBeLessThanOrEqual(5);
    expect(result.candidates.length).toBeLessThanOrEqual(shortlist.length);
  });

  it('returns INVALID_RESPONSE for malformed JSON', async () => {
    const { service } = create('not json');
    await expect(service.interpret('입하 등록')).resolves.toEqual({
      interpreted: false, candidates: [], errorCode: 'INVALID_RESPONSE',
    });
  });

  it.each([
    ['missing nodeId', { reason: 'match', relationKinds: ['precedes'] }],
    ['non-string nodeId', { nodeId: 123, reason: 'match', relationKinds: ['precedes'] }],
    ['missing reason', { nodeId: 'activity:arrival-register', relationKinds: ['precedes'] }],
    ['non-string reason', { nodeId: 'activity:arrival-register', reason: 123, relationKinds: ['precedes'] }],
    ['non-array relationKinds', { nodeId: 'activity:arrival-register', reason: 'match', relationKinds: 'precedes' }],
    ['non-string relation kind', { nodeId: 'activity:arrival-register', reason: 'match', relationKinds: ['precedes', 123] }],
  ])('returns INVALID_RESPONSE for a contract-invalid candidate: %s', async (_label, invalidCandidate) => {
    const validCandidate = {
      nodeId: 'activity:arrival-register', reason: 'valid', relationKinds: ['precedes'],
    };
    const { service } = create(JSON.stringify({ candidates: [validCandidate, invalidCandidate] }));

    await expect(service.interpret('입하 등록')).resolves.toEqual({
      interpreted: false, candidates: [], errorCode: 'INVALID_RESPONSE',
    });
  });

  it.each([
    ['missing candidates', {}],
    ['object candidates', { candidates: {} }],
    ['null candidates', { candidates: null }],
  ])('returns INVALID_RESPONSE for an invalid top-level response: %s', async (_label, response) => {
    const { service } = create(JSON.stringify(response));
    await expect(service.interpret('입하 등록')).resolves.toEqual({
      interpreted: false, candidates: [], errorCode: 'INVALID_RESPONSE',
    });
  });

  it('returns AI_UNAVAILABLE when the provider rejects', async () => {
    const { service } = create(new Error('API key missing'));
    await expect(service.interpret('입하 등록')).resolves.toEqual({
      interpreted: false, candidates: [], errorCode: 'AI_UNAVAILABLE',
    });
  });

  it('avoids the provider when deterministic search has no shortlist', async () => {
    const { service, complete } = create('{"candidates":[]}');
    await expect(service.interpret('zzzz-no-workflow-match-zzzz')).resolves.toEqual({ interpreted: true, candidates: [] });
    expect(complete).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only queries at the service boundary without calling the provider', async () => {
    const { service, complete } = create('{"candidates":[]}');
    await expect(service.interpret('   \t ')).resolves.toEqual({ interpreted: true, candidates: [] });
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('AiController workflow knowledge route', () => {
  it('registers POST /ai/workflow-knowledge/interpret', () => {
    const handler = (AiController.prototype as unknown as Record<string, unknown>).interpretWorkflowKnowledge;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('workflow-knowledge/interpret');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
  });

  it('delegates the DTO query and passes through the interpreter fallback result', async () => {
    const fallback = { interpreted: false, candidates: [], errorCode: 'AI_UNAVAILABLE' } as const;
    const interpreter = { interpret: jest.fn().mockResolvedValue(fallback) };
    const controller = new AiController(
      {} as never, {} as never, {} as never, {} as never, {} as never, interpreter as never,
    );

    await expect(controller.interpretWorkflowKnowledge({ query: '입하 등록' })).resolves.toBe(fallback);
    expect(interpreter.interpret).toHaveBeenCalledWith('입하 등록');
  });
});

describe('WorkflowKnowledgeInterpretDto', () => {
  it('rejects whitespace-only queries', async () => {
    const dto = new WorkflowKnowledgeInterpretDto();
    dto.query = '   \t ';
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});

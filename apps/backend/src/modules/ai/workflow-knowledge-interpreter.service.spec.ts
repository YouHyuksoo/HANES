import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

jest.mock('./ai.service', () => ({ AiService: class AiService {} }));

import { AiController } from './ai.controller';

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

  it('returns INVALID_RESPONSE for malformed JSON', async () => {
    const { service } = create('not json');
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
});

describe('AiController workflow knowledge route', () => {
  it('registers POST /ai/workflow-knowledge/interpret', () => {
    const handler = (AiController.prototype as unknown as Record<string, unknown>).interpretWorkflowKnowledge;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('workflow-knowledge/interpret');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
  });
});

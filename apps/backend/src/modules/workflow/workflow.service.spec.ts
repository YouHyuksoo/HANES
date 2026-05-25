import { Test, TestingModule } from '@nestjs/testing';
import { OracleQueryAdapter } from '../../common/services/oracle-query.adapter';
import { MockLoggerService } from '@test/mock-logger.service';
import { WorkflowService } from './workflow.service';

describe('WorkflowService', () => {
  let target: WorkflowService;
  let oracleQueries: {
    fetchCursor: jest.Mock;
  };

  beforeEach(async () => {
    oracleQueries = {
      fetchCursor: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: OracleQueryAdapter, useValue: oracleQueries },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<WorkflowService>(WorkflowService);
  });

  it('loads workflow summary through the Oracle query adapter', async () => {
    oracleQueries.fetchCursor.mockResolvedValue([
      {
        workflowId: 'WF-INSPECT',
        nodeId: 'REQUEST',
        pendingCnt: 2,
        activeCnt: 1,
        doneCnt: 3,
        reverseCnt: 0,
      },
    ]);

    await expect(target.getSummary()).resolves.toEqual({
      'WF-INSPECT': {
        REQUEST: {
          pendingCnt: 2,
          activeCnt: 1,
          doneCnt: 3,
          reverseCnt: 0,
        },
      },
    });

    expect(oracleQueries.fetchCursor).toHaveBeenCalledWith(
      'PKG_WORKFLOW',
      'SP_WORKFLOW_SUMMARY',
    );
  });

  it('defaults missing workflow counters to zero', async () => {
    oracleQueries.fetchCursor.mockResolvedValue([
      { workflowId: 'WF-EMPTY', nodeId: 'START' },
    ]);

    await expect(target.getSummary()).resolves.toEqual({
      'WF-EMPTY': {
        START: {
          pendingCnt: 0,
          activeCnt: 0,
          doneCnt: 0,
          reverseCnt: 0,
        },
      },
    });
  });
});

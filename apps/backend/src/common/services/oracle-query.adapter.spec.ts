import { OracleQueryAdapter } from './oracle-query.adapter';
import { OracleService } from './oracle.service';

describe('OracleQueryAdapter', () => {
  let target: OracleQueryAdapter;
  let oracleService: {
    callProc: jest.Mock;
    callProcMultiCursor: jest.Mock;
  };

  beforeEach(() => {
    oracleService = {
      callProc: jest.fn(),
      callProcMultiCursor: jest.fn(),
    };
    target = new OracleQueryAdapter(oracleService as unknown as OracleService);
  });

  it('passes bind parameters to single-cursor procedure calls unchanged', async () => {
    const binds = { p_target_date: new Date('2026-05-23T00:00:00'), p_line: 'L1' };
    const rows = [{ totalCnt: 3 }];
    oracleService.callProc.mockResolvedValue(rows);

    await expect(
      target.fetchCursor('PKG_DASHBOARD', 'SP_JOB_ORDER_STATS', binds),
    ).resolves.toBe(rows);

    expect(oracleService.callProc).toHaveBeenCalledWith(
      'PKG_DASHBOARD',
      'SP_JOB_ORDER_STATS',
      binds,
    );
  });

  it('passes bind parameters and cursor names to multi-cursor procedure calls unchanged', async () => {
    const binds = { p_target_date: new Date('2026-05-23T00:00:00') };
    const cursorNames = ['o_summary', 'o_items'];
    const result = { o_summary: [{ totalCnt: 1 }], o_items: [] };
    oracleService.callProcMultiCursor.mockResolvedValue(result);

    await expect(
      target.fetchCursors('PKG_DASHBOARD', 'SP_INSPECT_DAILY', cursorNames, binds),
    ).resolves.toBe(result);

    expect(oracleService.callProcMultiCursor).toHaveBeenCalledWith(
      'PKG_DASHBOARD',
      'SP_INSPECT_DAILY',
      cursorNames,
      binds,
    );
  });

  it('propagates OracleService errors without wrapping them', async () => {
    const error = new Error('Oracle 프로시저 호출 실패');
    oracleService.callProc.mockRejectedValue(error);

    await expect(
      target.fetchCursor('PKG_WORKFLOW', 'SP_WORKFLOW_SUMMARY'),
    ).rejects.toBe(error);
  });
});

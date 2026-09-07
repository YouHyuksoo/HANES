/** 수리 상태 전이와 완료 조건 회귀 테스트 */
import { repairStage, repairCompletionError } from '../../../../../../packages/shared/src/utils/repair-rules';

describe('repair lifecycle rules', () => {
  it('keeps reinspection pending until an inspection action succeeds', () => {
    expect(repairStage({status:'IN_REPAIR', repairResult:'COMPLETED', disposition:'REINSPECT'})).toBe('inspection');
    expect(repairStage({status:'IN_REPAIR', repairResult:'IN_PROGRESS', disposition:'REINSPECT'})).toBe('repairing');
  });
  it('does not allow completion before start or without a worker', () => {
    expect(repairCompletionError({status:'RECEIVED'})).toBe('notRepairing');
    expect(repairCompletionError({status:'IN_REPAIR'})).toBe('workerRequired');
  });
  it('requires completed result and return process for reuse', () => {
    const order = {status:'IN_REPAIR', workerId:'W1', disposition:'REUSE'};
    expect(repairCompletionError({...order,repairResult:'IMPOSSIBLE',returnProcess:'P1'})).toBe('resultRequired');
    expect(repairCompletionError({...order,repairResult:'COMPLETED'})).toBe('returnProcessRequired');
    expect(repairCompletionError({...order,repairResult:'COMPLETED',returnProcess:'P1'})).toBeNull();
  });
  it('permits scrap of irreparable products without a return process', () => {
    expect(repairCompletionError({status:'IN_REPAIR',workerId:'W1',disposition:'SCRAP',repairResult:'IMPOSSIBLE'})).toBeNull();
  });
});

/** 수리 상태/완료 조건의 화면·서버 공통 규칙. 재검사 대기는 기존 상태와 결과로 표현한다. */
export interface RepairState {
  status: string;
  repairResult?: string | null;
  disposition?: string | null;
  workerId?: string | null;
  returnProcess?: string | null;
}

export function repairStage(order: RepairState) {
  if (order.status === 'COMPLETED') return 'completed';
  if (order.status === 'RECEIVED') return 'received';
  if (order.status !== 'IN_REPAIR') return 'unknown';
  return order.disposition === 'REINSPECT' && order.repairResult === 'COMPLETED'
    ? 'inspection' : 'repairing';
}

export function repairCompletionError(order: RepairState) {
  if (order.status !== 'IN_REPAIR') return 'notRepairing';
  if (!order.workerId?.trim()) return 'workerRequired';
  if (!['REUSE', 'REINSPECT', 'SCRAP'].includes(order.disposition ?? '')) return 'dispositionRequired';
  if (order.disposition === 'SCRAP') {
    return ['COMPLETED', 'IMPOSSIBLE'].includes(order.repairResult ?? '') ? null : 'resultRequired';
  }
  if (order.repairResult !== 'COMPLETED') return 'resultRequired';
  if (!order.returnProcess?.trim()) return 'returnProcessRequired';
  return null;
}

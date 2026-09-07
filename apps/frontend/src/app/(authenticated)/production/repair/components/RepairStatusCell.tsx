"use client";
/** DB 공통코드 상태와 재검사 대기 단계를 함께 표시한다. */
import {repairStage} from '@harness/shared';
import StatusBadge from '@/components/shared/StatusBadge';
import {useRepairText} from '../repairText';
import type {RepairItem} from '../repairColumns';
export default function RepairStatusCell({order}:{order:RepairItem}) {
  const text=useRepairText();
  return <div className="flex flex-col gap-1"><StatusBadge codeType="REPAIR_STATUS" value={order.status}/>{repairStage(order)==='inspection'&&<span className="text-xs text-text-muted">{text.pending}</span>}</div>;
}

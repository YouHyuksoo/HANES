export interface WoRow {
  workOrderNo: string;
  pmPlanCode: string;
  equipCode: string;
  woType: string;
  scheduledDate: string;
  dueDate: string;
  completedAt: string | null;
  status: string;
  priority: string;
  overallResult: string | null;
  remark: string | null;
  equip: {
    equipCode: string;
    equipName: string;
    lineCode: string | null;
    equipType: string | null;
  } | null;
}

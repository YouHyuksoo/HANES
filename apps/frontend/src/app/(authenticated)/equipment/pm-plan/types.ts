export interface PmPlanRow {
  planCode: string;
  planName: string;
  pmType: string;
  cycleType: string;
  cycleValue: number;
  cycleUnit: string;
  equipId: string;
  estimatedTime: number | null;
  description: string;
  nextDueAt: string | null;
  useYn: string;
  itemCount: number;
  equip: {
    id: string;
    equipCode: string;
    equipName: string;
    lineCode: string | null;
    equipType: string | null;
  } | null;
}

export interface ProgressItem {
  id: string;
  orderNo: string;
  part?: { itemCode?: string; itemName?: string };
  itemCode?: string;
  lineCode: string;
  processCode?: string | null;
  equipCode?: string | null;
  planQty: number;
  goodQty: number;
  defectQty: number;
  progress: number;
  status: string;
  planDate: string;
  priority: number;
}

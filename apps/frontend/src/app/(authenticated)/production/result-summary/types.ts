export interface ProductSummary {
  itemCode: string;
  itemName: string;
  itemType: string;
  lineCode: string;
  totalPlanQty: number;
  totalGoodQty: number;
  totalDefectQty: number;
  totalQty: number;
  defectRate: number;
  yieldRate: number;
  achieveRate: number;
  orderCount: number;
  resultCount: number;
}

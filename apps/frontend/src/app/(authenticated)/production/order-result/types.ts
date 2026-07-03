export interface ProdOrderResultRow {
  orderNo: string;
  parentOrderNo?: string | null;
  rootOrderNo?: string | null;
  planNo?: string | null;
  itemCode: string;
  itemName: string;
  itemType: string;
  lineCode: string;
  processCode: string;
  orderKind: string;
  routingSeq?: number | null;
  equipCode: string;
  planQty: number;
  planDate: string;
  status: string;
  totalGoodQty: number;
  totalDefectQty: number;
  totalQty: number;
  remainingQty: number;
  achievementRate: number;
  defectRate: number;
  resultCount: number;
  lastResultAt: string;
}

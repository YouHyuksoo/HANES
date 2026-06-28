export interface ScrapRecord {
  id: string;
  transNo: string;
  transDate: string;
  itemCode: string;
  itemName?: string;
  matUid?: string;
  qty: number;
  warehouseName?: string;
  remark: string;
  status: string;
}

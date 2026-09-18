export interface ScrapRecord {
  id: string;
  transNo: string;
  transDate: string;
  itemCode: string;
  itemName?: string;
  matUid?: string;
  qty: number;
  warehouseName?: string;
  locationCode?: string | null;
  locationName?: string | null;
  remark: string;
  status: string;
}

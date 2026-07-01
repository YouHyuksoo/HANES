export interface TransferRecord {
  id: string;
  transNo: string;
  transDate: string;
  itemCode: string;
  itemName?: string;
  matUid?: string;
  qty: number;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  remark: string;
  status: string;
}

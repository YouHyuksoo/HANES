export interface SubconOrder {
  id: string;
  orderNo: string;
  vendorName: string;
  itemCode: string;
  itemName: string;
  orderQty: number;
  deliveredQty: number;
  receivedQty: number;
  defectQty: number;
  orderDate: string;
  dueDate: string;
  status: string;
}

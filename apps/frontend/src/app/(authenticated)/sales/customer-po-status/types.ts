export interface CustomerPoStatus {
  id: string;
  orderNo: string;
  customerName: string;
  orderDate: string;
  dueDate: string;
  orderQty: number;
  shippedQty: number;
  shipRate: number;
  remainQty: number;
  status: string;
}

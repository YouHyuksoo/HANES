export type ShipType = 'BOX' | 'PALLET' | 'MIXED';

export interface ShippedOrder {
  shipOrderNo: string;
  customerName: string | null;
  shipDate: string | null;
  shippedQty: number;
  shipType: ShipType;
  palletCount: number;
  boxCount: number;
  hasErpSynced: boolean;
}

export interface DetailBox {
  boxNo: string;
  itemCode: string;
  qty: number;
}

export interface DetailPallet {
  palletNo: string;
  status: string;
  boxCount: number;
  totalQty: number;
  shipNo: string | null;
  boxes: DetailBox[];
}

export interface DetailLooseBox extends DetailBox {
  palletNo: string;
  shippedAt: string | null;
}

export interface ShippedDetail {
  order: {
    shipOrderNo: string;
    customerName: string | null;
    shipDate: string | null;
  };
  pallets: DetailPallet[];
  boxShipped: DetailLooseBox[];
}

export interface ReturnRow {
  returnNo: string;
  shipmentId: string | null;
  returnDate: string;
  returnReason: string;
  status: string;
}

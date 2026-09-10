export interface InspectHistory {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: string;
  inspectType: string;
  inspectDate: string;
  inspectorName: string;
  overallResult: string;
  remark: string;
  orderNo?: string | null;
  inspectAt?: string | null;
  details?: string | { items?: InspectDetail[] } | null;
}

export interface InspectDetail {
  itemId?: string;
  itemName?: string;
  result?: string;
  measuredValue?: string | number | null;
  remark?: string | null;
  reasonCode?: string | null;
  reasonText?: string | null;
}

export interface EquipOption {
  equipCode: string;
  equipName: string;
  processCode?: string;
  processName?: string;
  lineType?: string;
  currentJobOrderId?: string | null;
  currentWorkerCodes?: string | null;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function getEquipmentArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const data = payload.data;
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.items)) return data.items;
  if (isRecord(data) && Array.isArray(data.rows)) return data.rows;
  return [];
}

export function normalizeEquipOptions(payload: unknown): EquipOption[] {
  return getEquipmentArray(payload).flatMap((item) => {
    if (!isRecord(item) || typeof item.equipCode !== 'string') return [];
    const equipName = typeof item.equipName === 'string' && item.equipName.trim()
      ? item.equipName
      : item.equipCode;
    const option: EquipOption = { equipCode: item.equipCode, equipName };
    if (typeof item.processCode === 'string') option.processCode = item.processCode;
    if (typeof item.processName === 'string') option.processName = item.processName;
    if (typeof item.lineType === 'string') option.lineType = item.lineType;
    option.currentJobOrderId = typeof item.currentJobOrderId === 'string' ? item.currentJobOrderId : null;
    option.currentWorkerCodes = typeof item.currentWorkerCodes === 'string' ? item.currentWorkerCodes : null;
    return [option];
  });
}

export interface EquipOption {
  equipCode: string;
  equipName: string;
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
    return [{ equipCode: item.equipCode, equipName }];
  });
}

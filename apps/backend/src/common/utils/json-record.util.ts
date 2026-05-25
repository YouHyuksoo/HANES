export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJsonRecord(json: string): Record<string, unknown> {
  const value: unknown = JSON.parse(json);
  if (!isRecord(value)) {
    throw new Error('JSON object expected');
  }
  return value;
}

export function toRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    acc[key] = entry;
    return acc;
  }, {});
}

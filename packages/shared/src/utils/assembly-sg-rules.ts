/** Plan the SG quantities for one assembled product without mutating scanned labels. */
export function planAssemblySgConsumption(
  components: readonly { itemCode: string; qtyPer: number }[],
  labels: readonly { sgBarcode: string; itemCode: string; remainQty: number; status: string }[],
): {
  allocations: { sgBarcode: string; qty: number }[];
  shortages: { itemCode: string; requiredQty: number; availableQty: number }[];
} {
  const required = new Map<string, number>();
  for (const component of components) {
    if (!Number.isFinite(component.qtyPer) || component.qtyPer <= 0) {
      throw new Error(`Invalid assembly BOM quantity: ${component.itemCode}`);
    }
    required.set(component.itemCode, (required.get(component.itemCode) ?? 0) + component.qtyPer);
  }
  const seen = new Set<string>();
  const usable = labels.filter((label) => {
    if (seen.has(label.sgBarcode)) return false;
    seen.add(label.sgBarcode);
    return ['IN_STOCK', 'MOUNTED'].includes(label.status)
      && Number.isFinite(label.remainQty) && label.remainQty > 0;
  });
  const allocations: { sgBarcode: string; qty: number }[] = [];
  const shortages: { itemCode: string; requiredQty: number; availableQty: number }[] = [];
  for (const [itemCode, requiredQty] of required) {
    const candidates = usable.filter((label) => label.itemCode === itemCode);
    const availableQty = candidates.reduce((sum, label) => sum + label.remainQty, 0);
    if (availableQty < requiredQty) shortages.push({ itemCode, requiredQty, availableQty });
    let remaining = requiredQty;
    for (const label of candidates) {
      if (remaining <= 0) break;
      const qty = Math.min(remaining, label.remainQty);
      allocations.push({ sgBarcode: label.sgBarcode, qty });
      remaining -= qty;
    }
  }
  return { allocations, shortages };
}

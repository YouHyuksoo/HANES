/** Current-order elapsed productivity; UPPH uses the currently assigned headcount. */
export function kioskProductivity(quantity: number, startAt: string | null | undefined,
  endAt: string | null | undefined, workers: number, now: number) {
  const start = startAt ? Date.parse(startAt) : NaN;
  const end = endAt ? Date.parse(endAt) : now;
  const seconds = (end - start) / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
    return { ct: null, uph: null, upph: null };
  }
  const uph = quantity * 3600 / seconds;
  return { ct: seconds / quantity, uph, upph: Number.isFinite(workers) && workers > 0 ? uph / workers : null };
}

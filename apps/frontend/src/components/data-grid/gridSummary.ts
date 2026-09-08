/** 조회 결과의 숫자만 합산한다. 취소 원장의 음수 부호는 보존한다. */
export function sumGridValues(values: unknown[]): number {
  return values.reduce<number>((sum, value) => {
    if (typeof value !== 'number' && typeof value !== 'string') return sum;
    const number = Number(value);
    return Number.isFinite(number) ? sum + number : sum;
  }, 0);
}

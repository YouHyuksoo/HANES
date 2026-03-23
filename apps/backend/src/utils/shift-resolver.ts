/**
 * @file utils/shift-resolver.ts
 * @description 교대 자동판별 유틸 — startAt 시각을 교대패턴 시간대와 비교하여 교대코드를 반환한다.
 *
 * 초보자 가이드:
 * 1. resolve(): timestamp와 company/plant를 받아 교대코드 반환
 * 2. 자정 넘김(야간 교대): START_TIME > END_TIME이면 두 구간 분리 비교
 * 3. 매칭 실패 시 null 반환 (강제하지 않음)
 */
import { Repository } from 'typeorm';
import { ShiftPattern } from '../entities/shift-pattern.entity';

export class ShiftResolver {
  constructor(private readonly shiftRepo: Repository<ShiftPattern>) {}

  async resolve(
    startAt: Date,
    company: string,
    plant: string,
  ): Promise<string | null> {
    const patterns = await this.shiftRepo.find({
      where: { company, plant, useYn: 'Y' },
      order: { sortOrder: 'ASC' },
    });
    if (patterns.length === 0) return null;
    const hhmm = this.toHHMM(startAt);
    for (const p of patterns) {
      if (this.isInRange(hhmm, p.startTime, p.endTime)) {
        return p.shiftCode;
      }
    }
    return null;
  }

  private toHHMM(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  private isInRange(hhmm: string, start: string, end: string): boolean {
    if (start <= end) {
      return hhmm >= start && hhmm < end;
    }
    // 자정 넘김: 20:00~05:00 → (20:00~23:59) OR (00:00~05:00)
    return hhmm >= start || hhmm < end;
  }
}

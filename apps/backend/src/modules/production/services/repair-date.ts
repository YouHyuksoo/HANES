/** 수리 일자 키. 과거 시각 포함 DATE도 조회한 뒤 원래 PK로 갱신한다. */
import { Between } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
/**
 * 날짜를 YYYY-MM-DD 로 만든다. 엔티티의 `type: 'date'` 컬럼(REPAIR_ORDERS.REPAIR_DATE)은
 * 타입 선언이 Date 여도 Oracle 하이드레이션 결과가 'YYYY-MM-DD' 문자열이라 둘 다 받는다.
 */
export function repairDateOnly(value: Date | string = new Date()): string {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('수리일자가 올바르지 않습니다.');
    value = parsed;
  }
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}
/** 수리일자(YYYY-MM-DD) 하루의 [시작, 끝] 범위 — raw SQL 잠금(BETWEEN)과 findOne 조건이 같은 범위를 쓴다. */
export function repairDayRange(date: string): [Date, Date] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('수리일자가 올바르지 않습니다.');
  const [y,m,d]=date.split('-').map(Number);
  const start=new Date(y,m-1,d);
  if (repairDateOnly(start)!==date) throw new BadRequestException('수리일자가 올바르지 않습니다.');
  return [start,new Date(y,m-1,d,23,59,59,999)];
}
export function repairDay(date: string) {
  const [start,end]=repairDayRange(date);
  return Between(start,end);
}

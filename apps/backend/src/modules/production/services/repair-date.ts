/** 수리 일자 키. 과거 시각 포함 DATE도 조회한 뒤 원래 PK로 갱신한다. */
import { Between } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
export function repairDateOnly(value = new Date()): string {
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

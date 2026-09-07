/** 수리 일자 키. 과거 시각 포함 DATE도 조회한 뒤 원래 PK로 갱신한다. */
import { Between } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
export function repairDateOnly(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}
export function repairDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('수리일자가 올바르지 않습니다.');
  const [y,m,d]=date.split('-').map(Number);
  const start=new Date(y,m-1,d);
  if (repairDateOnly(start)!==date) throw new BadRequestException('수리일자가 올바르지 않습니다.');
  return Between(start,new Date(y,m-1,d,23,59,59,999));
}

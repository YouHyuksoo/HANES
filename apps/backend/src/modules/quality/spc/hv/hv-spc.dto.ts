/**
 * @file hv-spc.dto.ts
 * @description HV SPC 조회 쿼리 DTO — days(7/14/30/60) 와 k(최근 서브그룹 수, 0=전체).
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const HV_SPC_DAYS_ALLOWED = [7, 14, 30, 60] as const;
export type HvSpcDays = (typeof HV_SPC_DAYS_ALLOWED)[number];

export class HvSpcQueryDto {
  @ApiPropertyOptional({ description: '오늘 포함 최근 N일', enum: HV_SPC_DAYS_ALLOWED, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([...HV_SPC_DAYS_ALLOWED])
  days?: HvSpcDays;

  @ApiPropertyOptional({ description: '최근 k 서브그룹만 (0 = 전체)', default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  k?: number;
}

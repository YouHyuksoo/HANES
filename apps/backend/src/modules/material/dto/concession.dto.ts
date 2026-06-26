/**
 * @file src/modules/material/dto/concession.dto.ts
 * @description 특채처리(특별채택) 전용 DTO
 *              - IQC 불합격(FAIL) LOT을 특채 승인하여 양품입고를 허용
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

/** 특채 대상(FAIL 입하+품목 그룹) 조회 */
export class ConcessionTargetQueryDto {
  @ApiPropertyOptional({ description: '검색어 (입하번호/품목)' })
  @IsOptional()
  @IsString()
  search?: string;
}

/** 특채 처리/취소 (입하번호+품목 그룹 단위) */
export class ApplyConcessionDto {
  @ApiProperty({ description: '입하번호 (ARRIVAL_NO)' })
  @IsString()
  @IsNotEmpty()
  arrivalNo: string;

  @ApiProperty({ description: '품목코드 (ITEM_CODE)' })
  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @ApiPropertyOptional({ description: '특채 사유 (비고)' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: '특채 처리 작업자 코드 (WORKER_MASTERS.WORKER_CODE)' })
  @IsOptional()
  @IsString()
  specialAcceptWorkerCode?: string;
}

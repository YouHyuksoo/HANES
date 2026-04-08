/**
 * @file src/modules/material/dto/adjustment.dto.ts
 * @description 재고보정 관련 DTO
 *
 * 초보자 가이드:
 * - CreateAdjustmentDto: 보정 등록 (PC/PDA 공용)
 * - ApproveAdjustmentDto: 승인/반려 시 처리자 ID 전달용
 * - AdjustmentQueryDto: 목록 조회 필터
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class CreateAdjustmentDto {
  @ApiProperty({ description: '창고 코드' })
  @IsString()
  warehouseCode: string;

  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiPropertyOptional({ description: '자재 UID' })
  @IsOptional()
  @IsString()
  matUid?: string;

  @ApiProperty({ description: '보정 후 수량' })
  @IsInt()
  @Min(0)
  afterQty: number;

  @ApiProperty({ description: '보정 사유' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: '작성자' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}

/**
 * 승인 / 반려 처리 시 사용하는 DTO
 * - approvedBy: 처리자 사용자 ID (선택)
 */
export class ApproveAdjustmentDto {
  @ApiPropertyOptional({ description: '승인/반려 처리자 ID' })
  @IsOptional()
  @IsString()
  approvedBy?: string;
}

export class AdjustmentQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

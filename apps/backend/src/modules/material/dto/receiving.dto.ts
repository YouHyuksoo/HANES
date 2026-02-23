/**
 * @file src/modules/material/dto/receiving.dto.ts
 * @description 입고관리 DTO - IQC 합격건 일괄/분할 입고 처리, 자동입고(라벨 발행 시)
 *
 * 초보자 가이드:
 * 1. **입고 대상**: 입하(Arrival)를 통해 생성된 LOT 중 IQC 합격(PASS)된 건
 * 2. **일괄 입고**: 여러 LOT를 한번에 입고 확정
 * 3. **분할 입고**: LOT 수량의 일부만 입고 (나머지는 추후 입고)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, Min, Max,
  MaxLength, IsDateString, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 입고 품목 DTO (LOT 단위) */
export class ReceiveItemDto {
  @ApiProperty({ description: 'LOT ID' })
  @IsString()
  lotId: string;

  @ApiProperty({ description: '입고 수량 (분할 입고 시 LOT 잔량 이하)' })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiProperty({ description: '입고 창고 ID' })
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional({ description: '제조일자 (YYYY-MM-DD) - 수정 시 유효기한 재계산' })
  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 일괄 입고 등록 DTO */
export class CreateBulkReceiveDto {
  @ApiProperty({ description: '입고 품목 목록', type: [ReceiveItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;
}

/** 입고 이력 조회 DTO */
export class ReceivingQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

/** 자동입고 요청 DTO (라벨 발행 시 호출) */
export class AutoReceiveDto {
  @ApiProperty({ description: '입고 대상 LOT ID 목록' })
  @IsArray()
  @IsString({ each: true })
  lotIds: string[];

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;
}

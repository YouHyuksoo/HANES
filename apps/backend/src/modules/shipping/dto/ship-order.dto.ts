/**
 * @file src/modules/shipping/dto/ship-order.dto.ts
 * @description 출하지시 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateShipOrderDto**: 출하지시 등록 시 사용 (items 포함)
 * 2. **UpdateShipOrderDto**: 출하지시 수정 시 사용
 * 3. **ShipOrderQueryDto**: 출하지시 목록 조회 필터링
 *
 * 상태 흐름: DRAFT -> CONFIRMED -> SHIPPING -> SHIPPED
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  Min,
  Max,
  MaxLength,
  IsIn,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

const SHIP_ORDER_STATUS = ['DRAFT', 'CONFIRMED', 'SHIPPING', 'SHIPPED'] as const;

/** 출하지시 품목 DTO */
export class ShipOrderItemDto {
  @ApiProperty({ description: '품목 ID' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '지시 수량', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderQty: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/** 출하지시 생성 DTO */
export class CreateShipOrderDto {
  @ApiProperty({ description: '출하지시 번호', example: 'SO-20250201-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  shipOrderNo: string;

  @ApiPropertyOptional({ description: '고객 ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: '고객명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;

  @ApiPropertyOptional({ description: '납기일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: '출하예정일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  shipDate?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiProperty({ description: '출하지시 품목 목록', type: [ShipOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ShipOrderItemDto)
  items: ShipOrderItemDto[];
}

/** 출하지시 수정 DTO */
export class UpdateShipOrderDto extends PartialType(CreateShipOrderDto) {
  @ApiPropertyOptional({ description: '상태', enum: SHIP_ORDER_STATUS })
  @IsOptional()
  @IsString()
  @IsIn([...SHIP_ORDER_STATUS])
  status?: string;
}

/** 출하지시 목록 조회 쿼리 DTO */
export class ShipOrderQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '검색어 (지시번호, 고객명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '상태 필터', enum: SHIP_ORDER_STATUS })
  @IsOptional()
  @IsString()
  @IsIn([...SHIP_ORDER_STATUS])
  status?: string;

  @ApiPropertyOptional({ description: '납기일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: '납기일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;
}

/**
 * @file src/modules/shipping/dto/customer-order.dto.ts
 * @description 고객발주(Customer PO) 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateCustomerOrderDto**: 고객발주 등록 시 사용 (items 포함)
 * 2. **UpdateCustomerOrderDto**: 고객발주 수정 시 사용
 * 3. **CustomerOrderQueryDto**: 고객발주 목록 조회 필터링
 *
 * 상태 흐름: RECEIVED -> CONFIRMED -> IN_PRODUCTION -> PARTIAL_SHIP -> SHIPPED -> CLOSED
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsIn,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

const CUSTOMER_ORDER_STATUS = [
  'RECEIVED',
  'CONFIRMED',
  'IN_PRODUCTION',
  'PARTIAL_SHIP',
  'SHIPPED',
  'CLOSED',
] as const;

/** 고객발주 품목 DTO */
export class CustomerOrderItemDto {
  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiProperty({ description: '수주 수량', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderQty: number;

  @ApiPropertyOptional({ description: '단가' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/** 고객발주 생성 DTO */
export class CreateCustomerOrderDto {
  @ApiProperty({ description: '수주번호', example: 'CO-20250201-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  orderNo: string;

  @ApiPropertyOptional({ description: '고객 ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: '고객명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;

  @ApiPropertyOptional({ description: '수주일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @ApiPropertyOptional({ description: '납기일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: '총금액' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({ description: '통화', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiProperty({ description: '고객발주 품목 목록', type: [CustomerOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CustomerOrderItemDto)
  items: CustomerOrderItemDto[];
}

/** 고객발주 수정 DTO */
export class UpdateCustomerOrderDto extends PartialType(CreateCustomerOrderDto) {
  @ApiPropertyOptional({ description: '상태', enum: CUSTOMER_ORDER_STATUS })
  @IsOptional()
  @IsString()
  @IsIn([...CUSTOMER_ORDER_STATUS])
  status?: string;
}

/** 고객발주 목록 조회 쿼리 DTO */
export class CustomerOrderQueryDto {
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
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '검색어 (수주번호, 고객명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '상태 필터', enum: CUSTOMER_ORDER_STATUS })
  @IsOptional()
  @IsString()
  @IsIn([...CUSTOMER_ORDER_STATUS])
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

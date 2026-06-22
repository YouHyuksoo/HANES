/**
 * @file src/modules/material/dto/purchase-order.dto.ts
 * @description 구매발주(PO) 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreatePurchaseOrderDto**: PO 생성 시 필요한 필드
 * 2. **PurchaseOrderQueryDto**: PO 목록 조회 시 필터/페이징
 * 3. **PO 상태**: DRAFT(임시) -> CONFIRMED(확정) -> PARTIAL(부분입고) -> RECEIVED(입고완료) -> CLOSED(마감)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, Min, Max, MaxLength,
  IsDateString, IsIn, IsArray, ValidateNested, IsNumber, IsNotEmpty,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

/** PO 품목 DTO */
export class CreatePurchaseOrderItemDto {
  @ApiPropertyOptional({ description: '라인 번호' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lineNo?: number;

  @ApiPropertyOptional({ description: '개정 번호' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revNo?: number;

  @ApiProperty({ description: '품목 코드' })
  @IsString()
  @IsNotEmpty({ message: '품목코드는 필수입니다. 품목을 선택하세요.' })
  itemCode: string;

  @ApiPropertyOptional({ description: '품목명' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiProperty({ description: '발주 수량' })
  @Type(() => Number)
  @IsInt({ message: '발주수량은 정수로 입력하세요.' })
  @Min(1, { message: '발주수량은 1 이상이어야 합니다.' })
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
  @MaxLength(200)
  remark?: string;
}

/** PO 생성 DTO */
export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'PO 번호', example: 'PO-20260213-001' })
  @IsString()
  @IsNotEmpty({ message: 'PO번호는 필수입니다.' })
  @MaxLength(50)
  poNo: string;

  @ApiPropertyOptional({ description: '거래처 코드' })
  @IsOptional()
  @IsString()
  partnerCode?: string;

  @ApiPropertyOptional({ description: '거래처명' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partnerName?: string;

  @ApiPropertyOptional({ description: '발주일' })
  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @ApiPropertyOptional({ description: '납기일' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiProperty({ description: 'PO 품목 목록', type: [CreatePurchaseOrderItemDto] })
  @IsArray()
  @ArrayNotEmpty({ message: '발주 품목을 1개 이상 추가하세요.' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}

/** PO 수정 DTO */
export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}

/** PO 목록 조회 DTO */
export class PurchaseOrderQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CLOSED'] })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CLOSED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

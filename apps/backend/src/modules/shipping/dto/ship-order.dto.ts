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
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

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
  @ApiPropertyOptional({ description: '출하지시 번호. 미입력 시 서버에서 자동 채번', example: 'SO-20250201-001', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shipOrderNo?: string;

  @ApiPropertyOptional({ description: '고객 ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: '고객명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;

  @ApiPropertyOptional({ description: '고객 PO번호 (수동 입력)', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerPoNo?: string;

  @ApiPropertyOptional({ description: '납기일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ description: '고객사 출하일 (YYYY-MM-DD)' })
  @IsDateString()
  shipDate: string;

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
export class ShipOrderQueryDto extends PaginationQueryDto {


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

  @ApiPropertyOptional({ description: '출하예정일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  shipDateFrom?: string;

  @ApiPropertyOptional({ description: '출하예정일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  shipDateTo?: string;

  @ApiPropertyOptional({
    description: '기간 밖이어도 미완료(DRAFT/CONFIRMED/SHIPPING) 지시는 항상 포함',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  includeOpen?: boolean;
}

/** 출하지시 기준 팔레트 생성 DTO */
export class CreateShipOrderPalletDto {
  @ApiPropertyOptional({ description: '팔레트 번호. 미입력 시 서버에서 자동 채번', example: 'PLT2606200001', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  palletNo?: string;
}

/** 출하지시 기준 팔레트 바코드 출하 DTO */
export class ShipOrderPalletsDto {
  @ApiProperty({ description: '출하 처리할 팔레트 번호 목록', type: [String], example: ['PLT2606200001'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  palletNos: string[];

  @ApiPropertyOptional({ description: '작업자 ID', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerId?: string;
}

/**
 * @file src/modules/shipping/dto/ship-return.dto.ts
 * @description 출하반품 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateShipReturnDto**: 반품 등록 시 사용 (items 포함)
 * 2. **UpdateShipReturnDto**: 반품 수정 시 사용
 * 3. **ShipReturnQueryDto**: 반품 목록 조회 필터링
 *
 * 상태 흐름: DRAFT -> CONFIRMED -> COMPLETED
 * 처리유형: RESTOCK(재입고), SCRAP(폐기), REPAIR(수리)
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

const RETURN_STATUS = ['DRAFT', 'CONFIRMED', 'COMPLETED'] as const;
const DISPOSAL_TYPE = ['RESTOCK', 'SCRAP', 'REPAIR'] as const;

/** 반품 품목 DTO */
export class ShipReturnItemDto {
  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiProperty({ description: '반품 수량', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  returnQty: number;

  @ApiPropertyOptional({ description: '처리유형', enum: DISPOSAL_TYPE, default: 'RESTOCK' })
  @IsOptional()
  @IsString()
  @IsIn([...DISPOSAL_TYPE])
  disposalType?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/** 출하반품 생성 DTO */
export class CreateShipReturnDto {
  @ApiProperty({ description: '반품 번호', example: 'RT-20250201-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  returnNo: string;

  @ApiPropertyOptional({ description: '출하지시 ID (참조)' })
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiPropertyOptional({ description: '반품일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiPropertyOptional({ description: '반품 사유', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  returnReason?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiProperty({ description: '반품 품목 목록', type: [ShipReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ShipReturnItemDto)
  items: ShipReturnItemDto[];
}

/** 출하반품 수정 DTO */
export class UpdateShipReturnDto extends PartialType(CreateShipReturnDto) {
  @ApiPropertyOptional({ description: '상태', enum: RETURN_STATUS })
  @IsOptional()
  @IsString()
  @IsIn([...RETURN_STATUS])
  status?: string;
}

/** 출하반품 목록 조회 쿼리 DTO */
export class ShipReturnQueryDto {
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

  @ApiPropertyOptional({ description: '검색어 (반품번호)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '상태 필터', enum: RETURN_STATUS })
  @IsOptional()
  @IsString()
  @IsIn([...RETURN_STATUS])
  status?: string;

  @ApiPropertyOptional({ description: '반품일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  returnDateFrom?: string;

  @ApiPropertyOptional({ description: '반품일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  returnDateTo?: string;
}

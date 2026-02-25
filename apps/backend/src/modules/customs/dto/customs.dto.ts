/**
 * @file src/modules/customs/dto/customs.dto.ts
 * @description 보세관리 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// 수입신고 (Customs Entry) DTOs
// ============================================================================

export class CreateCustomsEntryDto {
  @ApiProperty({ description: '수입신고번호', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  entryNo: string;

  @ApiPropertyOptional({ description: 'B/L 번호', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  blNo?: string;

  @ApiPropertyOptional({ description: '인보이스 번호', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoiceNo?: string;

  @ApiPropertyOptional({ description: '신고일' })
  @IsOptional()
  @IsDateString()
  declarationDate?: string;

  @ApiPropertyOptional({ description: '통관일' })
  @IsOptional()
  @IsDateString()
  clearanceDate?: string;

  @ApiPropertyOptional({ description: '원산지', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  origin?: string;

  @ApiPropertyOptional({ description: 'HS코드', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hsCode?: string;

  @ApiPropertyOptional({ description: '총 금액' })
  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @ApiPropertyOptional({ description: '통화', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateCustomsEntryDto extends PartialType(CreateCustomsEntryDto) {
  @ApiPropertyOptional({ description: '상태', enum: ['PENDING', 'CLEARED', 'RELEASED'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CustomsEntryQueryDto {
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

  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ============================================================================
// 보세자재 LOT (Customs Lot) DTOs
// ============================================================================

export class CreateCustomsLotDto {
  @ApiProperty({ description: '수입신고 ID' })
  @IsString()
  entryId: string;

  @ApiProperty({ description: 'LOT 번호' })
  @IsString()
  lotNo: string;

  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '수량' })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({ description: '단가' })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}

export class UpdateCustomsLotDto extends PartialType(CreateCustomsLotDto) {
  @ApiPropertyOptional({ description: '상태', enum: ['BONDED', 'PARTIAL', 'RELEASED'] })
  @IsOptional()
  @IsString()
  status?: string;
}

// ============================================================================
// 사용신고 (Usage Report) DTOs
// ============================================================================

export class CreateUsageReportDto {
  @ApiProperty({ description: '보세자재 LOT ID' })
  @IsString()
  customsLotId: string;

  @ApiPropertyOptional({ description: '작업지시 ID' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiProperty({ description: '사용 수량' })
  @IsInt()
  @Min(1)
  usageQty: number;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateUsageReportDto {
  @ApiPropertyOptional({ description: '상태', enum: ['DRAFT', 'REPORTED', 'CONFIRMED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UsageReportQueryDto {
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

  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

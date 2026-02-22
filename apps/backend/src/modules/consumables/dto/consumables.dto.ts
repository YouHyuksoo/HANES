/**
 * @file src/modules/consumables/dto/consumables.dto.ts
 * @description 소모품관리 관련 DTO 정의
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
// 소모품 마스터 DTOs
// ============================================================================

export class CreateConsumableDto {
  @ApiProperty({ description: '소모품 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  consumableCode: string;

  @ApiProperty({ description: '소모품명', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  consumableName: string;

  @ApiPropertyOptional({ description: '카테고리', enum: ['MOLD', 'JIG', 'TOOL'] })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '기대 수명 (타수)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedLife?: number;

  @ApiPropertyOptional({ description: '경고 임계치' })
  @IsOptional()
  @IsInt()
  @Min(0)
  warningCount?: number;

  @ApiPropertyOptional({ description: '보관 위치', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ description: '단가' })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ description: '공급업체', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendor?: string;
}

export class UpdateConsumableDto extends PartialType(CreateConsumableDto) {
  @ApiPropertyOptional({ description: '현재 사용 횟수' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentCount?: number;

  @ApiPropertyOptional({ description: '상태', enum: ['NORMAL', 'WARNING', 'REPLACE'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '사용 여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  useYn?: string;
}

export class ConsumableQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 5000;

  @ApiPropertyOptional({ description: '카테고리 필터' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '사용 여부' })
  @IsOptional()
  @IsString()
  useYn?: string;
}

// ============================================================================
// 소모품 입출고 이력 DTOs
// ============================================================================

export class CreateConsumableLogDto {
  @ApiProperty({ description: '소모품 ID' })
  @IsString()
  consumableId: string;

  @ApiProperty({ description: '이력 유형', enum: ['IN', 'IN_RETURN', 'OUT', 'OUT_RETURN'] })
  @IsString()
  logType: string;

  @ApiPropertyOptional({ description: '수량', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number = 1;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;

  // 입고 전용 필드
  @ApiPropertyOptional({ description: '공급업체코드' })
  @IsOptional()
  @IsString()
  vendorCode?: string;

  @ApiPropertyOptional({ description: '공급업체명' })
  @IsOptional()
  @IsString()
  vendorName?: string;

  @ApiPropertyOptional({ description: '단가' })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ description: '입고구분', enum: ['NEW', 'REPLACEMENT'] })
  @IsOptional()
  @IsString()
  incomingType?: string;

  // 출고 전용 필드
  @ApiPropertyOptional({ description: '출고부서' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: '라인 ID' })
  @IsOptional()
  @IsString()
  lineId?: string;

  @ApiPropertyOptional({ description: '설비 ID' })
  @IsOptional()
  @IsString()
  equipId?: string;

  @ApiPropertyOptional({ description: '출고사유', enum: ['PRODUCTION', 'REPAIR', 'OTHER'] })
  @IsOptional()
  @IsString()
  issueReason?: string;

  // 반품 공통 필드
  @ApiPropertyOptional({ description: '반품사유' })
  @IsOptional()
  @IsString()
  returnReason?: string;
}

export class ConsumableLogQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 5000;

  @ApiPropertyOptional({ description: '소모품 ID' })
  @IsOptional()
  @IsString()
  consumableId?: string;

  @ApiPropertyOptional({ description: '이력 유형' })
  @IsOptional()
  @IsString()
  logType?: string;

  @ApiPropertyOptional({ description: '이력 유형 그룹', enum: ['RECEIVING', 'ISSUING'] })
  @IsOptional()
  @IsString()
  logTypeGroup?: string;

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
// 타수 업데이트 DTO
// ============================================================================

export class UpdateShotCountDto {
  @ApiProperty({ description: '소모품 ID' })
  @IsString()
  consumableId: string;

  @ApiProperty({ description: '추가 타수' })
  @IsInt()
  @Min(1)
  addCount: number;

  @ApiPropertyOptional({ description: '설비 ID' })
  @IsOptional()
  @IsString()
  equipId?: string;
}

export class ResetShotCountDto {
  @ApiProperty({ description: '소모품 ID' })
  @IsString()
  consumableId: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

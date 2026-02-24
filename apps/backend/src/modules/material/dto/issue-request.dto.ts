/**
 * @file src/modules/material/dto/issue-request.dto.ts
 * @description 자재 출고요청 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **IssueRequestItemDto**: 출고요청 개별 품목 정보
 * 2. **CreateIssueRequestDto**: 출고요청 생성 요청
 * 3. **IssueRequestQueryDto**: 출고요청 목록 조회 필터
 * 4. **RejectIssueRequestDto**: 출고요청 반려 시 사유
 * 5. **RequestIssueItemDto**: 요청 기반 실출고 품목
 * 6. **RequestIssueDto**: 요청 기반 실출고 생성
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 출고요청 품목 DTO */
export class IssueRequestItemDto {
  @ApiProperty({ description: '품목 ID (PART_MASTERS FK)' })
  @IsString()
  partId: string;

  @ApiProperty({ description: '요청 수량' })
  @IsInt()
  @Min(1)
  requestQty: number;

  @ApiProperty({ description: '단위 (EA, M, KG 등)' })
  @IsString()
  @MaxLength(20)
  unit: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 출고요청 생성 DTO */
export class CreateIssueRequestDto {
  @ApiPropertyOptional({ description: '작업지시 ID' })
  @IsOptional()
  @IsString()
  jobOrderId?: string;

  @ApiPropertyOptional({ description: '출고 유형 (ComCode ISSUE_TYPE)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  issueType?: string;

  @ApiProperty({ description: '요청 품목 목록', type: [IssueRequestItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueRequestItemDto)
  items: IssueRequestItemDto[];

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 출고요청 목록 조회 DTO */
export class IssueRequestQueryDto {
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

  @ApiPropertyOptional({
    description: '상태 필터',
    enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'])
  status?: string;

  @ApiPropertyOptional({ description: '검색어 (요청번호, 요청자)' })
  @IsOptional()
  @IsString()
  search?: string;
}

/** 출고요청 반려 DTO */
export class RejectIssueRequestDto {
  @ApiProperty({ description: '반려 사유' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

/** 요청 기반 실출고 품목 DTO */
export class RequestIssueItemDto {
  @ApiProperty({ description: '출고요청 품목 ID (MAT_ISSUE_REQUEST_ITEMS FK)' })
  @IsString()
  requestItemId: string;

  @ApiProperty({ description: 'LOT ID' })
  @IsString()
  lotId: string;

  @ApiProperty({ description: '출고 수량' })
  @IsInt()
  @Min(1)
  issueQty: number;
}

/** 요청 기반 실출고 생성 DTO */
export class RequestIssueDto {
  @ApiProperty({ description: '출고 품목 목록', type: [RequestIssueItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestIssueItemDto)
  items: RequestIssueItemDto[];

  @ApiPropertyOptional({ description: '출고 창고 코드' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '출고 유형 (ComCode ISSUE_TYPE)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  issueType?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

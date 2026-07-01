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
  IsNumber,
  Min,
  Max,
  IsIn,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

/** 출고요청 품목 DTO */
export class IssueRequestItemDto {
  @ApiProperty({ description: '품목 코드 (ITEM_MASTERS FK)' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '요청 수량' })
  @IsInt()
  @Min(1)
  requestQty: number;

  @ApiProperty({ description: '단위 (EA, M, KG 등)' })
  @IsString()
  @MaxLength(20)
  unit: string;

  @ApiPropertyOptional({ description: 'BOM 소요량 (= 작업지시수량 x BOM 소요량)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bomReqQty?: number;

  @ApiPropertyOptional({ description: '작업지시 기준 기불출량' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  prevIssueQty?: number;

  @ApiPropertyOptional({ description: '현장 창고 보유량' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  floorStockQty?: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 출고요청 생성 DTO */
export class CreateIssueRequestDto {
  @ApiPropertyOptional({ description: '작업지시 번호' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '출고 대상 공정코드 — 지정 시 출고가 공정재고로 적재된다(ADR 0002)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  processCode?: string;

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
export class IssueRequestQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({
    description: '상태 필터',
    enum: ['REQUESTED', 'APPROVED', 'PARTIAL', 'REJECTED', 'COMPLETED'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['REQUESTED', 'APPROVED', 'PARTIAL', 'REJECTED', 'COMPLETED'])
  status?: string;

  @ApiPropertyOptional({ description: '검색어 (요청번호, 요청자, 작업지시, 출고유형, 품목, 비고)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '작업지시번호 필터' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '출고 유형 필터 (ComCode ISSUE_TYPE)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  issueType?: string;
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

  @ApiProperty({ description: '자재 UID' })
  @IsString()
  matUid: string;

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

/**
 * @file src/modules/material/dto/mat-issue.dto.ts
 * @description 자재출고 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **IssueItemDto**: 개별 출고 품목 정보
 * 2. **CreateMatIssueDto**: 출고 생성 요청
 * 3. **MatIssueQueryDto**: 출고 이력 조회 필터
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsIn, IsDateString, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class IssueItemDto {
  @ApiProperty({ description: 'LOT ID' })
  @IsString()
  lotId: string;

  @ApiProperty({ description: '출고 수량' })
  @IsInt()
  @Min(1)
  issueQty: number;
}

export class CreateMatIssueDto {
  @ApiPropertyOptional({ description: '작업지시 번호' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '생산실적 ID (자재 투입 연결)' })
  @IsOptional()
  @IsString()
  prodResultId?: string;

  @ApiPropertyOptional({ description: '출고 창고 코드' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiProperty({ description: '출고 유형 (ComCode ISSUE_TYPE)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  issueType: string;

  @ApiProperty({ description: '출고 품목 목록', type: [IssueItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueItemDto)
  items: IssueItemDto[];

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class MatIssueQueryDto {
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

  @ApiPropertyOptional({ description: '작업지시 번호' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: 'LOT ID' })
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiPropertyOptional({ description: '출고 유형 필터 (ComCode ISSUE_TYPE)' })
  @IsOptional()
  @IsString()
  issueType?: string;

  @ApiPropertyOptional({ description: '출고일 시작' })
  @IsOptional()
  @IsDateString()
  issueDateFrom?: string;

  @ApiPropertyOptional({ description: '출고일 종료' })
  @IsOptional()
  @IsDateString()
  issueDateTo?: string;

  @ApiPropertyOptional({ description: '상태', enum: ['DONE', 'CANCELED'] })
  @IsOptional()
  @IsString()
  @IsIn(['DONE', 'CANCELED'])
  status?: string;
}

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
import { IsString, IsOptional, IsInt, Min, Max, IsIn, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ISSUE_TYPE_VALUES } from '@harness/shared';

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
  @ApiPropertyOptional({ description: '작업지시 ID' })
  @IsOptional()
  @IsString()
  jobOrderId?: string;

  @ApiPropertyOptional({ description: '출고 창고 코드' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '출고 유형', enum: ISSUE_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...ISSUE_TYPE_VALUES])
  issueType?: string;

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

  @ApiPropertyOptional({ description: '작업지시 ID' })
  @IsOptional()
  @IsString()
  jobOrderId?: string;

  @ApiPropertyOptional({ description: 'LOT ID' })
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiPropertyOptional({ description: '출고 유형', enum: ISSUE_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...ISSUE_TYPE_VALUES])
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

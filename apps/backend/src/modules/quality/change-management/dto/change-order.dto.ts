/**
 * @file change-order.dto.ts
 * @description 4M 변경점관리 DTO — 생성, 수정, 조회, 검토/승인 요청
 *
 * 초보자 가이드:
 * 1. **CreateChangeOrderDto**: 변경점 등록 시 사용 (제목, 유형, 사유 등)
 * 2. **UpdateChangeOrderDto**: 수정 시 사용 (PartialType으로 전체 필드 선택적)
 * 3. **ChangeOrderQueryDto**: 목록 조회 필터/페이지네이션 (상태, 유형, 우선순위, 검색, 기간)
 * 4. **ReviewChangeOrderDto**: 검토/승인 시 APPROVE 또는 REJECT + 의견
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../common/dto/base-query.dto';

/**
 * 변경점 등록 DTO
 */
export class CreateChangeOrderDto {
  @ApiProperty({
    description: '변경 유형 (4M)',
    enum: ['MAN', 'MACHINE', 'MATERIAL', 'METHOD'],
  })
  @IsIn(['MAN', 'MACHINE', 'MATERIAL', 'METHOD'])
  changeType: string;

  @ApiProperty({ description: '변경 제목', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: '변경 내용 상세', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: '변경 사유', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({ description: '위험성 평가', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  riskAssessment?: string;

  @ApiPropertyOptional({ description: '영향 품목 (JSON)', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  affectedItems?: string;

  @ApiPropertyOptional({ description: '영향 공정 (JSON)', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  affectedProcesses?: string;

  @ApiPropertyOptional({
    description: '우선순위',
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    default: 'MEDIUM',
  })
  @IsOptional()
  @IsIn(['HIGH', 'MEDIUM', 'LOW'])
  priority?: string;

  @ApiPropertyOptional({ description: '요청자', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  requestedBy?: string;

  @ApiPropertyOptional({ description: '시행일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

/**
 * 변경점 수정 DTO (전체 필드 선택적)
 */
export class UpdateChangeOrderDto extends PartialType(CreateChangeOrderDto) {}

/**
 * 변경점 목록 조회 쿼리 DTO
 */
export class ChangeOrderQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '변경 유형 필터' })
  @IsOptional()
  @IsString()
  changeType?: string;

  @ApiPropertyOptional({ description: '우선순위 필터' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: '검색어 (변경번호, 제목)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '조회 시작일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '조회 종료일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * 검토/승인 DTO (APPROVE 또는 REJECT + 의견)
 */
export class ReviewChangeOrderDto {
  @ApiProperty({
    description: '승인/반려 액션',
    enum: ['APPROVE', 'REJECT'],
  })
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ description: '의견', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

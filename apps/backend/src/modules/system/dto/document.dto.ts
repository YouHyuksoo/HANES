/**
 * @file document.dto.ts
 * @description 문서관리 DTO — 문서 생성/수정, 조회 필터
 *
 * 초보자 가이드:
 * 1. **CreateDocumentDto**: 문서 등록 (제목, 유형, 카테고리, 파일 경로 등)
 * 2. **UpdateDocumentDto**: 수정 시 사용 (PartialType으로 전체 필드 선택적)
 * 3. **DocumentQueryDto**: 목록 조회 필터/페이지네이션
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

/**
 * 문서 등록 DTO
 */
export class CreateDocumentDto {
  @ApiProperty({ description: '문서 제목', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  docTitle: string;

  @ApiProperty({ description: '문서 유형', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  docType: string;

  @ApiPropertyOptional({ description: '카테고리', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ description: '파일 경로', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  filePath?: string;

  @ApiPropertyOptional({ description: '파일 크기 (bytes)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional({ description: '보존 기간 (개월)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  retentionPeriod?: number;

  @ApiPropertyOptional({ description: '만료일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: '문서 설명', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

/**
 * 문서 수정 DTO (전체 필드 선택적)
 */
export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

/**
 * 문서 목록 조회 쿼리 DTO
 */
export class DocumentQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '문서 유형 필터' })
  @IsOptional()
  @IsString()
  docType?: string;

  @ApiPropertyOptional({ description: '카테고리 필터' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '검색어 (문서번호, 제목)' })
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

/**
 * @file src/modules/master/dto/com-code.dto.ts
 * @description 공통코드 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateDto**: 생성 시 필요한 필드 정의
 * 2. **UpdateDto**: 수정 시 필요한 필드 (모두 선택적)
 * 3. **QueryDto**: 목록 조회 시 필터링/페이지네이션 옵션
 *
 * 실제 DB 스키마 (com_codes 테이블):
 * - groupCode + detailCode로 유니크 키 구성
 * - parentCode로 계층 구조 지원
 * - useYn으로 활성화 여부 관리 ('Y'/'N')
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 공통코드 생성 DTO
 */
export class CreateComCodeDto {
  @ApiProperty({ description: '그룹 코드', example: 'PRODUCT_TYPE', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  groupCode: string;

  @ApiProperty({ description: '상세 코드', example: 'WIRE', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  detailCode: string;

  @ApiPropertyOptional({ description: '부모 코드 (계층 구조용)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentCode?: string;

  @ApiProperty({ description: '코드명', example: '전선', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  codeName: string;

  @ApiPropertyOptional({ description: '코드 설명', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  codeDesc?: string;

  @ApiPropertyOptional({ description: '정렬 순서', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  useYn?: string;

  @ApiPropertyOptional({ description: '속성1', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  attr1?: string;

  @ApiPropertyOptional({ description: '속성2', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  attr2?: string;

  @ApiPropertyOptional({ description: '속성3', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  attr3?: string;
}

/**
 * 공통코드 수정 DTO
 */
export class UpdateComCodeDto extends PartialType(CreateComCodeDto) {}

/**
 * 공통코드 목록 조회 쿼리 DTO
 */
export class ComCodeQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '그룹 코드로 필터링' })
  @IsOptional()
  @IsString()
  groupCode?: string;

  @ApiPropertyOptional({ description: '검색어 (코드명 검색)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '사용 여부 필터', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  useYn?: string;
}

/**
 * 그룹 목록 조회용 응답 DTO
 */
export class ComCodeGroupResponseDto {
  @ApiProperty({ description: '그룹 코드' })
  groupCode: string;

  @ApiProperty({ description: '코드 개수' })
  count: number;
}

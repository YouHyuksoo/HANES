/**
 * @file src/modules/master/dto/iqc-part-link.dto.ts
 * @description IQC 품목-거래처-검사그룹 연결 DTO
 *
 * 초보자 가이드:
 * 1. **CreateIqcPartLinkDto**: 연결 생성 (품목ID, 거래처ID, 검사그룹ID)
 * 2. **IqcPartLinkQueryDto**: 목록 조회 필터 (검색, 거래처 필터)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIqcPartLinkDto {
  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiPropertyOptional({ description: '거래처 ID (null이면 기본 검사그룹)' })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiProperty({ description: '검사그룹 ID' })
  @IsString()
  groupId: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateIqcPartLinkDto extends PartialType(CreateIqcPartLinkDto) {}

export class IqcPartLinkQueryDto {
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
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '검색 (품목코드/품목명/거래처명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '거래처 ID 필터' })
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiPropertyOptional({ description: '사용여부' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

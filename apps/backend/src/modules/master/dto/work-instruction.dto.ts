/**
 * @file src/modules/master/dto/work-instruction.dto.ts
 * @description 작업지도서 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateWorkInstructionDto**: 품목/공정별 작업지침 생성
 * 2. **WorkInstructionQueryDto**: partId, processCode 필터 지원
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkInstructionDto {
  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiPropertyOptional({ description: '공정 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  processCode?: string;

  @ApiProperty({ description: '제목', example: '메인하네스 조립 지침' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: '내용' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '이미지 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ description: '리비전', default: 'A' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  revision?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateWorkInstructionDto extends PartialType(CreateWorkInstructionDto) {}

export class WorkInstructionQueryDto {
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

  @ApiPropertyOptional({ description: '품목 ID 필터' })
  @IsOptional()
  @IsString()
  partId?: string;

  @ApiPropertyOptional({ description: '공정 코드 필터' })
  @IsOptional()
  @IsString()
  processCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

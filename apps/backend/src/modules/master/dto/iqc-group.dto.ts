/**
 * @file src/modules/master/dto/iqc-group.dto.ts
 * @description IQC 검사그룹 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateIqcGroupDto**: 그룹 생성 (그룹코드, 이름, 검사구분, 항목목록)
 * 2. **UpdateIqcGroupDto**: 그룹 수정 (모든 필드 optional)
 * 3. **IqcGroupQueryDto**: 목록 조회 필터 (검색, 검사구분, 사용여부)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsIn,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class GroupItemDto {
  @ApiProperty({ description: '검사항목 ID' })
  @IsString()
  itemId: string;

  @ApiProperty({ description: '검사순서', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seq: number;
}

export class CreateIqcGroupDto {
  @ApiProperty({ description: '그룹코드', example: 'IGR-001' })
  @IsString()
  @MaxLength(20)
  groupCode: string;

  @ApiProperty({ description: '그룹명', example: '전선류 검사' })
  @IsString()
  @MaxLength(100)
  groupName: string;

  @ApiProperty({ description: '검사구분 (FULL=검사, SKIP=무검사)', enum: ['FULL', 'SKIP'], example: 'FULL' })
  @IsString()
  @IsIn(['FULL', 'SKIP'])
  inspectMethod: string;

  @ApiPropertyOptional({ description: '사용하지 않음 (legacy)', example: null })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sampleQty?: number;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiProperty({ description: '검사항목 목록', type: [GroupItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupItemDto)
  items: GroupItemDto[];
}

export class UpdateIqcGroupDto extends PartialType(CreateIqcGroupDto) {}

export class IqcGroupQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '검색 (그룹코드/그룹명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '검사구분 필터', enum: ['FULL', 'SKIP'] })
  @IsOptional()
  @IsString()
  @IsIn(['FULL', 'SKIP'])
  inspectMethod?: string;

  @ApiPropertyOptional({ description: '사용여부' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

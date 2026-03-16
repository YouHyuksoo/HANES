/**
 * @file src/modules/master/dto/process-quality-condition.dto.ts
 * @description 공정별 양품조건 DTO 정의
 *
 * 초보자 가이드:
 * 1. CreateConditionDto: 양품조건 단건 생성
 * 2. BulkSaveConditionDto: 양품조건 일괄 저장 (기존 데이터 삭제 후 재생성)
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsIn,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConditionDto {
  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '공정 순서' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seq: number;

  @ApiProperty({ description: '조건 순번' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  conditionSeq: number;

  @ApiPropertyOptional({ description: '양품조건 코드 (ComCode: QUALITY_CONDITION)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  conditionCode?: string;

  @ApiPropertyOptional({ description: '정상수치 MIN' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional({ description: '정상수치 MAX' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional({ description: '단위 (ComCode: UNIT)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: '설비 인터페이스 여부', default: 'N' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  equipInterfaceYn?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateConditionDto extends PartialType(CreateConditionDto) {}

export class ConditionItemDto {
  @ApiProperty({ description: '조건 순번' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  conditionSeq: number;

  @ApiPropertyOptional({ description: '양품조건 코드' })
  @IsOptional()
  @IsString()
  conditionCode?: string;

  @ApiPropertyOptional({ description: '정상수치 MIN' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional({ description: '정상수치 MAX' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional({ description: '단위' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: '설비 인터페이스 여부' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  equipInterfaceYn?: string;
}

export class BulkSaveConditionDto {
  @ApiProperty({ description: '양품조건 목록', type: [ConditionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionItemDto)
  conditions: ConditionItemDto[];
}

/**
 * @file terminal-crimp-spec.dto.ts
 * @description 단자별 압착 규격 마스터 DTO — 목록 필터/생성/수정/resolve 조회
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { USE_YN_VALUES } from '@harness/shared';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class CreateTerminalCrimpSpecDto {
  @ApiProperty({ description: '단자 품목코드 (ITEM_MASTERS)', example: 'TRM-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  terminalItemCode: string;

  @ApiPropertyOptional({ description: '단자 종류 (COM_CODES TERMINAL_TYPE)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  terminalType?: string | null;

  @ApiProperty({ description: '전선 사이즈', example: '0.5SQ' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  wireSize: string;

  @ApiPropertyOptional({ description: '전선 품목코드 (ITEM_MASTERS)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  wireItemCode?: string | null;

  @ApiPropertyOptional({ description: '압착 높이 하한 (mm)' })
  @IsOptional() @Type(() => Number) @IsNumber()
  crimpHeightLsl?: number | null;

  @ApiPropertyOptional({ description: '압착 높이 상한 (mm)' })
  @IsOptional() @Type(() => Number) @IsNumber()
  crimpHeightUsl?: number | null;

  @ApiPropertyOptional({ description: '압착 폭 하한 (mm)' })
  @IsOptional() @Type(() => Number) @IsNumber()
  crimpWidthLsl?: number | null;

  @ApiPropertyOptional({ description: '압착 폭 상한 (mm)' })
  @IsOptional() @Type(() => Number) @IsNumber()
  crimpWidthUsl?: number | null;

  @ApiPropertyOptional({ description: '절연부 압착 높이 하한 (mm)' })
  @IsOptional() @Type(() => Number) @IsNumber()
  insCrimpHeightLsl?: number | null;

  @ApiPropertyOptional({ description: '절연부 압착 높이 상한 (mm)' })
  @IsOptional() @Type(() => Number) @IsNumber()
  insCrimpHeightUsl?: number | null;

  @ApiPropertyOptional({ description: '인장력 최소 (N)' })
  @IsOptional() @Type(() => Number) @IsNumber()
  pullForceMin?: number | null;

  @ApiPropertyOptional({ description: '탈피 길이 최소 (mm)' })
  @IsOptional() @Type(() => Number) @IsNumber()
  stripLengthMin?: number | null;

  @ApiPropertyOptional({ description: '탈피 길이 최대 (mm)' })
  @IsOptional() @Type(() => Number) @IsNumber()
  stripLengthMax?: number | null;

  @ApiPropertyOptional({ description: '어플리케이터 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  applicatorCode?: string | null;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string | null;

  @ApiPropertyOptional({ description: '사용여부', default: 'Y' })
  @IsOptional()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class UpdateTerminalCrimpSpecDto extends PartialType(CreateTerminalCrimpSpecDto) {}

export class TerminalCrimpSpecQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어 (단자품목코드/전선사이즈/어플리케이터)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '단자 품목코드' })
  @IsOptional()
  @IsString()
  terminalItemCode?: string;

  @ApiPropertyOptional({ description: '단자 종류' })
  @IsOptional()
  @IsString()
  terminalType?: string;

  @ApiPropertyOptional({ description: '전선 사이즈' })
  @IsOptional()
  @IsString()
  wireSize?: string;

  @ApiPropertyOptional({ description: '사용여부' })
  @IsOptional()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class TerminalCrimpSpecResolveQueryDto {
  @ApiProperty({ description: '단자 품목코드' })
  @IsString()
  @IsNotEmpty()
  terminalItemCode: string;

  @ApiProperty({ description: '전선 사이즈' })
  @IsString()
  @IsNotEmpty()
  wireSize: string;
}

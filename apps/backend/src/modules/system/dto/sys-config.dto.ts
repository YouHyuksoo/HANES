/**
 * @file dto/sys-config.dto.ts
 * @description 시스템 환경설정 DTO
 *
 * 초보자 가이드:
 * - CreateSysConfigDto: 신규 설정 등록 시 사용
 * - UpdateSysConfigDto: 설정값 수정 시 사용
 * - BulkUpdateSysConfigDto: 여러 설정을 한번에 저장
 * - SysConfigQueryDto: 목록 조회 필터
 */
import { IsString, IsOptional, IsNumber, IsIn, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSysConfigDto {
  @ApiProperty({ description: '설정 그룹' })
  @IsString()
  configGroup: string;

  @ApiProperty({ description: '설정 키' })
  @IsString()
  configKey: string;

  @ApiProperty({ description: '설정 값' })
  @IsString()
  configValue: string;

  @ApiProperty({ description: '설정 타입' })
  @IsIn(['BOOLEAN', 'SELECT', 'NUMBER', 'TEXT'])
  configType: string;

  @ApiProperty({ description: '표시 라벨' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '선택 옵션 JSON' })
  @IsOptional()
  @IsString()
  options?: string;

  @ApiPropertyOptional({ description: '정렬 순서' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;
}

export class UpdateSysConfigDto {
  @ApiProperty({ description: '설정 값' })
  @IsString()
  configValue: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  options?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isActive?: string;
}

export class BulkUpdateItemDto {
  @IsString()
  id: string;

  @IsString()
  configValue: string;
}

export class BulkUpdateSysConfigDto {
  @ApiProperty({ description: '일괄 수정할 설정 목록' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  items: BulkUpdateItemDto[];
}

export class SysConfigQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  configGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

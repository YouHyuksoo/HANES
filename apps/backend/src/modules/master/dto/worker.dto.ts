/**
 * @file src/modules/master/dto/worker.dto.ts
 * @description 작업자마스터 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateWorkerDto**: 작업자 생성 (코드, 이름, 부서, QR코드)
 * 2. **processIds**: JSON 배열로 담당 공정 ID 관리
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkerDto {
  @ApiProperty({ description: '작업자 코드', example: 'W-001' })
  @IsString()
  @MaxLength(50)
  workerCode: string;

  @ApiProperty({ description: '작업자명', example: '김작업' })
  @IsString()
  @MaxLength(100)
  workerName: string;

  @ApiPropertyOptional({ description: '부서' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dept?: string;

  @ApiPropertyOptional({ description: 'QR 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qrCode?: string;

  @ApiPropertyOptional({ description: '담당 공정 ID 목록', type: [String] })
  @IsOptional()
  @IsArray()
  processIds?: string[];

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateWorkerDto extends PartialType(CreateWorkerDto) {}

export class WorkerQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dept?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

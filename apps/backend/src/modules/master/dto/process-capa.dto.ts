/**
 * @file src/modules/master/dto/process-capa.dto.ts
 * @description 공정x제품별 CAPA 마스터 DTO
 *
 * 초보자 가이드:
 * 1. CreateProcessCapaDto: 공정+품목 CAPA 생성 (processCode, itemCode, stdTactTime 필수)
 * 2. UpdateProcessCapaDto: CAPA 수정 (processCode, itemCode 제외한 PartialType)
 * 3. ProcessCapaQueryDto: 목록 조회 필터 (공정코드, 품목코드, 검색어)
 */

import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsIn, Min, Max, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class CreateProcessCapaDto {
  @ApiProperty({ description: '공정 코드' })
  @IsString()
  @MaxLength(50)
  processCode: string;

  @ApiProperty({ description: '품목 코드' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiProperty({ description: '표준 택트타임(초)', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  stdTactTime: number;

  @ApiPropertyOptional({ description: '시간당 생산량 (미입력 시 3600/택트타임 자동계산)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stdUph?: number;

  @ApiPropertyOptional({ description: '작업자 수', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  workerCnt?: number;

  @ApiPropertyOptional({ description: '보드 수', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  boardCnt?: number;

  @ApiPropertyOptional({ description: '설비 수', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  equipCnt?: number;

  @ApiPropertyOptional({ description: '전환시간(분)', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  setupTime?: number;

  @ApiPropertyOptional({ description: '밸런싱 효율(%)', default: 85, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  balanceEff?: number;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class UpdateProcessCapaDto extends PartialType(
  OmitType(CreateProcessCapaDto, ['processCode', 'itemCode'] as const),
) {}

export class ProcessCapaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '공정 코드 필터' })
  @IsOptional()
  @IsString()
  processCode?: string;

  @ApiPropertyOptional({ description: '품목 코드 필터' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '검색어 (공정코드/공정명/품목코드/품목명)' })
  @IsOptional()
  @IsString()
  search?: string;

}

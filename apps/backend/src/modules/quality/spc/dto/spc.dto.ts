/**
 * @file spc.dto.ts
 * @description SPC 관리도 DTO — 생성, 수정, 데이터 입력, 조회 필터
 *
 * 초보자 가이드:
 * 1. **CreateSpcChartDto**: 관리도 등록 (품목, 공정, 특성치, 규격 등)
 * 2. **UpdateSpcChartDto**: 관리도 수정 (PartialType으로 선택적)
 * 3. **CreateSpcDataDto**: 측정 데이터 입력 (서브그룹 값)
 * 4. **SpcChartFilterDto**: 관리도 목록 조회 필터/페이지네이션
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsNumber,
  IsDateString,
  IsArray,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseListQueryDto } from '@common/dto/base-query.dto';

/**
 * SPC 관리도 등록 DTO
 */
export class CreateSpcChartDto {
  @ApiProperty({ description: '품목코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiProperty({ description: '공정코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  processCode: string;

  @ApiProperty({ description: '품질 특성치명', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  characteristicName: string;

  @ApiProperty({
    description: '관리도 유형',
    enum: ['XBAR_R', 'XBAR_S', 'P', 'NP', 'C', 'U'],
  })
  @IsIn(['XBAR_R', 'XBAR_S', 'P', 'NP', 'C', 'U'])
  chartType: string;

  @ApiPropertyOptional({ description: '서브그룹 크기', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(25)
  subgroupSize?: number;

  @ApiPropertyOptional({ description: '규격 상한 (USL)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  usl?: number;

  @ApiPropertyOptional({ description: '규격 하한 (LSL)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lsl?: number;

  @ApiPropertyOptional({ description: '목표값 (Target)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  target?: number;

  @ApiPropertyOptional({ description: '데이터 소스 (IQC/PROCESS/OQC/MANUAL)', default: 'MANUAL' })
  @IsOptional()
  @IsIn(['IQC', 'PROCESS', 'OQC', 'MANUAL'])
  dataSource?: string;

  @ApiPropertyOptional({ description: '소스 검사항목명', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceInspectItem?: string;
}

/**
 * SPC 관리도 수정 DTO (전체 필드 선택적)
 */
export class UpdateSpcChartDto extends PartialType(CreateSpcChartDto) {
  @ApiPropertyOptional({
    description: '상태',
    enum: ['ACTIVE', 'INACTIVE'],
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}

/**
 * SPC 측정 데이터 입력 DTO
 */
export class CreateSpcDataDto {
  @ApiProperty({ description: '관리도 ID' })
  @Type(() => Number)
  @IsInt()
  chartId: number;

  @ApiProperty({ description: '측정일시 (ISO 8601)' })
  @IsDateString()
  sampleDate: string;

  @ApiProperty({ description: '서브그룹 번호' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subgroupNo: number;

  @ApiProperty({
    description: '측정값 배열',
    example: [1.23, 1.25, 1.24],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  values: number[];

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/**
 * SPC 관리도 목록 조회 필터 DTO
 * - BaseListQueryDto에서 page, limit, search, status, fromDate, toDate 상속
 */
export class SpcChartFilterDto extends BaseListQueryDto {
  @ApiPropertyOptional({ description: '품목코드 필터' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '공정코드 필터' })
  @IsOptional()
  @IsString()
  processCode?: string;

  @ApiPropertyOptional({
    description: '관리도 유형 필터',
    enum: ['XBAR_R', 'XBAR_S', 'P', 'NP', 'C', 'U'],
  })
  @IsOptional()
  @IsString()
  chartType?: string;
}

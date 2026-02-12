/**
 * @file src/modules/material/dto/mat-lot.dto.ts
 * @description 자재LOT 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { IQC_STATUS_VALUES, MAT_LOT_STATUS_VALUES } from '@harness/shared';

export class CreateMatLotDto {
  @ApiProperty({ description: 'LOT 번호', example: 'LOT-20260126-001' })
  @IsString()
  @MaxLength(50)
  lotNo: string;

  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiProperty({ description: '초기 수량', example: 1000 })
  @IsInt()
  @Min(0)
  initQty: number;

  @ApiPropertyOptional({ description: '현재 수량' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentQty?: number;

  @ApiPropertyOptional({ description: '입고일' })
  @IsOptional()
  @IsDateString()
  recvDate?: string;

  @ApiPropertyOptional({ description: '유효기한' })
  @IsOptional()
  @IsDateString()
  expireDate?: string;

  @ApiPropertyOptional({ description: '원산지' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  origin?: string;

  @ApiPropertyOptional({ description: '공급업체' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendor?: string;

  @ApiPropertyOptional({ description: '인보이스 번호' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoiceNo?: string;

  @ApiPropertyOptional({ description: 'PO 번호' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  poNo?: string;

  @ApiPropertyOptional({ description: 'IQC 상태', enum: IQC_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...IQC_STATUS_VALUES])
  iqcStatus?: string;

  @ApiPropertyOptional({ description: 'LOT 상태', enum: MAT_LOT_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...MAT_LOT_STATUS_VALUES])
  status?: string;
}

export class UpdateMatLotDto extends PartialType(CreateMatLotDto) {}

export class MatLotQueryDto {
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
  partId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lotNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional({ enum: IQC_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...IQC_STATUS_VALUES])
  iqcStatus?: string;

  @ApiPropertyOptional({ enum: MAT_LOT_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...MAT_LOT_STATUS_VALUES])
  status?: string;
}

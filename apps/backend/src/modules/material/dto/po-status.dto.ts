/**
 * @file src/modules/material/dto/po-status.dto.ts
 * @description PO현황 조회 전용 DTO
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class PoStatusQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CLOSED'] })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CLOSED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

/**
 * @file src/modules/material/dto/mat-lot.dto.ts
 * @description 자재 UID(matUid) 관련 DTO 정의
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsDateString, IsIn, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IQC_STATUS_VALUES, MAT_LOT_STATUS_VALUES } from '@harness/shared';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class CreateMatLotDto {
  @ApiProperty({ description: '자재 UID', example: 'MAT-20260126-001' })
  @IsString()
  @MaxLength(50)
  matUid: string;

  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '초기 수량', example: 1000 })
  @IsInt()
  @Min(0)
  initQty: number;

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

  @ApiProperty({ description: '공급업체' })
  @IsString()
  @MaxLength(100)
  vendor: string;

  @ApiProperty({ description: '인보이스 번호' })
  @IsString()
  @MaxLength(50)
  invoiceNo: string;

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

export class MatLotQueryDto extends PaginationQueryDto {
  /**
   * 재고 있는 LOT만(잔량>0 AND 상태 NORMAL). 목록 화면의 기본 조건 — 조건 없는 전량 조회 금지.
   * 전체(소진·보류 포함)를 보려면 이 플래그를 끄고 입고일 구간(fromDate/toDate)을 함께 보낸다.
   */
  @ApiPropertyOptional({ description: '재고 있는 LOT만 조회(잔량>0, 상태 NORMAL)', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: '입고일(RECV_DATE) 조회 시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '입고일(RECV_DATE) 조회 종료일 (YYYY-MM-DD, 당일 포함)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  matUid?: string;

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

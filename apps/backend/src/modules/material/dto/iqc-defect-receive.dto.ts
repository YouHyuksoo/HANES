/**
 * @file src/modules/material/dto/iqc-defect-receive.dto.ts
 * @description IQC 불합격자재 불량창고 수동입고 DTO
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 입고 대기 목록 조회 */
export class IqcDefectPendingQueryDto {
  @ApiPropertyOptional({ description: '자재 시리얼 / 입하번호 / 품목코드 검색' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/** 불량창고 입고 실행 */
export class IqcDefectReceiveDto {
  @ApiProperty({ description: '입고할 자재 시리얼(MAT_UID) 목록', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  matUids: string[];

  @ApiProperty({ description: '불량창고 코드 (WAREHOUSE_TYPE=DEFECT)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  warehouseCode: string;

  @ApiPropertyOptional({ description: '작업자 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 불량창고 입고 취소 */
export class IqcDefectReceiveCancelDto {
  @ApiProperty({ description: '취소할 입고 트랜잭션 번호' })
  @IsString()
  @IsNotEmpty()
  transNo: string;

  @ApiPropertyOptional({ description: '취소 사유' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 입고 이력 조회 */
export class IqcDefectHistoryQueryDto {
  @ApiPropertyOptional({ description: '조회 시작일 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '조회 종료일 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: '자재 시리얼 / 입하번호 / 품목코드 검색' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

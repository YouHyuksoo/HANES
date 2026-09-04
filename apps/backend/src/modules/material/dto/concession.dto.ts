/**
 * @file src/modules/material/dto/concession.dto.ts
 * @description 특채처리(특별채택) 전용 DTO
 *              - IQC 불합격(FAIL) LOT을 특채 승인하여 양품입고를 허용
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsIn, Matches } from 'class-validator';

/** 특채 대상(FAIL 입하+품목 그룹) 조회 */
export class ConcessionTargetQueryDto {
  @ApiPropertyOptional({ description: '검색어 (입하번호/품목)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: '특채 상태. PENDING(기본, 미지정 포함) = 미특채 그룹만, ACCEPTED = 특채완료 그룹만, ALL = 전체 — ACCEPTED/ALL 은 fromDate/toDate 로 입하일 구간을 한정할 것',
    enum: ['PENDING', 'ACCEPTED', 'ALL'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'ACCEPTED', 'ALL'])
  status?: 'PENDING' | 'ACCEPTED' | 'ALL';

  @ApiPropertyOptional({ description: '입하일 시작 (YYYY-MM-DD, 로컬 날짜)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({ description: '입하일 종료 (YYYY-MM-DD, 로컬 날짜, 당일 포함)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}

/** 특채 처리/취소 (입하번호+품목 그룹 단위) */
export class ApplyConcessionDto {
  @ApiProperty({ description: '입하번호 (ARRIVAL_NO)' })
  @IsString()
  @IsNotEmpty()
  arrivalNo: string;

  @ApiProperty({ description: '품목코드 (ITEM_CODE)' })
  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @ApiPropertyOptional({ description: '특채 사유 (비고)' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: '특채 처리 작업자 코드 (WORKER_MASTERS.WORKER_CODE)' })
  @IsOptional()
  @IsString()
  specialAcceptWorkerCode?: string;
}

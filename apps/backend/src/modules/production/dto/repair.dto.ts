/**
 * @file dto/repair.dto.ts
 * @description 수리관리 DTO - 조회/등록/수정 요청 유효성 검증
 *
 * 초보자 가이드:
 * 1. RepairQueryDto: 목록 조회 필터 (페이징, 상태, 일자 범위 등)
 * 2. CreateRepairUsedPartDto: 사용부품 행 하나
 * 3. CreateRepairDto: 수리 등록 (마스터 + 사용부품 배열)
 * 4. UpdateRepairDto: 수리 수정 (PartialType 상속)
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RepairQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '상태 (RECEIVED, IN_REPAIR, COMPLETED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '수리일자 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  repairDateFrom?: string;

  @ApiPropertyOptional({ description: '수리일자 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  repairDateTo?: string;

  @ApiPropertyOptional({ description: '발생공정' })
  @IsOptional()
  @IsString()
  sourceProcess?: string;

  @ApiPropertyOptional({ description: '수리자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '검색어 (FG바코드, 품목코드, 품목명)' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateRepairUsedPartDto {
  @ApiProperty({ description: '품목코드', example: 'PART-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '품목명' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiPropertyOptional({ description: '제품 고유식별자 (시리얼)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prdUid?: string;

  @ApiPropertyOptional({ description: '사용수량', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class CreateRepairDto {
  @ApiPropertyOptional({ description: '수리일자 (YYYY-MM-DD), 미입력시 오늘' })
  @IsOptional()
  @IsString()
  repairDate?: string;

  @ApiPropertyOptional({ description: 'FG 바코드' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fgBarcode?: string;

  @ApiProperty({ description: '품목코드', example: 'ITEM-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '품목명' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiPropertyOptional({ description: '수량', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional({ description: '제품 고유식별자 (시리얼)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prdUid?: string;

  @ApiPropertyOptional({ description: '발생공정 (ComCode)' })
  @IsOptional()
  @IsString()
  sourceProcess?: string;

  @ApiPropertyOptional({ description: '수리후 투입공정 (ComCode)' })
  @IsOptional()
  @IsString()
  returnProcess?: string;

  @ApiPropertyOptional({ description: '수리결과 (ComCode: REPAIR_RESULT)' })
  @IsOptional()
  @IsString()
  repairResult?: string;

  @ApiPropertyOptional({ description: '진성/가성 (ComCode: DEFECT_GENUINE)' })
  @IsOptional()
  @IsString()
  genuineType?: string;

  @ApiPropertyOptional({ description: '불량유형 (ComCode: DEFECT_TYPE)' })
  @IsOptional()
  @IsString()
  defectType?: string;

  @ApiPropertyOptional({ description: '불량원인 (ComCode: DEFECT_CAUSE)' })
  @IsOptional()
  @IsString()
  defectCause?: string;

  @ApiPropertyOptional({ description: '불량위치 (ComCode: DEFECT_POSITION)' })
  @IsOptional()
  @IsString()
  defectPosition?: string;

  @ApiPropertyOptional({ description: '수리후재처리 (ComCode: REPAIR_DISPOSITION)' })
  @IsOptional()
  @IsString()
  disposition?: string;

  @ApiPropertyOptional({ description: '수리자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '수리 사용부품 목록', type: [CreateRepairUsedPartDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRepairUsedPartDto)
  usedParts?: CreateRepairUsedPartDto[];
}

export class UpdateRepairDto extends PartialType(CreateRepairDto) {}

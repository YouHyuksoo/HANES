/**
 * @file quality/ncr/dto/ncr.dto.ts
 * @description 부적합 보고서(NCR) 요청 규격
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/base-query.dto';

export const NCR_TARGET_TYPES = ['RAW_MATERIAL', 'SEMI_PRODUCT', 'FINISHED', 'WIP'] as const;
export const NCR_FOUND_STAGES = ['IQC', 'PROCESS', 'FINAL', 'OQC', 'CUSTOMER'] as const;
/** 기존 DEFECT_DISPOSITION 4종 + 반품(사급자재 부적합용) */
export const NCR_DISPOSITIONS = ['CONCESSION', 'REPAIR', 'REWORK', 'SCRAP', 'RETURN'] as const;
export const NCR_CAUSE_CATEGORIES = ['MAN', 'MACHINE', 'METHOD', 'MEASUREMENT', 'ENVIRONMENT'] as const;
export const NCR_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const;

export class CreateNcrDto {
  @ApiProperty({ description: '대상구분', enum: NCR_TARGET_TYPES })
  @IsIn([...NCR_TARGET_TYPES])
  targetType: string;

  @ApiProperty({ description: '발견공정', enum: NCR_FOUND_STAGES })
  @IsIn([...NCR_FOUND_STAGES])
  foundStage: string;

  @ApiProperty({ description: '품목코드' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '출처 유형', example: 'IQC_LOG' })
  @IsOptional() @IsString() @MaxLength(30)
  sourceType?: string;

  @ApiPropertyOptional({ description: '출처 식별자' })
  @IsOptional() @IsString() @MaxLength(100)
  sourceId?: string;

  @ApiPropertyOptional({ description: '회신 요구일 (YYYY-MM-DD)' })
  @IsOptional() @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) issueDept?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) writerCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) lotNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) serialNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) orderNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) poNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) vendorCode?: string;

  @ApiPropertyOptional({ description: '검사수량' })
  @IsOptional() @IsNumber() @Min(0)
  inspectQty?: number;

  @ApiPropertyOptional({ description: '불량수량' })
  @IsOptional() @IsNumber() @Min(0)
  defectQty?: number;

  @ApiPropertyOptional({ description: '불량코드' })
  @IsOptional() @IsString() @MaxLength(50) defectCode?: string;
  @ApiPropertyOptional({ description: '불량분류' })
  @IsOptional() @IsString() @MaxLength(50) categoryCode?: string;
  @ApiPropertyOptional({ description: '결함구분', enum: ['CRITICAL', 'MAJOR', 'MINOR'] })
  @IsOptional() @IsIn(['CRITICAL', 'MAJOR', 'MINOR']) defectGrade?: string;

  @ApiPropertyOptional({ description: '부적합 현상 기술' })
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remark?: string;
}

export class UpdateNcrDto extends PartialType(CreateNcrDto) {}

/** 처리방안 확정 — 담당자·기한과 함께 지정한다 */
export class NcrDispositionDto {
  @ApiProperty({ description: '처리방안', enum: NCR_DISPOSITIONS })
  @IsIn([...NCR_DISPOSITIONS])
  disposition: string;

  @ApiPropertyOptional({ description: '세부내용 및 사유' })
  @IsOptional() @IsString() @MaxLength(2000) dispositionDetail?: string;

  @ApiPropertyOptional({ description: '처리기한 (YYYY-MM-DD)' })
  @IsOptional() @IsDateString() dueActionDate?: string;

  @ApiPropertyOptional({ description: '처리 책임자' })
  @IsOptional() @IsString() @MaxLength(50) responsibleCode?: string;
}

/** 원인분석·재발방지 */
export class NcrCauseDto {
  @ApiPropertyOptional({ description: '원인분류(4M1E)', enum: NCR_CAUSE_CATEGORIES })
  @IsOptional() @IsIn([...NCR_CAUSE_CATEGORIES]) causeCategory?: string;

  @ApiPropertyOptional({ description: '발생 원인' })
  @IsOptional() @IsString() @MaxLength(2000) rootCause?: string;

  @ApiPropertyOptional({ description: '재발방지 대책' })
  @IsOptional() @IsString() @MaxLength(2000) preventiveAction?: string;
}

/** 종결 — 승인자 기록과 함께 닫는다 */
export class CloseNcrDto {
  @ApiProperty({ description: '승인자' })
  @IsString() @MaxLength(50)
  approverCode: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional() @IsString() @MaxLength(1000) remark?: string;
}

export class NcrQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '발행일 시작 (YYYY-MM-DD)' })
  @IsOptional() @IsDateString() fromDate?: string;

  @ApiPropertyOptional({ description: '발행일 종료 (YYYY-MM-DD)' })
  @IsOptional() @IsDateString() toDate?: string;

  @ApiPropertyOptional({ enum: NCR_TARGET_TYPES })
  @IsOptional() @IsString() targetType?: string;

  @ApiPropertyOptional({ enum: NCR_FOUND_STAGES })
  @IsOptional() @IsString() foundStage?: string;

  @ApiPropertyOptional({ enum: ['CRITICAL', 'MAJOR', 'MINOR'] })
  @IsOptional() @IsString() defectGrade?: string;

  @ApiPropertyOptional({ enum: NCR_STATUSES })
  @IsOptional() @IsString() status?: string;

  @ApiPropertyOptional({ description: 'NCR번호·품목·로트·작업지시 검색' })
  @IsOptional() @IsString() search?: string;
}

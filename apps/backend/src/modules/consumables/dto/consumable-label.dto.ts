/**
 * @file consumable-label.dto.ts
 * @description 소모품 라벨 발행 / 입고 확정 요청·응답 DTO
 *
 * 초보자 가이드:
 * 1. CreateConLabelsDto: 마스터 선택 → qty만큼 conUid 채번 요청
 * 2. ConfirmConReceivingDto: 바코드 스캔 → 단건 입고 확정 요청
 * 3. BulkConfirmConReceivingDto: 다건 입고 확정 요청
 */
import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

/** conUid 채번 + PENDING 생성 요청 */
export class CreateConLabelsDto {
  @IsString()
  consumableCode: string;

  @IsInt()
  @Min(1)
  @Max(999)
  qty: number;

  @IsOptional()
  @IsString()
  vendorCode?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  unitPrice?: number;
}

/** 단건 입고 확정 (바코드 스캔) */
export class ConfirmConReceivingDto {
  @IsString()
  conUid: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

/** 다건 입고 확정 */
export class BulkConfirmConReceivingDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  conUids: string[];

  @IsOptional()
  @IsString()
  location?: string;
}

/** 라벨 생성 결과 응답 */
export class ConLabelResultDto {
  conUid: string;
  consumableCode: string;
  consumableName: string;
}

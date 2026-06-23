/**
 * @file src/modules/production/dto/subprocess-kitting.dto.ts
 * @description 서브공정 키팅 DTO — 완제품 작업지시의 서브공정에서 스캔된 반제품 묶음(SG_LABELS)을
 *              소비해 제품라벨(FG_LABELS)을 발행하고 genealogy를 남긴다.
 *              조립 2단계 API(issueLabel/confirmAssembly) DTO 포함.
 */
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsNotEmpty,
  ValidateNested,
  Min,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 원자재 직접투입 로트(genealogy 기록 전용 — 재고 차감은 Phase 2 범위 밖) */
export class KitMatLotDto {
  @IsString()
  matUid: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;
}

export class KitDto {
  @IsString()
  orderNo: string;

  @IsString()
  processCode: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sgBarcodes: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KitMatLotDto)
  matLots?: KitMatLotDto[];

  @IsOptional()
  @IsString()
  equipCode?: string;

  @IsOptional()
  @IsString()
  circuitNo?: string;
}

/** 조립 라벨 발행 DTO (② FG 바코드 채번 + ISSUED 저장만) */
export class IssueLabelDto {
  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @IsString()
  @IsNotEmpty()
  equipCode: string;
}

/** 조립 확정 DTO (③ 실물 FG 라벨 스캔 → 단일 트랜잭션 확정) */
export class ConfirmAssemblyDto {
  @IsString()
  @IsNotEmpty()
  fgBarcode: string;

  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @IsString()
  @IsNotEmpty()
  equipCode: string;

  @IsString()
  @IsNotEmpty()
  processCode: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sgBarcodes: string[];

  @IsOptional()
  @IsString()
  circuitNo?: string;
}

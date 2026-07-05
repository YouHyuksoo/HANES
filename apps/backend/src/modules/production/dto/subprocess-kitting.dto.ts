/**
 * @file src/modules/production/dto/subprocess-kitting.dto.ts
 * @description 서브공정 키팅 DTO — 완제품 작업지시의 서브공정에서 스캔된 반제품 묶음(SG_LABELS)을
 *              소비해 제품라벨(FG_LABELS)을 발행하고 genealogy를 남긴다.
 *              조립 2단계 API(issueLabel/confirmAssembly) DTO 포함.
 */
import {
  IsString,
  IsOptional,
  IsArray,
  IsNotEmpty,
  ArrayNotEmpty,
  IsInt,
  Min,
} from 'class-validator';


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

/**
 * 서브공정 키팅 SFG 라벨 발행 DTO (② 새 SFG 바코드 채번 + ISSUED 저장만).
 * 이전 공정 SG → 새 SFG 1장 발행. 입력 SG 소비·자재·실적·재고는 미반영.
 * 회로(circuitNo)는 발행 단계에서 SG에 영속화되지 않으므로 받지 않는다.
 * 회로 추적은 confirm-subkit 단계의 genealogy(PRODUCT_GENEALOGY.CIRCUIT_NO)로 일원화한다.
 */
export class IssueSgLabelDto {
  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @IsString()
  @IsNotEmpty()
  processCode: string;

  @IsOptional()
  @IsString()
  equipCode?: string;
}

/**
 * 서브공정 키팅 확정 DTO (③ 실물 새 SFG 라벨 스캔 → 단일 트랜잭션 확정).
 * 입력 SG 소비 + genealogy(SG←SG, SG←MAT_LOT) + 설비자재 차감 + 새 SFG IN_STOCK 승격 + 실적 + WIP.
 */
export class ConfirmSubKitDto {
  @IsString()
  @IsNotEmpty()
  newSgBarcode: string;

  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @IsString()
  @IsNotEmpty()
  processCode: string;

  @IsOptional()
  @IsString()
  equipCode?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  inputSgBarcodes: string[];

  @IsOptional()
  @IsString()
  circuitNo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  goodQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defectQty?: number;
}

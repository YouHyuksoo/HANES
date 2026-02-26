/**
 * @file product-label.dto.ts
 * @description 제품 라벨 발행(prdUid 채번) 요청/응답 DTO
 *
 * 초보자 가이드:
 * 1. CreatePrdLabelsDto: 생산실적/OQC PASS 건에서 prdUid 채번 요청
 * 2. source: 발행 경로 (PROD_RESULT: 생산실적, OQC_PASS: 통전검사 합격)
 * 3. qty: 발행 수량 (= prdUid 채번 수, 각 qty=1)
 */
import { IsInt, Min, Max, IsString, IsEnum } from 'class-validator';

export enum LabelSource {
  PROD_RESULT = 'PROD_RESULT',
  OQC_PASS = 'OQC_PASS',
}

export class CreatePrdLabelsDto {
  @IsInt()
  sourceId: number;

  @IsEnum(LabelSource)
  source: LabelSource;

  @IsInt()
  @Min(1)
  @Max(999)
  qty: number;
}

export class PrdLabelResultDto {
  prdUid: string;
  itemCode: string;
  itemName: string;
}

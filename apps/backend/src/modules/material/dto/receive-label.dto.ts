/**
 * @file receive-label.dto.ts
 * @description 자재 라벨 발행(matUid 채번) 요청/응답 DTO
 *
 * 초보자 가이드:
 * 1. CreateMatLabelsDto: IQC PASS 입하건에서 matUid 채번 + MatLot 생성 요청
 * 2. arrivalId: 입하 레코드 ID
 * 3. qty: 발행 수량 (= matUid 채번 수, 각 qty=1)
 */
import { IsInt, Min, Max, IsOptional, IsString } from 'class-validator';

export class CreateMatLabelsDto {
  @IsInt()
  arrivalId: number;

  @IsInt()
  @Min(1)
  @Max(999)
  qty: number;

  @IsOptional()
  @IsString()
  supUid?: string;
}

export class MatLabelResultDto {
  matUid: string;
  itemCode: string;
  itemName: string;
  supUid: string | null;
}

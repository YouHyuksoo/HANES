/**
 * @file dto/job-material-lot.dto.ts
 * @description 자재 롯트 스캔 등록/조회 DTO
 *
 * 초보자 가이드:
 * - RegisterMaterialLotDto: 직접 등록 시 사용
 * - ScanBarcodeDto: 바코드 스캔 후 자동 BOM 매칭 시 사용
 */
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class RegisterMaterialLotDto {
  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @IsNumber()
  seq: number;

  @IsString()
  @IsNotEmpty()
  matUid: string;

  @IsNumber()
  @IsOptional()
  initQty?: number;

  @IsString()
  @IsOptional()
  scannedBy?: string;
}

export class ScanBarcodeDto {
  @IsString()
  @IsNotEmpty()
  matUid: string;

  @IsString()
  @IsOptional()
  scannedBy?: string;
}

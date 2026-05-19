/**
 * @file dto/job-material-lot.dto.ts
 * @description 자재 롯트 스캔 등록/조회 DTO
 *
 * 초보자 가이드:
 * - RegisterMaterialLotDto: 직접 등록 시 사용
 * - ScanBarcodeDto: 바코드 스캔 후 자동 BOM 매칭 시 사용
 * - BomItemRefDto: 스캔 요청 시 BOM 항목 참조용
 * - ScanRequestDto: 바코드 스캔 요청 본문 (BomItemRefDto 배열 포함)
 */
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class BomItemRefDto {
  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @IsNumber()
  seq: number;
}

export class ScanRequestDto {
  @IsString()
  @IsNotEmpty()
  matUid: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomItemRefDto)
  bomItems: BomItemRefDto[];

  @IsString()
  @IsOptional()
  scannedBy?: string;
}

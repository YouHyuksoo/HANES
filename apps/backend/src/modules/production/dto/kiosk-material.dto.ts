/**
 * @file src/modules/production/dto/kiosk-material.dto.ts
 * @description 키오스크 자재 설비 장착 DTO
 */
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/** 바코드(matUid) 스캔 — 자재 LOT 설비 장착 */
export class ScanMaterialMountDto {
  @IsString()
  @IsNotEmpty()
  matUid: string;

  /** 장착 대상 설비(미지정 시 작업지시 설비 사용) */
  @IsString()
  @IsOptional()
  equipCode?: string;
}

/**
 * @file src/modules/production/dto/equip-material.dto.ts
 * @description 설비 자재 장착/해제 DTO
 */
import { IsString } from 'class-validator';

export class MountMaterialDto {
  @IsString()
  equipCode: string;

  @IsString()
  matUid: string;
}

export class UnmountMaterialDto {
  @IsString()
  equipCode: string;

  @IsString()
  matUid: string;
}

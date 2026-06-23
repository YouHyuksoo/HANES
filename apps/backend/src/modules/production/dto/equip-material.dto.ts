/**
 * @file src/modules/production/dto/equip-material.dto.ts
 * @description 설비 자재 장착/해제 DTO
 */
import { IsString, IsNotEmpty } from 'class-validator';

export class MountMaterialDto {
  @IsString()
  @IsNotEmpty()
  equipCode: string;

  @IsString()
  @IsNotEmpty()
  matUid: string;
}

export class UnmountMaterialDto {
  @IsString()
  @IsNotEmpty()
  equipCode: string;

  @IsString()
  @IsNotEmpty()
  matUid: string;
}

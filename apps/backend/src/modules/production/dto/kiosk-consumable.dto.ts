/**
 * @file dto/kiosk-consumable.dto.ts
 * @description 키오스크 소모품 스캔 장착 DTO
 */
import { IsString, IsNotEmpty } from 'class-validator';

export class ScanConsumableMountDto {
  @IsString()
  @IsNotEmpty()
  conUid: string;
}

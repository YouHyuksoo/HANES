/**
 * @file dto/kiosk-consumable.dto.ts
 * @description 키오스크 소모품 스캔 장착 DTO
 */
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ScanConsumableMountDto {
  @IsString()
  @IsNotEmpty()
  conUid: string;

  /**
   * 장착 대상 설비 override (선택).
   * 미지정 시 작업지시 설비(jobOrder.equipCode)를 사용한다(키오스크 기존 동작).
   * 검사 화면처럼 작업지시 생산설비가 아닌 별도 설비(검사기)에 장착할 때 사용.
   */
  @IsOptional()
  @IsString()
  equipCode?: string;
}

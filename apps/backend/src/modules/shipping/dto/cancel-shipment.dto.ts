import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/** 출하지시 단위 출하취소 요청 */
export class CancelOrderShipmentDto {
  /** 취소 사유 (취소이력에 기록) */
  @IsString()
  @IsNotEmpty()
  reason: string;

  /** 작업자 ID (재고 거래/취소이력 기록용) */
  @IsOptional()
  @IsString()
  workerId?: string;
}

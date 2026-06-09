import { IsString, IsOptional } from 'class-validator';

/** 출하지시 기반 박스 단건 출하 요청 */
export class ShipBoxDto {
  /** 출하할 박스 번호 (스캔값) */
  @IsString()
  boxNo: string;

  /** 작업자 ID (PDA: 작업자 QR, 웹: 로그인 사용자) */
  @IsOptional()
  @IsString()
  workerId?: string;
}

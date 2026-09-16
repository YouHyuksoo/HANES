/**
 * @file src/modules/equipment/dto/equip-stop.dto.ts
 * @description 설비정지 / 관리자호출 DTO
 *
 * 초보자 가이드:
 * 1. **StartEquipStopDto**: 정지 시작. stopReason은 선택 — 비우면 "사유미정"으로 등록된다.
 * 2. **UpdateEquipStopReasonDto**: 사유미정으로 시작한 정지의 사유를 나중에 확정한다.
 * 3. **ReleaseEquipStopDto**: 해제. 사유가 확정돼 있지 않으면 서버가 400으로 막는다.
 * 4. 시각(정지/해제)은 클라이언트가 보내지 않는다. 서버 SYSTIMESTAMP가 단일 출처다.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

/** 설비정지 시작 */
export class StartEquipStopDto {
  @ApiProperty({ description: '설비코드', example: 'EQ-CRIMP-01' })
  @IsString()
  @MaxLength(50)
  equipCode: string;

  @ApiPropertyOptional({ description: '정지 시점 작업지시번호' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  jobOrderNo?: string;

  @ApiPropertyOptional({ description: '정지사유 코드(COM_CODES.EQUIP_STOP_REASON). 비우면 사유미정' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  stopReason?: string;

  @ApiPropertyOptional({ description: '정지 비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  stopRemark?: string;
}

/** 정지사유 확정/변경 */
export class UpdateEquipStopReasonDto {
  @ApiProperty({ description: '정지사유 코드(COM_CODES.EQUIP_STOP_REASON)' })
  @IsString()
  @MaxLength(50)
  stopReason: string;

  @ApiPropertyOptional({ description: '정지 비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  stopRemark?: string;
}

/** 설비정지 해제 */
export class ReleaseEquipStopDto {
  @ApiPropertyOptional({ description: '해제 시점에 사유를 확정하는 경우 함께 보낸다' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  stopReason?: string;

  @ApiPropertyOptional({ description: '조치 내용' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  releaseRemark?: string;
}

/** 관리자호출 등록 */
export class CreateEquipCallDto {
  @ApiProperty({ description: '설비코드' })
  @IsString()
  @MaxLength(50)
  equipCode: string;

  @ApiPropertyOptional({ description: '호출 시점 작업지시번호' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  jobOrderNo?: string;

  @ApiProperty({ description: '호출유형 코드(COM_CODES.EQUIP_CALL_TYPE)' })
  @IsString()
  @MaxLength(50)
  callType: string;

  @ApiPropertyOptional({ description: '호출 내용' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  callRemark?: string;
}

/** 관리자호출 응대 */
export class AckEquipCallDto {
  @ApiPropertyOptional({ description: '응대 내용' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ackRemark?: string;
}

/** 정지 이벤트 응답 */
export interface EquipStopEventView {
  stopId: number;
  equipCode: string;
  jobOrderNo: string | null;
  stopReason: string | null;
  stopRemark: string | null;
  status: 'OPEN' | 'CLOSED';
  startedAt: string;
  startedBy: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  releaseRemark: string | null;
  /** 해제된 정지는 확정된 유실시간, 진행중이면 서버 기준 현재까지의 경과초 */
  lossSeconds: number;
}

/** 정지 이력 집계 */
export interface EquipStopSummary {
  stopCount: number;
  totalLossSeconds: number;
  openCount: number;
}

/** 관리자호출 응답 */
export interface EquipCallEventView {
  callId: number;
  equipCode: string;
  jobOrderNo: string | null;
  callType: string;
  callRemark: string | null;
  status: 'OPEN' | 'ACKED';
  calledAt: string;
  calledBy: string | null;
  ackedAt: string | null;
  ackedBy: string | null;
  ackRemark: string | null;
  /** 호출 후 경과초(응대되면 호출~응대 소요초) */
  elapsedSeconds: number;
}

/**
 * @file src/modules/quality/continuity-inspect/dto/continuity-inspect.dto.ts
 * @description 통전검사 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. ContinuityInspectDto: 통전검사 결과 등록 시 필요한 필드
 * 2. VoidLabelDto: FG 라벨 취소 시 사유 입력
 * 3. passYn='Y' → FG_BARCODE 자동 채번, 'N' → 불량 기록만
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsInt, IsIn, Min, MaxLength, ValidateNested } from 'class-validator';

/**
 * 통전검사 결과 등록 DTO
 */
export class ContinuityInspectDto {
  @ApiProperty({ description: '작업지시 번호', example: 'JO-20260316-001' })
  @IsString()
  @MaxLength(50)
  orderNo: string;

  @ApiProperty({ description: '품목 코드', example: 'ITEM-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '설비 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerId?: string;

  @ApiPropertyOptional({ description: '라인 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiProperty({ description: '합격 여부', enum: ['Y', 'N'] })
  @IsString()
  passYn: string;

  @ApiPropertyOptional({ description: '검사 유형', enum: ['CONTINUITY', 'TERMINAL'], default: 'CONTINUITY' })
  @IsOptional()
  @IsString()
  @IsIn(['CONTINUITY', 'TERMINAL'])
  inspectType?: string;

  @ApiPropertyOptional({ description: '불량 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  errorCode?: string;

  @ApiPropertyOptional({ description: '불량 상세', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorDetail?: string;

  @ApiPropertyOptional({ description: 'FG 바코드 (ON_PRODUCTION/PRE_ISSUE 모드에서 스캔값)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  fgBarcode?: string;

  @ApiPropertyOptional({ description: '회로라벨 (설비 출력 바코드, 스캔 모드 PASS 시 필수)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  circuitLabel?: string;

  @ApiPropertyOptional({ description: '?곌껐???앹궛?ㅼ쟻 踰덊샇' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  prodResultNo?: string;
}

/**
 * 장비 자동검사 DTO
 */
export class AutoInspectDto {
  @ApiProperty({ description: '프로토콜 ID (EQUIP_PROTOCOLS.PROTOCOL_ID)', example: 'CONT-01' })
  @IsString()
  @MaxLength(30)
  protocolId: string;

  @ApiProperty({ description: '작업지시번호', example: 'JO-20260316-001' })
  @IsString()
  @MaxLength(50)
  orderNo: string;

  @ApiProperty({ description: '품목코드', example: 'ITEM-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '장비에서 수신한 raw 데이터 (시리얼/TCP에서 받은 문자열)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rawData?: string;

  @ApiPropertyOptional({ description: '이미 파싱된 결과 (JSON HTTP 방식)', enum: ['PASS', 'FAIL'] })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  result?: string;

  @ApiPropertyOptional({ description: '에러코드 (파싱된 경우)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  errorCode?: string;

  @ApiPropertyOptional({ description: '설비코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업자' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerId?: string;

  @ApiPropertyOptional({ description: '라인코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;
}

/**
 * 재검사 DTO
 */
export class ReInspectDto {
  @ApiProperty({ description: '재검사 결과', enum: ['Y', 'N'] })
  @IsString()
  @IsIn(['Y', 'N'])
  passYn: string;

  @ApiPropertyOptional({ description: '불량코드' })
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * FG 라벨 취소 DTO
 */
export class VoidLabelDto {
  @ApiProperty({ description: '취소 사유', example: '라벨 인쇄 오류' })
  @IsString()
  @MaxLength(200)
  reason: string;
}

export class CreateEquipProtocolDto {
  @ApiProperty({ description: '프로토콜 ID' })
  @IsString()
  @MaxLength(30)
  protocolId: string;

  @ApiPropertyOptional({ description: '설비 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;

  @ApiProperty({ description: '프로토콜명' })
  @IsString()
  @MaxLength(100)
  protocolName: string;

  @ApiPropertyOptional({ description: '통신 유형', default: 'SERIAL' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  commType?: string;

  @ApiPropertyOptional({ description: '구분자', default: ',' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  delimiter?: string;

  @ApiPropertyOptional({ description: '결과 위치 index', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  resultIndex?: number;

  @ApiPropertyOptional({ description: '합격 값', default: 'PASS' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  passValue?: string;

  @ApiPropertyOptional({ description: '불합격 값', default: 'FAIL' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  failValue?: string;

  @ApiPropertyOptional({ description: '에러 위치 index' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  errorIndex?: number;

  @ApiPropertyOptional({ description: '데이터 시작 문자' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  dataStartChar?: string;

  @ApiPropertyOptional({ description: '데이터 종료 문자' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  dataEndChar?: string;

  @ApiPropertyOptional({ description: '샘플 데이터' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sampleData?: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateEquipProtocolDto extends PartialType(CreateEquipProtocolDto) {}

/**
 * 통합검사 한 스텝의 결과 (회로/리크/내전압/구조)
 */
export class IntegratedInspectStepDto {
  @ApiProperty({
    description: '검사 유형',
    enum: ['CONTINUITY', 'LEAK', 'HIPOT', 'STRUCTURE'],
  })
  @IsString()
  @IsIn(['CONTINUITY', 'LEAK', 'HIPOT', 'STRUCTURE'])
  inspectType: string;

  @ApiProperty({ description: '합격 여부', enum: ['Y', 'N'] })
  @IsString()
  @IsIn(['Y', 'N'])
  passYn: string;

  @ApiPropertyOptional({ description: '불량 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  errorCode?: string;

  @ApiPropertyOptional({ description: '불량 상세', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorDetail?: string;

  @ApiPropertyOptional({ description: '검사 데이터 (JSON string)' })
  @IsOptional()
  @IsString()
  inspectData?: string;
}

/**
 * 통합검사 DTO — 회로/리크/내전압/구조 4개 검사를 한 번에 제출
 * ALL PASS 시 FG_BARCODE 발행, 하나라도 FAIL이면 종합 FAIL(미발행)
 */
export class IntegratedInspectDto {
  @ApiProperty({ description: '작업지시 번호', example: 'JO-20260316-001' })
  @IsString()
  @MaxLength(50)
  orderNo: string;

  @ApiProperty({ description: '품목 코드', example: 'ITEM-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '설비 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerId?: string;

  @ApiPropertyOptional({ description: '라인 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiProperty({
    description: '검사 스텝별 결과 (최대 4개)',
    type: [IntegratedInspectStepDto],
  })
  @ValidateNested({ each: true })
  @Type(() => IntegratedInspectStepDto)
  steps: IntegratedInspectStepDto[];
}

/**
 * 통합검사 응답 DTO
 */
export class IntegratedInspectResponseDto {
  @ApiProperty({ description: '종합 합격 여부 (ALL PASS=true)' })
  overallPass: boolean;

  @ApiProperty({ description: '발행된 FG 바코드 (전체 합격 시만 존재)', nullable: true })
  fgBarcode: string | null;

  @ApiProperty({ description: '생성된 검사실적 ID 목록' })
  inspectResultIds: string[];

  @ApiProperty({ description: '스텝별 결과 요약' })
  stepResults: Array<{
    inspectType: string;
    passYn: string;
    resultNo: string;
  }>;
}

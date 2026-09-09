/**
 * @file measurement.controller.ts
 * @description 계측기 수치 수신 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **POST /api/v1/quality/measurements**: 압착고·인장력 게이지 등 계측기 측정값 수신
 *    - values 직접 전송 또는 protocolId + rawData(EQUIP_PROTOCOLS 파서) 전송
 *    - 활성 SPC 관리도(품목/공정/특성)에 서브그룹으로 적재
 * 2. **인증**: JwtAuthGuard 는 APP_GUARD 전역 등록. @Company()/@Plant() 로 테넌시 추출
 * 3. **403**: sys-config MEASURE_RECEIVE_ENABLED 가 'Y'가 아닐 때
 * 4. **404**: 해당 특성의 ACTIVE 관리도가 없을 때
 */
import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { MeasurementService } from '../services/measurement.service';
import { ReceiveMeasurementDto } from '../dto/measurement.dto';

@ApiTags('SPC')
@Controller('quality/measurements')
export class MeasurementController {
  constructor(private readonly measurementService: MeasurementService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '계측기 측정값 수신',
    description: '활성 SPC 관리도(품목/공정/특성)에 서브그룹으로 적재. rawData+protocolId 면 프로토콜 파서로 수치 추출',
  })
  @ApiResponse({ status: 201, description: '적재 성공' })
  @ApiResponse({ status: 403, description: '계측기 수신 비활성화 (MEASURE_RECEIVE_ENABLED)' })
  @ApiResponse({ status: 404, description: '해당 특성의 SPC 관리도 없음' })
  async receive(
    @Body() dto: ReceiveMeasurementDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.measurementService.receive(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(result, '측정값이 수신되었습니다.');
  }
}

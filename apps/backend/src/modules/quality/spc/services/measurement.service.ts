/**
 * @file measurement.service.ts
 * @description 계측기 수치 수신 서비스 — 측정값을 활성 SPC 관리도 서브그룹으로 적재
 *
 * 초보자 가이드:
 * 1. sys-config MEASURE_RECEIVE_ENABLED(QUALITY, BOOLEAN) 가 'Y'가 아니면 403.
 * 2. rawData+protocolId 가 오면 EQUIP_PROTOCOLS 의 valueIndex 로 수치를 파싱해 values 를 만든다.
 * 3. (itemCode, processCode, characteristicName, STATUS=ACTIVE) 관리도가 없으면 404.
 * 4. 서브그룹 번호는 해당 관리도의 마지막 subgroupNo + 1 (SPC_DATA PK 는 SEQ_SPC_DATA 가 채번).
 * 5. 적재는 SpcService.createData() 재사용. 수신 흔적은 SPC_DATA.REMARK 에
 *    `source=DEVICE protocol={id} equip={code}` 스탬프로 남긴다(별도 로그 테이블 없음).
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpcChart } from '../../../../entities/spc-chart.entity';
import { SpcData } from '../../../../entities/spc-data.entity';
import { EquipProtocol } from '../../../../entities/equip-protocol.entity';
import { SysConfigService } from '../../../system/services/sys-config.service';
import { parseProtocolData } from '../../continuity-inspect/services/protocol-parser';
import { SpcService } from './spc.service';
import { ReceiveMeasurementDto } from '../dto/measurement.dto';

export const MEASURE_RECEIVE_ENABLED_KEY = 'MEASURE_RECEIVE_ENABLED';

export interface MeasurementReceiveResult {
  chartNo: string;
  subgroupNo: number;
  values: number[];
  valueUnit: string | null;
  data: SpcData;
}

@Injectable()
export class MeasurementService {
  private readonly logger = new Logger(MeasurementService.name);

  constructor(
    @InjectRepository(SpcChart)
    private readonly chartRepo: Repository<SpcChart>,
    @InjectRepository(SpcData)
    private readonly dataRepo: Repository<SpcData>,
    @InjectRepository(EquipProtocol)
    private readonly protocolRepo: Repository<EquipProtocol>,
    private readonly spcService: SpcService,
    private readonly sysConfig: SysConfigService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  /**
   * 계측기 측정값 수신 → 활성 관리도 서브그룹 적재
   */
  async receive(
    dto: ReceiveMeasurementDto,
    company: string,
    plant: string,
    userId: string,
  ): Promise<MeasurementReceiveResult> {
    const enabled = await this.sysConfig.isEnabled(MEASURE_RECEIVE_ENABLED_KEY, company, plant);
    if (!enabled) {
      throw new ForbiddenException('계측기 수신이 비활성화되어 있습니다.');
    }

    const { values, protocol } = await this.resolveValues(dto, company, plant);

    const chart = await this.chartRepo.findOne({
      where: {
        itemCode: dto.itemCode,
        processCode: dto.processCode,
        characteristicName: dto.characteristicName,
        status: 'ACTIVE',
        ...this.tenantWhere(company, plant),
      },
    });
    if (!chart) {
      throw new NotFoundException('해당 특성의 SPC 관리도가 없습니다.');
    }

    const subgroupNo = await this.nextSubgroupNo(chart.chartNo);
    const equipCode = dto.equipCode ?? protocol?.equipCode ?? undefined;
    const remarkParts = [
      'source=DEVICE',
      `protocol=${dto.protocolId ?? '-'}`,
      `equip=${equipCode ?? '-'}`,
    ];
    if (dto.orderNo) remarkParts.push(`order=${dto.orderNo}`);

    const data = await this.spcService.createData(
      {
        chartId: chart.chartNo,
        sampleDate: dto.sampleDate ?? new Date().toISOString(),
        subgroupNo,
        values,
        ...(equipCode ? { equipCode } : {}),
        remark: remarkParts.join(' '),
      },
      company,
      plant,
      userId,
    );

    this.logger.log(
      `계측기 수신 적재: chart=${chart.chartNo} subgroup=${subgroupNo} values=${JSON.stringify(values)} protocol=${dto.protocolId ?? '-'}`,
    );

    return {
      chartNo: chart.chartNo,
      subgroupNo,
      values,
      valueUnit: protocol?.valueUnit ?? null,
      data,
    };
  }

  /**
   * values 직접 수신 또는 rawData+protocolId 파싱
   */
  private async resolveValues(
    dto: ReceiveMeasurementDto,
    company: string,
    plant: string,
  ): Promise<{ values: number[]; protocol: EquipProtocol | null }> {
    if (dto.rawData && dto.protocolId) {
      const protocol = await this.protocolRepo.findOne({
        where: { protocolId: dto.protocolId, useYn: 'Y', ...this.tenantWhere(company, plant) },
      });
      if (!protocol) {
        throw new NotFoundException(`프로토콜을 찾을 수 없습니다: ${dto.protocolId}`);
      }
      if (protocol.valueIndex == null) {
        throw new BadRequestException(
          `프로토콜(${dto.protocolId})에 수치 위치(valueIndex)가 설정되어 있지 않습니다.`,
        );
      }
      const parsed = parseProtocolData(dto.rawData, protocol);
      if (parsed.measuredValue === null) {
        throw new BadRequestException(
          `수치 파싱 실패: rawData="${dto.rawData}" valueIndex=${protocol.valueIndex}`,
        );
      }
      return { values: [parsed.measuredValue], protocol };
    }

    if (dto.rawData || dto.protocolId) {
      throw new BadRequestException('rawData 파싱에는 protocolId 와 rawData 가 모두 필요합니다.');
    }
    if (!dto.values || dto.values.length === 0) {
      throw new BadRequestException('values 또는 protocolId+rawData 중 하나는 필수입니다.');
    }
    return { values: dto.values, protocol: null };
  }

  /** 관리도 내 다음 서브그룹 번호 (마지막 subgroupNo + 1, 없으면 1) */
  private async nextSubgroupNo(chartNo: string): Promise<number> {
    const last = await this.dataRepo.findOne({
      where: { chartId: chartNo },
      order: { subgroupNo: 'DESC' },
      select: { chartId: true, sampleDate: true, seq: true, subgroupNo: true },
    });
    return (last?.subgroupNo ?? 0) + 1;
  }
}

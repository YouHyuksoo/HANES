/**
 * @file msa.service.ts
 * @description MSA(측정시스템분석) 서비스 — IATF 16949 7.1.5
 *
 * 초보자 가이드:
 * 1. **계측기 CRUD**: 등록, 조회, 수정, 삭제
 * 2. **교정 이력 CRUD**: 등록(자동채번 CAL-YYYYMMDD-NNN), 조회, 삭제
 * 3. **교정 만료 예정 조회**: getExpiringSoon(days) — N일 이내 교정 만료 계측기 조회
 * 4. **상태 일괄 갱신**: updateCalibrationStatus() — 교정 만료된 계측기 상태를 EXPIRED로 변경
 *
 * 주요 메서드:
 * - Gauge: findAllGauges(), findGaugeById(), createGauge(), updateGauge(), deleteGauge()
 * - Calibration: findAllCalibrations(), createCalibration(), deleteCalibration()
 * - getExpiringSoon(days): 교정 만료 예정 계측기
 * - updateCalibrationStatus(): 만료 상태 일괴 갱신
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { GaugeMaster } from '../../../../entities/gauge-master.entity';
import { CalibrationLog } from '../../../../entities/calibration-log.entity';
import { parseDateStart } from '../../../../shared/date.util';
import {
  CreateGaugeDto,
  UpdateGaugeDto,
  GaugeFilterDto,
  CreateCalibrationDto,
  CalibrationFilterDto,
} from '../dto/msa.dto';

@Injectable()
export class MsaService {
  private readonly logger = new Logger(MsaService.name);

  constructor(
    @InjectRepository(GaugeMaster)
    private readonly gaugeRepo: Repository<GaugeMaster>,
    @InjectRepository(CalibrationLog)
    private readonly calRepo: Repository<CalibrationLog>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  // =============================================
  // 교정번호 자동채번
  // =============================================

  /**
   * 교정번호 자동채번: CAL-YYYYMMDD-NNN
   */
  private async generateCalibrationNo(
    company: string,
    plant: string,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CAL-${dateStr}-`;

    const last = await this.calRepo
      .createQueryBuilder('c')
      .where('c.company = :company', { company })
      .andWhere('c.plant = :plant', { plant })
      .andWhere('c.calibrationNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.calibrationNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.calibrationNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // =============================================
  // 계측기 마스터 CRUD
  // =============================================

  /**
   * 계측기 목록 조회 (페이지네이션 + 필터)
   */
  async findAllGauges(
    query: GaugeFilterDto,
    company?: string,
    plant?: string,
  ) {
    const { page = 1, limit = 50, status, gaugeType, search } = query;

    const qb = this.gaugeRepo.createQueryBuilder('g');

    if (company) qb.andWhere('g.company = :company', { company });
    if (plant) qb.andWhere('g.plant = :plant', { plant });
    if (status) qb.andWhere('g.status = :status', { status });
    if (gaugeType) qb.andWhere('g.gaugeType = :gaugeType', { gaugeType });
    if (search) {
      qb.andWhere(
        '(UPPER(g.gaugeCode) LIKE UPPER(:s) OR UPPER(g.gaugeName) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }

    qb.orderBy('g.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 계측기 단건 조회
   */
  async findGaugeById(gaugeCode: string, company?: string, plant?: string) {
    const item = await this.gaugeRepo.findOne({
      where: { gaugeCode, ...this.tenantWhere(company, plant) },
    });
    if (!item) {
      throw new NotFoundException('계측기를 찾을 수 없습니다.');
    }
    return item;
  }

  /**
   * 계측기 등록
   */
  async createGauge(
    dto: CreateGaugeDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const exists = await this.gaugeRepo.findOne({
      where: { company, plant, gaugeCode: dto.gaugeCode },
    });
    if (exists) {
      throw new BadRequestException(
        `계측기 코드 ${dto.gaugeCode}가 이미 존재합니다.`,
      );
    }

    const entity = this.gaugeRepo.create({
      gaugeCode: dto.gaugeCode,
      gaugeName: dto.gaugeName,
      gaugeType: dto.gaugeType,
      manufacturer: dto.manufacturer,
      model: dto.model,
      serialNo: dto.serialNo,
      resolution: dto.resolution,
      measureRange: dto.measureRange,
      calibrationCycle: dto.calibrationCycle,
      lastCalibrationDate: dto.lastCalibrationDate ? parseDateStart(dto.lastCalibrationDate)! : undefined,
      nextCalibrationDate: dto.nextCalibrationDate ? parseDateStart(dto.nextCalibrationDate)! : undefined,
      status: dto.status,
      location: dto.location,
      responsiblePerson: dto.responsiblePerson,
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.gaugeRepo.save(entity);
    this.logger.log(`계측기 등록: ${dto.gaugeCode}`);
    return saved;
  }

  /**
   * 계측기 수정
   */
  async updateGauge(
    gaugeCode: string,
    dto: UpdateGaugeDto,
    userId: string,
    company?: string,
    plant?: string,
  ) {
    const item = await this.findGaugeById(gaugeCode, company, plant);
    const updateData: Partial<GaugeMaster> = {
      ...(dto.gaugeName !== undefined ? { gaugeName: dto.gaugeName } : {}),
      ...(dto.gaugeType !== undefined ? { gaugeType: dto.gaugeType } : {}),
      ...(dto.manufacturer !== undefined ? { manufacturer: dto.manufacturer } : {}),
      ...(dto.model !== undefined ? { model: dto.model } : {}),
      ...(dto.serialNo !== undefined ? { serialNo: dto.serialNo } : {}),
      ...(dto.resolution !== undefined ? { resolution: dto.resolution } : {}),
      ...(dto.measureRange !== undefined ? { measureRange: dto.measureRange } : {}),
      ...(dto.calibrationCycle !== undefined ? { calibrationCycle: dto.calibrationCycle } : {}),
      ...(dto.lastCalibrationDate !== undefined ? { lastCalibrationDate: parseDateStart(dto.lastCalibrationDate)! } : {}),
      ...(dto.nextCalibrationDate !== undefined ? { nextCalibrationDate: parseDateStart(dto.nextCalibrationDate)! } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.responsiblePerson !== undefined ? { responsiblePerson: dto.responsiblePerson } : {}),
    };
    Object.assign(item, updateData, { updatedBy: userId });
    return this.gaugeRepo.save(item);
  }

  /**
   * 계측기 삭제
   */
  async deleteGauge(gaugeCode: string, company?: string, plant?: string) {
    const item = await this.findGaugeById(gaugeCode, company, plant);

    const calCount = await this.calRepo.count({
      where: { gaugeCode: item.gaugeCode, ...this.tenantWhere(company, plant) },
    });
    if (calCount > 0) {
      throw new BadRequestException(
        '교정 이력이 존재하는 계측기는 삭제할 수 없습니다.',
      );
    }

    await this.gaugeRepo.remove(item);
  }

  // =============================================
  // 교정 이력 CRUD
  // =============================================

  /**
   * 교정 이력 목록 조회 (페이지네이션 + 필터)
   */
  async findAllCalibrations(
    query: CalibrationFilterDto,
    company?: string,
    plant?: string,
  ) {
    const {
      page = 1,
      limit = 50,
      gaugeId,
      calibrationType,
      result,
      fromDate,
      toDate,
    } = query;

    const qb = this.calRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.gauge', 'g');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });
    if (gaugeId) qb.andWhere('c.gaugeCode = :gaugeId', { gaugeId });
    if (calibrationType) {
      qb.andWhere('c.calibrationType = :calibrationType', { calibrationType });
    }
    if (result) qb.andWhere('c.result = :result', { result });
    if (fromDate && toDate) {
      qb.andWhere('c.calibrationDate BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(`${fromDate}T00:00:00`),
        toDate: new Date(`${toDate}T23:59:59`),
      });
    }

    qb.orderBy('c.calibrationDate', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 교정 이력 등록 (자동채번 + 계측기 상태 갱신)
   */
  async createCalibration(
    dto: CreateCalibrationDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    // 계측기 존재 여부 확인
    const gauge = await this.gaugeRepo.findOne({
      where: { gaugeCode: dto.gaugeId, ...this.tenantWhere(company, plant) },
    });
    if (!gauge) {
      throw new NotFoundException('계측기를 찾을 수 없습니다.');
    }

    const calibrationNo = await this.generateCalibrationNo(company, plant);
    const entity = this.calRepo.create({
      gaugeCode: dto.gaugeId,
      calibrationNo,
      calibrationDate: parseDateStart(dto.calibrationDate)!,
      calibrationType: dto.calibrationType,
      calibrator: dto.calibrator ?? null,
      calibrationOrg: dto.calibrationOrg ?? null,
      standardUsed: dto.standardUsed ?? null,
      result: dto.result,
      measuredValue: dto.measuredValue ?? null,
      referenceValue: dto.referenceValue ?? null,
      deviation: dto.deviation ?? null,
      uncertainty: dto.uncertainty ?? null,
      nextDueDate: parseDateStart(dto.nextDueDate),
      certificateNo: dto.certificateNo ?? null,
      remark: dto.remark ?? null,
      company,
      plant,
      createdBy: userId,
    });
    const saved = await this.calRepo.save(entity);

    // 계측기 교정 정보 갱신
    gauge.lastCalibrationDate = parseDateStart(dto.calibrationDate)!;
    if (dto.nextDueDate) {
      gauge.nextCalibrationDate = parseDateStart(dto.nextDueDate)!;
    }
    if (dto.result === 'PASS' || dto.result === 'CONDITIONAL') {
      gauge.status = 'ACTIVE';
    } else if (dto.result === 'FAIL') {
      gauge.status = 'EXPIRED';
    }
    gauge.updatedBy = userId;
    await this.gaugeRepo.save(gauge);

    this.logger.log(`교정 이력 등록: ${calibrationNo} (계측기: ${gauge.gaugeCode})`);
    return saved;
  }

  /**
   * 교정 이력 삭제
   */
  async deleteCalibration(
    calibrationNo: string,
    company?: string,
    plant?: string,
    userId: string = 'system',
  ) {
    const item = await this.calRepo.findOne({
      where: { calibrationNo, ...this.tenantWhere(company, plant) },
    });
    if (!item) {
      throw new NotFoundException('교정 이력을 찾을 수 없습니다.');
    }
    await this.calRepo.remove(item);

    const gauge = await this.gaugeRepo.findOne({
      where: { gaugeCode: item.gaugeCode, ...this.tenantWhere(company, plant) },
    });
    if (!gauge) return;

    const latest = await this.calRepo.findOne({
      where: { gaugeCode: item.gaugeCode, ...this.tenantWhere(company, plant) },
      order: { calibrationDate: 'DESC', createdAt: 'DESC' },
    });

    if (latest) {
      gauge.lastCalibrationDate = latest.calibrationDate;
      gauge.nextCalibrationDate = latest.nextDueDate ?? null;
      gauge.status =
        latest.result === 'FAIL'
          ? 'EXPIRED'
          : latest.result === 'PASS' || latest.result === 'CONDITIONAL'
            ? 'ACTIVE'
            : gauge.status;
    } else {
      gauge.lastCalibrationDate = null;
      gauge.nextCalibrationDate = null;
      if (gauge.status === 'ACTIVE' || gauge.status === 'EXPIRED') {
        gauge.status = 'EXPIRED';
      }
    }
    gauge.updatedBy = userId;
    await this.gaugeRepo.save(gauge);
  }

  // =============================================
  // 교정 만료 관리
  // =============================================

  /**
   * N일 이내 교정 만료 예정 계측기 조회
   */
  async getExpiringSoon(
    days: number,
    company?: string,
    plant?: string,
  ) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const qb = this.gaugeRepo
      .createQueryBuilder('g')
      .where('g.status = :status', { status: 'ACTIVE' })
      .andWhere('g.nextCalibrationDate <= :futureDate', { futureDate });

    if (company) qb.andWhere('g.company = :company', { company });
    if (plant) qb.andWhere('g.plant = :plant', { plant });

    qb.orderBy('g.nextCalibrationDate', 'ASC');
    return qb.getMany();
  }

  /**
   * 교정 만료 상태 일괄 갱신 — nextCalibrationDate가 현재 이전인 ACTIVE 계측기를 EXPIRED로 변경
   */
  async updateCalibrationStatus(company?: string, plant?: string) {
    const now = new Date();

    const qb = this.gaugeRepo
      .createQueryBuilder()
      .update(GaugeMaster)
      .set({ status: 'EXPIRED' })
      .where('status = :status', { status: 'ACTIVE' })
      .andWhere('nextCalibrationDate <= :now', { now });

    if (company) qb.andWhere('company = :company', { company });
    if (plant) qb.andWhere('plant = :plant', { plant });

    const result = await qb.execute();
    this.logger.log(`교정 만료 상태 갱신: ${result.affected}건`);
    return { updated: result.affected ?? 0 };
  }
}

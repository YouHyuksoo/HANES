/**
 * @file spc.service.ts
 * @description SPC 통계적 공정 관리 서비스 — IATF 16949 SPC 관리도
 *
 * 초보자 가이드:
 * 1. **관리도 CRUD**: 등록(자동채번 SPC-YYYYMMDD-NNN), 조회, 수정, 삭제
 * 2. **데이터 CRUD**: 측정 데이터 입력/조회 (서브그룹 통계 자동 계산)
 * 3. **관리한계 계산**: calculateControlLimits() — 기존 데이터에서 UCL/LCL/CL 산출
 * 4. **공정능력 계산**: calculateCpk() — 규격 한계 + 데이터로 Cpk/Ppk 산출
 * 5. **차트 데이터**: getChartData() — 기간별 데이터 포인트 조회
 *
 * 주요 메서드:
 * - generateChartNo(): 자동채번
 * - findAllCharts(): 관리도 목록 조회 (페이지네이션 + 필터)
 * - findChartById() / createChart() / updateChart() / deleteChart()
 * - createData(): 측정 데이터 입력 (평균/범위/표준편차 자동 계산)
 * - calculateControlLimits(): UCL/LCL/CL 산출
 * - calculateCpk(): Cpk/Ppk 산출
 * - getChartData(): 차트 렌더링용 데이터
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SpcChart } from '../../../entities/spc-chart.entity';
import { SpcData } from '../../../entities/spc-data.entity';
import {
  CreateSpcChartDto,
  UpdateSpcChartDto,
  CreateSpcDataDto,
  SpcChartFilterDto,
} from '../dto/spc.dto';

/** Xbar-R 관리도 상수 (A2, D3, D4) — 서브그룹 크기별 */
const XBAR_R_CONSTANTS: Record<number, { A2: number; D3: number; D4: number }> = {
  2: { A2: 1.880, D3: 0, D4: 3.267 },
  3: { A2: 1.023, D3: 0, D4: 2.575 },
  4: { A2: 0.729, D3: 0, D4: 2.282 },
  5: { A2: 0.577, D3: 0, D4: 2.115 },
  6: { A2: 0.483, D3: 0, D4: 2.004 },
  7: { A2: 0.419, D3: 0.076, D4: 1.924 },
  8: { A2: 0.373, D3: 0.136, D4: 1.864 },
  9: { A2: 0.337, D3: 0.184, D4: 1.816 },
  10: { A2: 0.308, D3: 0.223, D4: 1.777 },
};

@Injectable()
export class SpcService {
  private readonly logger = new Logger(SpcService.name);

  constructor(
    @InjectRepository(SpcChart)
    private readonly chartRepo: Repository<SpcChart>,
    @InjectRepository(SpcData)
    private readonly dataRepo: Repository<SpcData>,
    private readonly dataSource: DataSource,
  ) {}

  /** chartId + sampleDate 기준 다음 SEQ 번호 조회 */
  private async getNextDataSeq(chartId: number, sampleDate: Date): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT NVL(MAX("SEQ"), 0) + 1 AS "nextSeq" FROM "SPC_DATA" WHERE "CHART_ID" = :1 AND "SAMPLE_DATE" = :2`,
      [chartId, sampleDate],
    );
    return result[0].nextSeq;
  }

  // =============================================
  // 관리도 번호 자동채번
  // =============================================

  /**
   * 관리도 번호 자동채번: SPC-YYYYMMDD-NNN
   */
  private async generateChartNo(
    company: string,
    plant: string,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SPC-${dateStr}-`;

    const last = await this.chartRepo
      .createQueryBuilder('c')
      .where('c.company = :company', { company })
      .andWhere('c.plant = :plant', { plant })
      .andWhere('c.chartNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.chartNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.chartNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // =============================================
  // 관리도 CRUD
  // =============================================

  /**
   * 관리도 목록 조회 (페이지네이션 + 필터)
   */
  async findAllCharts(
    query: SpcChartFilterDto,
    company?: string,
    plant?: string,
  ) {
    const { page = 1, limit = 50, itemCode, processCode, chartType, status } = query;

    const qb = this.chartRepo.createQueryBuilder('c');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });
    if (itemCode) qb.andWhere('c.itemCode = :itemCode', { itemCode });
    if (processCode) qb.andWhere('c.processCode = :processCode', { processCode });
    if (chartType) qb.andWhere('c.chartType = :chartType', { chartType });
    if (status) qb.andWhere('c.status = :status', { status });

    qb.orderBy('c.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 관리도 단건 조회 (chartNo PK)
   */
  async findChartById(chartNo: string) {
    const item = await this.chartRepo.findOne({ where: { chartNo } });
    if (!item) {
      throw new NotFoundException('SPC 관리도를 찾을 수 없습니다.');
    }
    return item;
  }

  /**
   * 관리도 단건 조회 (id, SpcData FK 호환용)
   */
  private async findChartByIdNum(id: number) {
    const item = await this.chartRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('SPC 관리도를 찾을 수 없습니다.');
    }
    return item;
  }

  /**
   * 관리도 등록 (chartNo 자동채번)
   */
  async createChart(
    dto: CreateSpcChartDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const chartNo = await this.generateChartNo(company, plant);
    const entity = this.chartRepo.create({
      ...dto,
      chartNo,
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.chartRepo.save(entity);
    this.logger.log(`SPC 관리도 등록: ${chartNo}`);
    return saved;
  }

  /**
   * 관리도 수정
   */
  async updateChart(chartNo: string, dto: UpdateSpcChartDto, userId: string) {
    const item = await this.findChartById(chartNo);
    Object.assign(item, dto, { updatedBy: userId });
    return this.chartRepo.save(item);
  }

  /**
   * 관리도 삭제
   */
  async deleteChart(chartNo: string) {
    const item = await this.findChartById(chartNo);
    await this.chartRepo.remove(item);
  }

  // =============================================
  // 측정 데이터 CRUD
  // =============================================

  /**
   * 측정 데이터 입력 (평균/범위/표준편차 자동 계산)
   */
  async createData(
    dto: CreateSpcDataDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const chart = await this.findChartByIdNum(dto.chartId);
    const vals = dto.values;

    if (vals.length !== chart.subgroupSize) {
      throw new BadRequestException(
        `서브그룹 크기가 일치하지 않습니다. (필요: ${chart.subgroupSize}, 입력: ${vals.length})`,
      );
    }

    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const range = Math.max(...vals) - Math.min(...vals);
    const variance = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (vals.length - 1);
    const stdDev = Math.sqrt(variance);

    // 관리 이탈 여부 판정
    let outOfControl = 0;
    if (chart.ucl != null && mean > Number(chart.ucl)) outOfControl = 1;
    if (chart.lcl != null && mean < Number(chart.lcl)) outOfControl = 1;

    const sampleDate = new Date(dto.sampleDate);
    const seq = await this.getNextDataSeq(dto.chartId, sampleDate);

    const entity = this.dataRepo.create({
      chartId: dto.chartId,
      sampleDate,
      seq,
      subgroupNo: dto.subgroupNo,
      values: JSON.stringify(vals),
      mean: parseFloat(mean.toFixed(4)),
      range: parseFloat(range.toFixed(4)),
      stdDev: parseFloat(stdDev.toFixed(4)),
      outOfControl,
      remarks: dto.remarks,
      company,
      plant,
      createdBy: userId,
    });

    const saved = await this.dataRepo.save(entity);
    this.logger.log(`SPC 데이터 입력: chartId=${dto.chartId}, subgroupNo=${dto.subgroupNo}`);
    return saved;
  }

  // =============================================
  // 관리한계 계산
  // =============================================

  /**
   * 관리한계 계산 (Xbar-R 기준): UCL/LCL/CL 산출 후 관리도에 저장
   */
  async calculateControlLimits(chartNo: string, userId: string) {
    const chart = await this.findChartById(chartNo);
    const dataList = await this.dataRepo.find({
      where: { chartId: chart.id },
      order: { subgroupNo: 'ASC' },
    });

    if (dataList.length < 2) {
      throw new BadRequestException(
        '관리한계 계산에 최소 2개 이상의 서브그룹 데이터가 필요합니다.',
      );
    }

    const means = dataList.map((d) => Number(d.mean));
    const ranges = dataList.map((d) => Number(d.range));
    const xBarBar = means.reduce((a, b) => a + b, 0) / means.length;
    const rBar = ranges.reduce((a, b) => a + b, 0) / ranges.length;

    const constants = XBAR_R_CONSTANTS[chart.subgroupSize];
    if (!constants) {
      throw new BadRequestException(
        `서브그룹 크기 ${chart.subgroupSize}에 대한 관리도 상수가 정의되지 않았습니다. (2~10 지원)`,
      );
    }

    chart.cl = parseFloat(xBarBar.toFixed(4));
    chart.ucl = parseFloat((xBarBar + constants.A2 * rBar).toFixed(4));
    chart.lcl = parseFloat((xBarBar - constants.A2 * rBar).toFixed(4));
    chart.updatedBy = userId;

    const saved = await this.chartRepo.save(chart);
    this.logger.log(`관리한계 계산 완료: chartNo=${chartNo}, UCL=${chart.ucl}, CL=${chart.cl}, LCL=${chart.lcl}`);
    return saved;
  }

  // =============================================
  // 공정능력 계산
  // =============================================

  /**
   * Cpk/Ppk 계산 — 최근 데이터 기반
   */
  async calculateCpk(chartNo: string) {
    const chart = await this.findChartById(chartNo);

    if (chart.usl == null || chart.lsl == null) {
      throw new BadRequestException(
        'Cpk 계산에는 USL과 LSL이 모두 필요합니다.',
      );
    }

    const dataList = await this.dataRepo.find({
      where: { chartId: chart.id },
      order: { subgroupNo: 'ASC' },
    });

    if (dataList.length < 2) {
      throw new BadRequestException(
        'Cpk 계산에 최소 2개 이상의 서브그룹 데이터가 필요합니다.',
      );
    }

    // 전체 개별값으로 Ppk 계산
    const allValues: number[] = [];
    for (const d of dataList) {
      const parsed = JSON.parse(d.values) as number[];
      allValues.push(...parsed);
    }

    const overallMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const overallVariance =
      allValues.reduce((sum, v) => sum + (v - overallMean) ** 2, 0) / (allValues.length - 1);
    const overallSigma = Math.sqrt(overallVariance);

    const usl = Number(chart.usl);
    const lsl = Number(chart.lsl);

    const cpupper = (usl - overallMean) / (3 * overallSigma);
    const cplower = (overallMean - lsl) / (3 * overallSigma);
    const cpk = parseFloat(Math.min(cpupper, cplower).toFixed(4));
    const ppk = cpk; // Ppk 근사 (전체 데이터 기준)

    this.logger.log(`Cpk 계산 완료: chartNo=${chartNo}, Cpk=${cpk}`);
    return { chartNo, cpk, ppk, mean: parseFloat(overallMean.toFixed(4)), sigma: parseFloat(overallSigma.toFixed(4)) };
  }

  // =============================================
  // 차트 데이터 조회
  // =============================================

  /**
   * 차트 렌더링용 데이터 포인트 조회
   */
  async getChartData(
    chartNo: string,
    from?: string,
    to?: string,
    company?: string,
    plant?: string,
  ) {
    const chart = await this.findChartById(chartNo);

    const qb = this.dataRepo
      .createQueryBuilder('d')
      .where('d.chartId = :chartId', { chartId: chart.id });

    if (company) qb.andWhere('d.company = :company', { company });
    if (plant) qb.andWhere('d.plant = :plant', { plant });
    if (from && to) {
      qb.andWhere('d.sampleDate BETWEEN :from AND :to', {
        from,
        to: `${to}T23:59:59`,
      });
    }

    qb.orderBy('d.subgroupNo', 'ASC');
    const data = await qb.getMany();

    return {
      chart: {
        id: chart.id,
        chartNo: chart.chartNo,
        characteristicName: chart.characteristicName,
        chartType: chart.chartType,
        ucl: chart.ucl,
        lcl: chart.lcl,
        cl: chart.cl,
        usl: chart.usl,
        lsl: chart.lsl,
        target: chart.target,
      },
      data,
    };
  }
}

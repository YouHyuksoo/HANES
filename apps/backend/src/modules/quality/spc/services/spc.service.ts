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
import { In, Repository, DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { SpcChart } from '../../../../entities/spc-chart.entity';
import { SpcData } from '../../../../entities/spc-data.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import { ProcessMaster } from '../../../../entities/process-master.entity';
import { NumberingService } from '../../../../shared/numbering.service';
import { xbarRConstants } from '../hv/hv-spc-math';
import {
  CreateSpcChartDto,
  UpdateSpcChartDto,
  CreateSpcDataDto,
  SpcChartFilterDto,
} from '../dto/spc.dto';

const SPC_DATA_SOURCE_VALUES = ['IQC', 'PROCESS', 'OQC', 'MANUAL'] as const;

/** 관리도 엑셀 업로드 행 원본 (헤더는 한글 고정) */
interface SpcChartExcelRow {
  '품목코드'?: unknown;
  '공정코드'?: unknown;
  '특성명'?: unknown;
  '서브그룹크기'?: unknown;
  'LSL'?: unknown;
  'TARGET'?: unknown;
  'USL'?: unknown;
  '데이터출처'?: unknown;
  '소스검사항목명'?: unknown;
}

export interface SpcChartPreviewRow {
  row: number;
  itemCode: string;
  processCode: string;
  characteristicName: string;
  subgroupSize: number | null;
  lsl: number | null;
  target: number | null;
  usl: number | null;
  dataSource: string;
  status: 'new' | 'duplicate_file' | 'duplicate_db' | 'error';
  message?: string;
}

export interface SpcChartPreviewResult {
  rows: SpcChartPreviewRow[];
  newCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface SpcChartUploadResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/** 측정데이터 엑셀 업로드 행 원본 (헤더는 한글 고정) */
interface SpcDataExcelRow {
  '관리도번호'?: unknown;
  '측정일시'?: unknown;
  '서브그룹번호'?: unknown;
  '측정값(쉼표구분)'?: unknown;
  '설비코드'?: unknown;
  '비고'?: unknown;
}

export interface SpcDataPreviewRow {
  row: number;
  chartId: string;
  sampleDate: string;
  subgroupNo: number | null;
  values: number[];
  equipCode: string;
  status: 'new' | 'error';
  message?: string;
}

export interface SpcDataPreviewResult {
  rows: SpcDataPreviewRow[];
  newCount: number;
  errorCount: number;
}

export interface SpcDataUploadResult {
  inserted: number;
  errors: { row: number; message: string }[];
}

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
    @InjectRepository(ItemMaster)
    private readonly itemRepo: Repository<ItemMaster>,
    @InjectRepository(ProcessMaster)
    private readonly processRepo: Repository<ProcessMaster>,
    private readonly dataSource: DataSource,
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  /** SPC_DATA 다음 SEQ 번호 조회 */
  private async getNextDataSeq(): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT SEQ_SPC_DATA.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    return result[0].nextSeq;
  }

  // =============================================
  // 관리도 번호 자동채번
  // =============================================

  /**
   * 관리도 번호 자동채번: SPC-YYYYMMDD-NNN
   * NUM_RULE_MASTERS(SPC_CHART) 행을 SELECT FOR UPDATE로 잠가 동시 채번을 직렬화한다.
   */
  private async generateChartNo(): Promise<string> {
    return this.numbering.next('SPC_CHART');
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
  async findChartById(chartNo: string, company?: string, plant?: string) {
    const item = await this.chartRepo.findOne({
      where: { chartNo, ...this.tenantWhere(company, plant) },
    });
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
    const chartNo = await this.generateChartNo();
    const entity = this.chartRepo.create({
      chartNo,
      itemCode: dto.itemCode,
      processCode: dto.processCode,
      characteristicName: dto.characteristicName,
      chartType: dto.chartType,
      subgroupSize: dto.subgroupSize,
      usl: dto.usl,
      lsl: dto.lsl,
      target: dto.target,
      dataSource: dto.dataSource,
      sourceInspectItem: dto.sourceInspectItem,
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
  async updateChart(
    chartNo: string,
    dto: UpdateSpcChartDto,
    userId: string,
    company?: string,
    plant?: string,
  ) {
    const item = await this.findChartById(chartNo, company, plant);
    const updateData: Partial<SpcChart> = {
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode } : {}),
      ...(dto.processCode !== undefined ? { processCode: dto.processCode } : {}),
      ...(dto.characteristicName !== undefined ? { characteristicName: dto.characteristicName } : {}),
      ...(dto.chartType !== undefined ? { chartType: dto.chartType } : {}),
      ...(dto.subgroupSize !== undefined ? { subgroupSize: dto.subgroupSize } : {}),
      ...(dto.usl !== undefined ? { usl: dto.usl } : {}),
      ...(dto.lsl !== undefined ? { lsl: dto.lsl } : {}),
      ...(dto.target !== undefined ? { target: dto.target } : {}),
      ...(dto.dataSource !== undefined ? { dataSource: dto.dataSource } : {}),
      ...(dto.sourceInspectItem !== undefined ? { sourceInspectItem: dto.sourceInspectItem } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };
    Object.assign(item, updateData, { updatedBy: userId });
    return this.chartRepo.save(item);
  }

  /**
   * 관리도 삭제
   */
  async deleteChart(chartNo: string, company?: string, plant?: string) {
    const item = await this.findChartById(chartNo, company, plant);
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
    const chart = await this.findChartById(dto.chartId, company, plant);
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
    const seq = await this.getNextDataSeq();

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
      equipCode: dto.equipCode,
      remark: dto.remark,
      company,
      plant,
      createdBy: userId,
    });

    const saved = await this.dataRepo.save(entity);
    this.logger.log(`SPC 데이터 입력: chartId=${dto.chartId}, subgroupNo=${dto.subgroupNo}`);
    return saved;
  }

  // =============================================
  // 관리도 엑셀 업로드 (미리보기 → 확정)
  // =============================================

  /** 업로드 양식용 빈 xlsx 템플릿 (헤더만) */
  downloadChartTemplate(): Buffer {
    const headers = ['품목코드', '공정코드', '특성명', '서브그룹크기', 'LSL', 'TARGET', 'USL', '데이터출처', '소스검사항목명'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SPC_CHARTS');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private parseChartRow(r: SpcChartExcelRow, rowNum: number): Omit<SpcChartPreviewRow, 'status' | 'message'> & { valid: boolean; error?: string } {
    const str = (v: unknown) => String(v ?? '').trim();
    const num = (v: unknown): number | null => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

    const itemCode = str(r['품목코드']);
    const processCode = str(r['공정코드']);
    const characteristicName = str(r['특성명']);
    const subgroupSize = num(r['서브그룹크기']);
    const dataSource = str(r['데이터출처']) || 'MANUAL';

    const base = {
      row: rowNum, itemCode, processCode, characteristicName,
      subgroupSize, lsl: num(r['LSL']), target: num(r['TARGET']), usl: num(r['USL']), dataSource,
    };

    if (!itemCode || !processCode || !characteristicName) {
      return { ...base, valid: false, error: '품목코드, 공정코드, 특성명은 필수입니다.' };
    }
    if (subgroupSize !== null && (subgroupSize < 2 || subgroupSize > 25)) {
      return { ...base, valid: false, error: '서브그룹크기는 2~25 사이여야 합니다.' };
    }
    if (!(SPC_DATA_SOURCE_VALUES as readonly string[]).includes(dataSource)) {
      return { ...base, valid: false, error: `데이터출처는 ${SPC_DATA_SOURCE_VALUES.join('/')} 중 하나여야 합니다.` };
    }
    return { ...base, valid: true };
  }

  /** 관리도 업로드 미리보기 — 신규/중복(품목+공정+특성명)/오류 사전 확인 */
  async previewChartUpload(buffer: Buffer, company?: string, plant?: string): Promise<SpcChartPreviewResult> {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const jsonRows = XLSX.utils.sheet_to_json<SpcChartExcelRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' });

    const parsedList = jsonRows.map((r, i) => this.parseChartRow(r, i + 2));
    const itemCodes = Array.from(new Set(parsedList.filter((p) => p.valid).map((p) => p.itemCode)));
    const processCodes = Array.from(new Set(parsedList.filter((p) => p.valid).map((p) => p.processCode)));
    const [items, processes] = await Promise.all([
      itemCodes.length > 0
        ? this.itemRepo.find({ where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) }, select: ['itemCode'] })
        : Promise.resolve([]),
      processCodes.length > 0
        ? this.processRepo.find({ where: { processCode: In(processCodes), ...this.tenantWhere(company, plant) }, select: ['processCode'] })
        : Promise.resolve([]),
    ]);
    const validItemCodes = new Set(items.map((i) => i.itemCode));
    const validProcessCodes = new Set(processes.map((p) => p.processCode));

    const rows: SpcChartPreviewRow[] = [];
    const fileKeySet = new Set<string>();
    const naturalKeys: { itemCode: string; processCode: string; characteristicName: string }[] = [];

    for (const parsed of parsedList) {
      if (!parsed.valid) {
        rows.push({ ...parsed, status: 'error', message: parsed.error });
        continue;
      }
      if (!validItemCodes.has(parsed.itemCode)) {
        rows.push({ ...parsed, status: 'error', message: `품목코드 [${parsed.itemCode}]가 품목마스터에 없습니다.` });
        continue;
      }
      if (!validProcessCodes.has(parsed.processCode)) {
        rows.push({ ...parsed, status: 'error', message: `공정코드 [${parsed.processCode}]가 공정마스터에 없습니다.` });
        continue;
      }
      const key = `${parsed.itemCode}::${parsed.processCode}::${parsed.characteristicName}`;
      if (fileKeySet.has(key)) {
        rows.push({ ...parsed, status: 'duplicate_file', message: '파일 내 중복 (동일 품목·공정·특성명)' });
        continue;
      }
      fileKeySet.add(key);
      naturalKeys.push({ itemCode: parsed.itemCode, processCode: parsed.processCode, characteristicName: parsed.characteristicName });
      rows.push({ ...parsed, status: 'new' });
    }

    if (naturalKeys.length > 0) {
      const existing = await this.chartRepo.find({
        where: naturalKeys.map((k) => ({ ...k, chartType: 'XBAR_R', status: 'ACTIVE', ...this.tenantWhere(company, plant) })),
        select: ['itemCode', 'processCode', 'characteristicName'],
      });
      const existingKeys = new Set(existing.map((c) => `${c.itemCode}::${c.processCode}::${c.characteristicName}`));
      for (const row of rows) {
        if (row.status !== 'new') continue;
        if (existingKeys.has(`${row.itemCode}::${row.processCode}::${row.characteristicName}`)) {
          row.status = 'duplicate_db';
          row.message = 'DB에 동일 품목·공정·특성명의 활성 관리도가 이미 있습니다.';
        }
      }
    }

    return {
      rows,
      newCount: rows.filter((r) => r.status === 'new').length,
      duplicateCount: rows.filter((r) => r.status === 'duplicate_file' || r.status === 'duplicate_db').length,
      errorCount: rows.filter((r) => r.status === 'error').length,
    };
  }

  /** 관리도 엑셀 일괄 등록 — 신규만 INSERT, 중복/오류는 건너뛰고 사유를 보고한다 */
  async uploadChartsFromExcel(buffer: Buffer, company: string, plant: string, userId: string): Promise<SpcChartUploadResult> {
    const preview = await this.previewChartUpload(buffer, company, plant);
    const result: SpcChartUploadResult = { inserted: 0, skipped: 0, errors: [] };

    for (const row of preview.rows) {
      if (row.status === 'error') { result.errors.push({ row: row.row, message: row.message ?? '오류' }); continue; }
      if (row.status !== 'new') { result.skipped++; continue; }

      try {
        await this.createChart(
          {
            itemCode: row.itemCode,
            processCode: row.processCode,
            characteristicName: row.characteristicName,
            chartType: 'XBAR_R',
            subgroupSize: row.subgroupSize ?? undefined,
            lsl: row.lsl ?? undefined,
            target: row.target ?? undefined,
            usl: row.usl ?? undefined,
            dataSource: row.dataSource,
          },
          company,
          plant,
          userId,
        );
        result.inserted++;
      } catch (e) {
        result.errors.push({ row: row.row, message: e instanceof Error ? e.message : '등록 실패' });
      }
    }
    return result;
  }

  // =============================================
  // 측정데이터 엑셀 업로드 (미리보기 → 확정)
  // =============================================

  /** 업로드 양식용 빈 xlsx 템플릿 (헤더만) */
  downloadDataTemplate(): Buffer {
    const headers = ['관리도번호', '측정일시', '서브그룹번호', '측정값(쉼표구분)', '설비코드', '비고'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SPC_DATA');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private parseDataRow(r: SpcDataExcelRow, rowNum: number): Omit<SpcDataPreviewRow, 'status' | 'message'> & { valid: boolean; error?: string } {
    const str = (v: unknown) => String(v ?? '').trim();
    const chartId = str(r['관리도번호']);
    const sampleDateRaw = r['측정일시'];
    const subgroupNoRaw = r['서브그룹번호'];
    const valuesRaw = str(r['측정값(쉼표구분)']);
    const equipCode = str(r['설비코드']);

    const base = { row: rowNum, chartId, equipCode };

    if (!chartId) return { ...base, sampleDate: '', subgroupNo: null, values: [], valid: false, error: '관리도번호는 필수입니다.' };

    let sampleDate: Date | null = null;
    if (sampleDateRaw instanceof Date) sampleDate = sampleDateRaw;
    else if (typeof sampleDateRaw === 'number') sampleDate = XLSX.SSF.parse_date_code(sampleDateRaw) ? new Date(XLSX.SSF.format('yyyy-mm-dd hh:mm:ss', sampleDateRaw)) : null;
    else if (str(sampleDateRaw)) sampleDate = new Date(str(sampleDateRaw));
    if (!sampleDate || isNaN(sampleDate.getTime())) {
      return { ...base, sampleDate: '', subgroupNo: null, values: [], valid: false, error: '측정일시가 없거나 형식이 올바르지 않습니다.' };
    }

    const subgroupNo = subgroupNoRaw === '' || subgroupNoRaw === null || subgroupNoRaw === undefined || isNaN(Number(subgroupNoRaw)) ? null : Number(subgroupNoRaw);
    if (subgroupNo === null) return { ...base, sampleDate: sampleDate.toISOString(), subgroupNo: null, values: [], valid: false, error: '서브그룹번호가 없거나 숫자가 아닙니다.' };

    const values = valuesRaw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    if (values.length === 0) return { ...base, sampleDate: sampleDate.toISOString(), subgroupNo, values: [], valid: false, error: '측정값이 없습니다. (쉼표로 구분해 입력)' };

    return { ...base, sampleDate: sampleDate.toISOString(), subgroupNo, values, valid: true };
  }

  /** 측정데이터 업로드 미리보기 — 관리도 존재/서브그룹크기 일치 확인 */
  async previewDataUpload(buffer: Buffer, company?: string, plant?: string): Promise<SpcDataPreviewResult> {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const jsonRows = XLSX.utils.sheet_to_json<SpcDataExcelRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' });

    const parsedRows = jsonRows.map((r, i) => this.parseDataRow(r, i + 2));
    const chartIds = Array.from(new Set(parsedRows.filter((p) => p.valid).map((p) => p.chartId)));
    const charts = chartIds.length > 0
      ? await this.chartRepo.find({ where: { chartNo: In(chartIds), ...this.tenantWhere(company, plant) } })
      : [];
    const chartMap = new Map(charts.map((c) => [c.chartNo, c]));

    const rows: SpcDataPreviewRow[] = parsedRows.map((p) => {
      if (!p.valid) return { ...p, status: 'error', message: p.error };
      const chart = chartMap.get(p.chartId);
      if (!chart) return { ...p, status: 'error', message: `관리도번호 [${p.chartId}]를 찾을 수 없습니다.` };
      if (p.values.length !== chart.subgroupSize) {
        return { ...p, status: 'error', message: `서브그룹 크기가 일치하지 않습니다. (필요: ${chart.subgroupSize}, 입력: ${p.values.length})` };
      }
      return { ...p, status: 'new' };
    });

    return {
      rows,
      newCount: rows.filter((r) => r.status === 'new').length,
      errorCount: rows.filter((r) => r.status === 'error').length,
    };
  }

  /** 측정데이터 엑셀 일괄 등록 */
  async uploadDataFromExcel(buffer: Buffer, company: string, plant: string, userId: string): Promise<SpcDataUploadResult> {
    const preview = await this.previewDataUpload(buffer, company, plant);
    const result: SpcDataUploadResult = { inserted: 0, errors: [] };

    for (const row of preview.rows) {
      if (row.status !== 'new') { result.errors.push({ row: row.row, message: row.message ?? '오류' }); continue; }
      // previewDataUpload가 'new'로 분류한 행은 서브그룹번호가 있지만, 타입은 number|null이라 캐스트 대신 명시 가드로 좁힌다.
      if (row.subgroupNo === null) { result.errors.push({ row: row.row, message: '서브그룹번호가 없거나 숫자가 아닙니다.' }); continue; }
      try {
        await this.createData(
          {
            chartId: row.chartId,
            sampleDate: row.sampleDate,
            subgroupNo: row.subgroupNo,
            values: row.values,
            equipCode: row.equipCode || undefined,
          },
          company,
          plant,
          userId,
        );
        result.inserted++;
      } catch (e) {
        result.errors.push({ row: row.row, message: e instanceof Error ? e.message : '등록 실패' });
      }
    }
    return result;
  }

  // =============================================
  // 관리한계 계산
  // =============================================

  /**
   * 관리한계 계산 (Xbar-R 기준): UCL/LCL/CL 산출 후 관리도에 저장
   */
  async calculateControlLimits(
    chartNo: string,
    userId: string,
    company?: string,
    plant?: string,
  ) {
    const chart = await this.findChartById(chartNo, company, plant);
    const dataList = await this.dataRepo.find({
      where: { chartId: chart.chartNo, ...this.tenantWhere(chart.company, chart.plant) },
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
   * Cpk/Ppk 계산 — 관리도의 서브그룹 데이터 전체 기준 (감사 14P).
   *
   * - Cpk/Cp: 군내 산포 σ_within = R̄ / d2(n). n = chart.subgroupSize, R̄ = SPC_DATA.RANGE_VAL 평균
   *   (RANGE_VAL이 비어 있으면 VALUES에서 max-min으로 보완). hv-spc-math의 d2 상수를 재사용한다.
   * - Ppk/Pp: 전체 개별값 표본표준편차 σ_overall (n-1).
   * - 중심은 두 지수 모두 전체 개별값 평균(서브그룹 크기가 같으므로 X̿와 동일).
   * - σ가 0이면 지수는 정의되지 않으므로 null (0이나 Infinity로 돌려주지 않는다).
   * - `sigma`는 하위호환용으로 `sigmaOverall`과 같은 값이다.
   */
  async calculateCpk(chartNo: string, company?: string, plant?: string) {
    const chart = await this.findChartById(chartNo, company, plant);

    if (chart.usl == null || chart.lsl == null) {
      throw new BadRequestException(
        'Cpk 계산에는 USL과 LSL이 모두 필요합니다.',
      );
    }

    const dataList = await this.dataRepo.find({
      where: { chartId: chart.chartNo, ...this.tenantWhere(chart.company, chart.plant) },
      order: { subgroupNo: 'ASC' },
    });

    if (dataList.length < 2) {
      throw new BadRequestException(
        'Cpk 계산에 최소 2개 이상의 서브그룹 데이터가 필요합니다.',
      );
    }

    let constants: ReturnType<typeof xbarRConstants>;
    try {
      constants = xbarRConstants(Number(chart.subgroupSize));
    } catch (error: unknown) {
      throw new BadRequestException(
        `서브그룹 크기 ${chart.subgroupSize}에 대한 관리도 상수가 정의되지 않았습니다. (2~10 지원)`,
      );
    }

    // 전체 개별값(Ppk용)과 서브그룹별 범위(Cpk용)를 같은 순회에서 모은다.
    const allValues: number[] = [];
    const ranges: number[] = [];
    for (const d of dataList) {
      const parsed = JSON.parse(d.values) as number[];
      allValues.push(...parsed);
      const storedRange = d.range == null ? Number.NaN : Number(d.range);
      ranges.push(
        Number.isFinite(storedRange)
          ? storedRange
          : Math.max(...parsed) - Math.min(...parsed),
      );
    }

    const overallMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const overallVariance =
      allValues.reduce((sum, v) => sum + (v - overallMean) ** 2, 0) / (allValues.length - 1);
    const sigmaOverall = Math.sqrt(overallVariance);

    const rBar = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    const sigmaWithin = rBar / constants.d2;

    const usl = Number(chart.usl);
    const lsl = Number(chart.lsl);

    const round4 = (v: number | null): number | null => (v === null ? null : parseFloat(v.toFixed(4)));
    const indexK = (sigma: number): number | null =>
      sigma > 0 ? Math.min((usl - overallMean) / (3 * sigma), (overallMean - lsl) / (3 * sigma)) : null;
    const indexP = (sigma: number): number | null => (sigma > 0 ? (usl - lsl) / (6 * sigma) : null);

    const cpk = round4(indexK(sigmaWithin));
    const cp = round4(indexP(sigmaWithin));
    const ppk = round4(indexK(sigmaOverall));
    const pp = round4(indexP(sigmaOverall));

    this.logger.log(`Cpk 계산 완료: chartNo=${chartNo}, Cpk=${cpk}, Ppk=${ppk}`);
    return {
      chartNo,
      cpk,
      ppk,
      cp,
      pp,
      mean: parseFloat(overallMean.toFixed(4)),
      sigma: parseFloat(sigmaOverall.toFixed(4)),
      sigmaWithin: parseFloat(sigmaWithin.toFixed(4)),
      sigmaOverall: parseFloat(sigmaOverall.toFixed(4)),
    };
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
    const chart = await this.findChartById(chartNo, company, plant);

    const qb = this.dataRepo
      .createQueryBuilder('d')
      .where('d.chartId = :chartId', { chartId: chart.chartNo });

    if (company) qb.andWhere('d.company = :company', { company });
    if (plant) qb.andWhere('d.plant = :plant', { plant });
    if (from) qb.andWhere("d.sampleDate >= TO_DATE(:from, 'YYYY-MM-DD')", { from });
    if (to) qb.andWhere("d.sampleDate < TO_DATE(:to, 'YYYY-MM-DD') + INTERVAL '1' DAY", { to });

    qb.orderBy('d.subgroupNo', 'ASC');
    const data = await qb.getMany();

    return {
      chart: {
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

  /**
   * 데이터 소스별로 SPC 측정값을 조회한다.
   * - IQC: SAMPLE_INSPECT_RESULTS (수입검사 실적)
   * - PROCESS: INSPECT_RESULTS (공정검사 실적)
   * - OQC: OQC_REQUESTS (출하검사 실적)
   * - MANUAL: 빈 배열 반환 (수동입력 전용)
   */
  async fetchMeasurements(
    chartNo: string,
    from?: string,
    to?: string,
    company?: string,
    plant?: string,
  ) {
    const chart = await this.chartRepo.findOne({
      where: { chartNo, ...(company && { company }), ...(plant && { plant }) },
    });
    if (!chart) {
      throw new NotFoundException(`관리도 ${chartNo}를 찾을 수 없습니다`);
    }

    const dataSource = chart.dataSource ?? 'MANUAL';
    if (dataSource === 'MANUAL') {
      return { dataSource, measurements: [] };
    }

    let measurements: { source: string; date: string; values: number[] }[] = [];

    try {
      switch (dataSource) {
        case 'IQC':
          measurements = await this.fetchFromIqc(chart, from, to);
          break;
        case 'PROCESS':
          measurements = await this.fetchFromProcess(chart, from, to);
          break;
        case 'OQC':
          measurements = await this.fetchFromOqc(chart, from, to);
          break;
      }
    } catch (error: unknown) {
      this.logger.warn(`fetchMeasurements(${dataSource}) 실패: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { dataSource, measurements };
  }

  /** IQC: SAMPLE_INSPECT_RESULTS에서 측정값 조회 */
  private async fetchFromIqc(
    chart: SpcChart, from?: string, to?: string,
  ): Promise<{ source: string; date: string; values: number[] }[]> {
    const bind: unknown[] = [chart.company, chart.plant];
    let sql = `SELECT TO_CHAR(INSPECT_DATE, 'YYYY-MM-DD') AS "date", MEASURED_VALUE AS "value"
               FROM SAMPLE_INSPECT_RESULTS
               WHERE COMPANY = :1 AND PLANT_CD = :2
                 AND MEASURED_VALUE IS NOT NULL`;
    if (from) { bind.push(from); sql += ` AND INSPECT_DATE >= TO_DATE(:${bind.length}, 'YYYY-MM-DD')`; }
    if (to) { bind.push(to); sql += ` AND INSPECT_DATE < TO_DATE(:${bind.length}, 'YYYY-MM-DD') + 1`; }
    sql += ` ORDER BY INSPECT_DATE ASC`;

    const rows: { date: string; value: number }[] = await this.dataSource.query(sql, bind);
    return this.groupMeasurements(rows, 'IQC', chart.subgroupSize);
  }

  /** PROCESS: INSPECT_RESULTS에서 측정값 조회 */
  private async fetchFromProcess(
    chart: SpcChart, from?: string, to?: string,
  ): Promise<{ source: string; date: string; values: number[] }[]> {
    const bind: unknown[] = [chart.company, chart.plant];
    let sql = `SELECT TO_CHAR(INSPECT_TIME, 'YYYY-MM-DD') AS "date", INSPECT_DATA AS "value"
               FROM INSPECT_RESULTS
               WHERE COMPANY = :1 AND PLANT_CD = :2
                 AND INSPECT_DATA IS NOT NULL`;
    if (from) { bind.push(from); sql += ` AND INSPECT_TIME >= TO_DATE(:${bind.length}, 'YYYY-MM-DD')`; }
    if (to) { bind.push(to); sql += ` AND INSPECT_TIME < TO_DATE(:${bind.length}, 'YYYY-MM-DD') + INTERVAL '1' DAY`; }
    sql += ` ORDER BY INSPECT_TIME ASC`;

    const rows: { date: string; value: number }[] = await this.dataSource.query(sql, bind);
    return this.groupMeasurements(rows, 'PROCESS', chart.subgroupSize);
  }

  /** OQC: OQC_REQUESTS에서 측정값 조회 */
  private async fetchFromOqc(
    chart: SpcChart, from?: string, to?: string,
  ): Promise<{ source: string; date: string; values: number[] }[]> {
    const bind: unknown[] = [chart.company, chart.plant, chart.itemCode];
    let sql = `SELECT TO_CHAR(INSPECT_DATE, 'YYYY-MM-DD') AS "date", DETAILS AS "value"
               FROM OQC_REQUESTS
               WHERE COMPANY = :1 AND PLANT_CD = :2
                 AND ITEM_CODE = :3 AND DETAILS IS NOT NULL`;
    if (from) { bind.push(from); sql += ` AND INSPECT_DATE >= TO_DATE(:${bind.length}, 'YYYY-MM-DD')`; }
    if (to) { bind.push(to); sql += ` AND INSPECT_DATE < TO_DATE(:${bind.length}, 'YYYY-MM-DD') + 1`; }
    sql += ` ORDER BY INSPECT_DATE ASC`;

    const rows: { date: string; value: number }[] = await this.dataSource.query(sql, bind);
    return this.groupMeasurements(rows, 'OQC', chart.subgroupSize);
  }

  /** 개별 측정값을 서브그룹 크기로 그룹핑 */
  private groupMeasurements(
    rows: { date: string; value: number }[],
    source: string,
    subgroupSize: number,
  ): { source: string; date: string; values: number[] }[] {
    const result: { source: string; date: string; values: number[] }[] = [];
    for (let i = 0; i < rows.length; i += subgroupSize) {
      const group = rows.slice(i, i + subgroupSize);
      if (group.length === subgroupSize) {
        result.push({
          source,
          date: group[0].date,
          values: group.map(g => Number(g.value)),
        });
      }
    }
    return result;
  }
}

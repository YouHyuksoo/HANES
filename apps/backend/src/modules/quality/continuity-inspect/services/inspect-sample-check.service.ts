/**
 * @file inspect-sample-check.service.ts
 * @description 양불마스터(한도견본) 대조 — 후보 조회, 준비 상태 판정, 대조 결과 저장
 *
 * 초보자 가이드:
 * 1. 후보는 양불마스터(LIMIT_SAMPLES)에서 읽는다. 검사홀더·지그(INSPECT_AIDS)는 대조 대상이 아니다.
 * 2. 기대결과: 양품견본(OK)=PASS, 불량견본(NG)=FAIL.
 *    작업자는 검사기 실제결과만 입력하고 OK/NG는 서버가 비교해 산출한다.
 * 3. 판정 단위: 작업지시 x 검사유형 x 검사기 x 조업일 x 교대. 재대조는 새 기록으로 쌓인다.
 * 4. 필수 견본이 0건이면 대조 대상이 아니므로 통과 처리한다(소모품 인터락과 같은 관례).
 * 5. 필수 견본이 만료·비활성이면 대조 자체가 불가하고 검사도 막힌다.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { LimitSample } from '../../../../entities/limit-sample.entity';
import { LimitSampleImage } from '../../../../entities/limit-sample-image.entity';
import { InspectSampleCheck } from '../../../../entities/inspect-sample-check.entity';
import { InspectSampleCheckItem } from '../../../../entities/inspect-sample-check-item.entity';
import { ShiftPattern } from '../../../../entities/shift-pattern.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { TransactionService } from '../../../../shared/transaction.service';
import { EquipInspectService } from '../../../equipment/services/equip-inspect.service';
import { ShiftResolver } from '../../../../utils/shift-resolver';
import { formatYmdLocal } from '../../../../shared/date.util';
import { CreateSampleCheckDto } from '../dto/inspect-sample-check.dto';

/** 대조 대상 견본 유형 (COM_CODES LIMIT_SAMPLE_TYPE) */
const SAMPLE_TYPES = ['OK', 'NG'] as const;
/** 교대 미판별 시 저장값 (NULL 키는 유일성 판정이 불가하므로 센티넬 대신 명시값을 쓴다) */
const SHIFT_NONE = 'NONE';

export interface SampleCheckCandidate {
  sampleCode: string;
  sampleName: string;
  sampleType: string;
  expectedResult: 'PASS' | 'FAIL';
  requiredYn: string;
  sortOrder: number;
  imageUrl: string | null;
  defectCode: string | null;
  location: string | null;
  validTo: string | null;
  status: string;
  expired: boolean;
}

export interface SampleCheckStatus {
  required: boolean;
  done: boolean;
  checkNo: string | null;
  overallResult: string | null;
  checkedAt: string | null;
  workDate: string;
  shiftCode: string;
  candidateCount: number;
  blockReason: string | null;
}

export interface SampleCheckHistoryRow {
  checkNo: string;
  orderNo: string;
  inspectType: string;
  equipCode: string;
  workDate: string;
  shiftCode: string;
  overallResult: string;
  checkerId: string | null;
  checkedAt: string | null;
  createdBy: string | null;
  items: {
    seqNo: number;
    sampleCode: string;
    sampleType: string;
    expectedResult: string;
    actualResult: string;
    result: string;
    remark: string | null;
  }[];
}

interface SampleCheckKeyArgs {
  orderNo: string;
  inspectType: string;
  equipCode: string;
  itemCode: string;
}

interface TenantArgs {
  company?: string;
  plant?: string;
}

interface ActorArgs {
  userId: string;
  workerId?: string | null;
}

@Injectable()
export class InspectSampleCheckService {
  private readonly shiftResolver: ShiftResolver;

  constructor(
    @InjectRepository(LimitSample)
    private readonly limitSampleRepository: Repository<LimitSample>,
    @InjectRepository(LimitSampleImage)
    private readonly limitSampleImageRepository: Repository<LimitSampleImage>,
    @InjectRepository(InspectSampleCheck)
    private readonly checkRepository: Repository<InspectSampleCheck>,
    @InjectRepository(InspectSampleCheckItem)
    private readonly checkItemRepository: Repository<InspectSampleCheckItem>,
    @InjectRepository(ShiftPattern)
    private readonly shiftPatternRepository: Repository<ShiftPattern>,
    private readonly seqGenerator: SeqGeneratorService,
    private readonly equipInspectService: EquipInspectService,
    private readonly tx: TransactionService,
  ) {
    this.shiftResolver = new ShiftResolver(this.shiftPatternRepository);
  }

  /** 스캔값·코드 정규화 — 앞뒤 공백 제거 후 대문자 */
  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private toYmd(value: Date | string | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatYmdLocal(date);
  }

  private toCandidate(
    sample: LimitSample,
    todayYmd: string,
    imageUrl: string | null,
  ): SampleCheckCandidate {
    const validTo = this.toYmd(sample.validTo);
    const expired = (validTo != null && validTo < todayYmd) || sample.status !== 'ACTIVE';
    return {
      sampleCode: sample.sampleCode,
      sampleName: sample.sampleName,
      sampleType: sample.sampleType,
      expectedResult: sample.sampleType === 'OK' ? 'PASS' : 'FAIL',
      requiredYn: sample.requiredYn ?? 'Y',
      sortOrder: sample.sortOrder ?? 0,
      imageUrl,
      defectCode: sample.defectCode ?? null,
      location: sample.location ?? null,
      validTo,
      status: sample.status,
      expired,
    };
  }

  /**
   * 후보 견본들의 대표 사진을 한 번에 읽어 코드별 1장으로 줄인다 (N+1 방지).
   * 대표(IS_PRIMARY='Y')가 없으면 표시순서상 첫 사진을 쓴다.
   */
  private async loadPrimaryImages(
    sampleCodes: string[],
    tenant: TenantArgs,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (sampleCodes.length === 0) return map;
    const rows = await this.limitSampleImageRepository.find({
      where: {
        ...(tenant.company ? { company: tenant.company } : {}),
        ...(tenant.plant ? { plant: tenant.plant } : {}),
        sampleCode: In(sampleCodes),
      },
    });
    const best = new Map<string, LimitSampleImage>();
    for (const row of rows) {
      const current = best.get(row.sampleCode);
      if (!current) {
        best.set(row.sampleCode, row);
        continue;
      }
      const rowWins = row.isPrimary === 'Y' && current.isPrimary !== 'Y';
      const sameRank = (row.isPrimary === 'Y') === (current.isPrimary === 'Y');
      const earlier = row.sortOrder - current.sortOrder || row.seqNo - current.seqNo;
      if (rowWins || (sameRank && earlier < 0)) best.set(row.sampleCode, row);
    }
    for (const [code, row] of best) map.set(code, row.imageUrl);
    return map;
  }

  /**
   * 품목·검사유형 기준 대조 대상 한도견본.
   * 품목이 비어 있는 견본(공용)과 검사유형이 비어 있는 견본(전 검사유형 공통)도 포함한다.
   */
  async getCandidates(
    itemCode: string,
    inspectType: string,
    tenant: TenantArgs,
  ): Promise<SampleCheckCandidate[]> {
    const tenantWhere = {
      ...(tenant.company ? { company: tenant.company } : {}),
      ...(tenant.plant ? { plant: tenant.plant } : {}),
      useYn: 'Y',
    };
    const where = SAMPLE_TYPES.flatMap((sampleType) =>
      [itemCode, null].flatMap((item) =>
        [inspectType, null].map((type) => ({
          ...tenantWhere,
          sampleType,
          itemCode: item === null ? IsNull() : item,
          inspectType: type === null ? IsNull() : type,
        })),
      ),
    );

    const rows = await this.limitSampleRepository.find({ where });
    const imageMap = await this.loadPrimaryImages(rows.map((r) => r.sampleCode), tenant);
    const todayYmd = formatYmdLocal(new Date());
    const unique = new Map<string, SampleCheckCandidate>();
    for (const row of rows) {
      unique.set(row.sampleCode, this.toCandidate(row, todayYmd, imageMap.get(row.sampleCode) ?? null));
    }
    return [...unique.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.sampleCode.localeCompare(b.sampleCode),
    );
  }

  /** 조업일·교대 산출 — 조업일은 설비점검과 같은 window 판정을 재사용한다. */
  private async resolveWindow(
    equipCode: string,
    tenant: TenantArgs,
  ): Promise<{ workDate: string; shiftCode: string }> {
    const today = formatYmdLocal(new Date());
    let workDate = today;
    try {
      const status = await this.equipInspectService.getInspectionStatus(
        { equipCode, inspectType: 'DAILY', inspectDate: today },
        { company: tenant.company, plant: tenant.plant },
      );
      if (status?.workDate) workDate = status.workDate;
    } catch (error: unknown) {
      // 설비 조회 실패 등으로 조업일을 못 얻으면 당일을 쓴다. 판정을 임의로 통과시키지는 않는다.
      workDate = today;
    }
    const shiftCode = tenant.company && tenant.plant
      ? (await this.shiftResolver.resolve(new Date(), tenant.company, tenant.plant)) ?? SHIFT_NONE
      : SHIFT_NONE;
    return { workDate, shiftCode };
  }

  private async findLatestCheck(
    args: SampleCheckKeyArgs,
    window: { workDate: string; shiftCode: string },
    tenant: TenantArgs,
  ): Promise<InspectSampleCheck | null> {
    return this.checkRepository.findOne({
      where: {
        ...(tenant.company ? { company: tenant.company } : {}),
        ...(tenant.plant ? { plant: tenant.plant } : {}),
        orderNo: args.orderNo,
        inspectType: args.inspectType,
        equipCode: args.equipCode,
        workDate: new Date(`${window.workDate}T00:00:00`),
        shiftCode: window.shiftCode,
      },
      order: { checkedAt: 'DESC' },
    });
  }

  async getStatus(args: SampleCheckKeyArgs, tenant: TenantArgs): Promise<SampleCheckStatus> {
    const candidates = await this.getCandidates(args.itemCode, args.inspectType, tenant);
    const required = candidates.filter((c) => c.requiredYn === 'Y');
    const window = await this.resolveWindow(args.equipCode, tenant);

    if (required.length === 0) {
      return {
        required: false,
        done: true,
        checkNo: null,
        overallResult: null,
        checkedAt: null,
        workDate: window.workDate,
        shiftCode: window.shiftCode,
        candidateCount: candidates.length,
        blockReason: null,
      };
    }

    const expired = required.find((c) => c.expired);
    if (expired) {
      return {
        required: true,
        done: false,
        checkNo: null,
        overallResult: null,
        checkedAt: null,
        workDate: window.workDate,
        shiftCode: window.shiftCode,
        candidateCount: candidates.length,
        blockReason: `한도견본 유효기간이 만료되어 대조할 수 없습니다: ${expired.sampleCode} (만료 ${expired.validTo ?? '미설정'}) — 기준정보에서 갱신하세요.`,
      };
    }

    const latest = await this.findLatestCheck(args, window, tenant);
    if (!latest) {
      return {
        required: true,
        done: false,
        checkNo: null,
        overallResult: null,
        checkedAt: null,
        workDate: window.workDate,
        shiftCode: window.shiftCode,
        candidateCount: candidates.length,
        blockReason: `양불마스터 대조를 완료해야 검사를 등록할 수 있습니다: ${args.equipCode} (${window.workDate} ${window.shiftCode})`,
      };
    }

    const done = latest.overallResult === 'PASS';
    return {
      required: true,
      done,
      checkNo: latest.checkNo,
      overallResult: latest.overallResult,
      checkedAt: latest.checkedAt ? new Date(latest.checkedAt).toISOString() : null,
      workDate: window.workDate,
      shiftCode: window.shiftCode,
      candidateCount: candidates.length,
      blockReason: done
        ? null
        : `양불마스터 대조 결과가 불합격입니다 — 검사기 점검 후 재대조하세요: ${latest.checkNo}`,
    };
  }

  /** 검사 등록 전 대조 완료 여부 강제 */
  async assertReady(args: SampleCheckKeyArgs, tenant: TenantArgs): Promise<void> {
    const status = await this.getStatus(args, tenant);
    if (status.required && !status.done) {
      throw new BadRequestException(
        status.blockReason ?? `양불마스터 대조를 완료해야 검사를 등록할 수 있습니다: ${args.equipCode}`,
      );
    }
  }

  async create(
    dto: CreateSampleCheckDto,
    actor: ActorArgs,
    tenant: TenantArgs,
  ): Promise<{ checkNo: string; overallResult: 'PASS' | 'NG' }> {
    const candidates = await this.getCandidates(dto.itemCode, dto.inspectType, tenant);
    const byCode = new Map(candidates.map((c) => [this.normalizeCode(c.sampleCode), c]));

    // 1) 후보에 없는 코드 거부 (다른 품목·다른 검사유형·미등록 견본 스캔)
    const requested = dto.items.map((item) => ({ ...item, sampleCode: this.normalizeCode(item.sampleCode) }));
    for (const item of requested) {
      if (!byCode.has(item.sampleCode)) {
        throw new BadRequestException(`등록되지 않은 한도견본입니다: ${item.sampleCode}`);
      }
    }

    // 2) 필수 견본 누락 거부
    const requestedCodes = new Set(requested.map((item) => item.sampleCode));
    const missing = candidates
      .filter((c) => c.requiredYn === 'Y')
      .find((c) => !requestedCodes.has(this.normalizeCode(c.sampleCode)));
    if (missing) {
      throw new BadRequestException(`필수 한도견본 대조가 누락되었습니다: ${missing.sampleCode}`);
    }

    // 3) 만료 견본 거부
    for (const item of requested) {
      const candidate = byCode.get(item.sampleCode);
      if (candidate?.expired) {
        throw new BadRequestException(
          `한도견본 유효기간이 만료되어 대조할 수 없습니다: ${candidate.sampleCode} (만료 ${candidate.validTo ?? '미설정'})`,
        );
      }
    }

    const window = await this.resolveWindow(dto.equipCode, tenant);
    const checkedAt = new Date();
    const rows = requested.map((item, index) => {
      const candidate = byCode.get(item.sampleCode)!;
      const result = item.actualResult === candidate.expectedResult ? 'OK' : 'NG';
      return { index: index + 1, candidate, item, result };
    });
    const overallResult: 'PASS' | 'NG' = rows.every(
      (row) => row.candidate.requiredYn !== 'Y' || row.result === 'OK',
    )
      ? 'PASS'
      : 'NG';

    // 트랜잭션 제어는 공용 TransactionService만 쓴다(아키텍처 경계 규칙).
    return this.tx.run(async (queryRunner) => {
      const checkNo = await this.seqGenerator.getNo('SMP_CHK', queryRunner);
      const header: Partial<InspectSampleCheck> = {
        company: tenant.company ?? '',
        plant: tenant.plant ?? '',
        checkNo,
        orderNo: dto.orderNo,
        inspectType: dto.inspectType,
        equipCode: dto.equipCode,
        itemCode: dto.itemCode,
        workDate: new Date(`${window.workDate}T00:00:00`),
        shiftCode: window.shiftCode,
        overallResult,
        checkerId: actor.workerId ?? actor.userId,
        checkedAt,
        remark: dto.remark ?? null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      };
      await queryRunner.manager.save(InspectSampleCheck, header);

      const items: Partial<InspectSampleCheckItem>[] = rows.map((row) => ({
        company: tenant.company ?? '',
        plant: tenant.plant ?? '',
        checkNo,
        seqNo: row.index,
        sampleCode: row.candidate.sampleCode,
        sampleType: row.candidate.sampleType,
        expectedResult: row.candidate.expectedResult,
        actualResult: row.item.actualResult,
        result: row.result,
        scannedAt: row.item.scannedAt ? new Date(row.item.scannedAt) : null,
        remark: row.item.remark ?? null,
        createdBy: actor.userId,
      }));
      await queryRunner.manager.save(InspectSampleCheckItem, items);

      return { checkNo, overallResult };
    });
  }

  async findHistory(
    args: { orderNo: string; inspectType: string },
    tenant: TenantArgs,
  ): Promise<SampleCheckHistoryRow[]> {
    const headers = await this.checkRepository.find({
      where: {
        ...(tenant.company ? { company: tenant.company } : {}),
        ...(tenant.plant ? { plant: tenant.plant } : {}),
        orderNo: args.orderNo,
        inspectType: args.inspectType,
      },
      order: { checkedAt: 'DESC' },
      take: 50,
    });
    if (headers.length === 0) return [];

    const items = await this.checkItemRepository.find({
      where: headers.map((header) => ({
        company: header.company,
        plant: header.plant,
        checkNo: header.checkNo,
      })),
      order: { seqNo: 'ASC' },
    });
    const byCheckNo = new Map<string, InspectSampleCheckItem[]>();
    for (const item of items) {
      const list = byCheckNo.get(item.checkNo) ?? [];
      list.push(item);
      byCheckNo.set(item.checkNo, list);
    }

    return headers.map((header) => ({
      checkNo: header.checkNo,
      orderNo: header.orderNo,
      inspectType: header.inspectType,
      equipCode: header.equipCode,
      workDate: this.toYmd(header.workDate) ?? '',
      shiftCode: header.shiftCode,
      overallResult: header.overallResult,
      checkerId: header.checkerId ?? null,
      checkedAt: header.checkedAt ? new Date(header.checkedAt).toISOString() : null,
      createdBy: header.createdBy ?? null,
      items: (byCheckNo.get(header.checkNo) ?? []).map((item) => ({
        seqNo: item.seqNo,
        sampleCode: item.sampleCode,
        sampleType: item.sampleType,
        expectedResult: item.expectedResult,
        actualResult: item.actualResult,
        result: item.result,
        remark: item.remark ?? null,
      })),
    }));
  }
}

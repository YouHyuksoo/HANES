import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AqlAcceptanceRule } from '../../../../entities/aql-acceptance-rule.entity';
import { AqlCodeLetterRule } from '../../../../entities/aql-code-letter-rule.entity';
import { AqlCodeLetterSample } from '../../../../entities/aql-code-letter-sample.entity';
import { AqlStandard } from '../../../../entities/aql-standard.entity';
import { DefectCodeMaster } from '../../../../entities/defect-code-master.entity';
import { IqcAqlPolicy } from '../../../../entities/iqc-aql-policy.entity';
import { IqcLog } from '../../../../entities/iqc-log.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import { PartnerMaster } from '../../../../entities/partner-master.entity';
import { VendorInspectionModeHistory } from '../../../../entities/vendor-inspection-mode-history.entity';
import { IqcPartSpecItem } from '../../../../entities/iqc-part-spec-item.entity';
import {
  AqlQueryDto,
  AqlRuleDto,
  CreateAqlDto,
  CreateIqcAqlPolicyDto,
  UpdateAqlDto,
  UpdateIqcAqlPolicyDto,
} from '../dto/aql.dto';

type IqcDefectCounts = {
  critical?: number | null;
  major?: number | null;
  minor?: number | null;
};

type IqcDefectCodeCount = {
  defectCode: string;
  qty?: number | null;
};

type AqlSeverityRule = {
  aqlCode: string;
  aqlValue: number;
  codeLetter: string | null;
  sampleCodeLetter?: string | null;
  sampleSize: number;
  standardSampleSize?: number;
  actualInspectQty?: number;
  acceptQty: number;
  rejectQty: number;
};

export type IqcItemJudgeResult = {
  seq: number;
  inspItemCode: string;
  defectGrade: string;
  inspectionLevel: string;
  aql: number | null;
  defectCount: number;
  acceptQty: number | null;
  rejectQty: number | null;
  inspectionType: string;
  requiredQty: number | null;
  inspectedQty: number | null;
  result: 'PASS' | 'FAIL';
  reason: string;
};

export type IqcAqlPolicyResolution = {
  itemCode: string;
  vendorCode: string | null;
  lotQty: number;
  policyCode: string | null;
  inspectionLevel: string;
  inspectionMode: string;
  result: 'PASS' | 'FAIL';
  sampleQty: number;
  defectCritical: number;
  defectMajor: number;
  defectMinor: number;
  majorRule: AqlSeverityRule | null;
  minorRule: AqlSeverityRule | null;
  judgeReason: string;
  /** 검사항목별 판정 결과 (검사항목별 모델에서만 채워짐) */
  itemResults?: IqcItemJudgeResult[];
};

@Injectable()
export class AqlService {
  constructor(
    @InjectRepository(AqlStandard)
    private readonly standardRepo: Repository<AqlStandard>,
    @InjectRepository(AqlCodeLetterRule)
    private readonly codeLetterRuleRepo: Repository<AqlCodeLetterRule>,
    @InjectRepository(AqlCodeLetterSample)
    private readonly codeLetterSampleRepo: Repository<AqlCodeLetterSample>,
    @InjectRepository(AqlAcceptanceRule)
    private readonly acceptanceRuleRepo: Repository<AqlAcceptanceRule>,
    @InjectRepository(IqcAqlPolicy)
    private readonly policyRepo: Repository<IqcAqlPolicy>,
    @InjectRepository(ItemMaster)
    private readonly partRepo: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerRepo: Repository<PartnerMaster>,
    @InjectRepository(IqcLog)
    private readonly iqcLogRepo: Repository<IqcLog>,
    @InjectRepository(VendorInspectionModeHistory)
    private readonly modeHistoryRepo: Repository<VendorInspectionModeHistory>,
    @InjectRepository(DefectCodeMaster)
    private readonly defectCodeRepo: Repository<DefectCodeMaster>,
    @InjectRepository(IqcPartSpecItem)
    private readonly specItemRepo: Repository<IqcPartSpecItem>,
  ) {}

  async findAll(query: AqlQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, useYn } = query;
    const qb = this.standardRepo.createQueryBuilder('aql');

    if (company) qb.andWhere('aql.company = :company', { company });
    if (plant) qb.andWhere('aql.plant = :plant', { plant });
    if (useYn) qb.andWhere('aql.useYn = :useYn', { useYn });
    if (search) {
      qb.andWhere('(UPPER(aql.aqlCode) LIKE UPPER(:search) OR UPPER(aql.aqlName) LIKE UPPER(:search))', {
        search: `%${search}%`,
      });
    }

    const [data, total] = await qb
      .orderBy('aql.aqlCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(aqlCode: string, company?: string, plant?: string) {
    const standard = await this.findStandardOrThrow(aqlCode, company, plant);
    return { ...standard, rules: [] };
  }

  async findIsoTables(company: string, plant: string) {
    const [codeLetterRules, samples, acceptanceRules] = await Promise.all([
      this.codeLetterRuleRepo.find({
        where: { company, plant },
        order: { inspectionLevel: 'ASC', lotQtyFrom: 'ASC' },
      }),
      this.codeLetterSampleRepo.find({
        where: { company, plant },
        order: { sortOrder: 'ASC' },
      }),
      this.acceptanceRuleRepo.find({
        where: { company, plant, inspectionMode: 'NORMAL' },
        order: { codeLetter: 'ASC', aqlValue: 'ASC' },
      }),
    ]);
    return { codeLetterRules, samples, acceptanceRules };
  }

  async findPolicies(query: { useYn?: string }, company?: string, plant?: string) {
    const qb = this.policyRepo.createQueryBuilder('policy');
    if (company) qb.andWhere('policy.company = :company', { company });
    if (plant) qb.andWhere('policy.plant = :plant', { plant });
    if (query.useYn) qb.andWhere('policy.useYn = :useYn', { useYn: query.useYn });
    return qb.orderBy('policy.policyCode', 'ASC').getMany();
  }

  async createPolicy(dto: CreateIqcAqlPolicyDto, company: string, plant: string, userId: string) {
    const policyCode = this.normalizeCode(dto.policyCode);
    const exists = await this.policyRepo.findOne({ where: { company, plant, policyCode } });
    if (exists) throw new BadRequestException(`이미 등록된 IQC AQL 정책입니다: ${policyCode}`);
    await this.assertPolicyAqlCodesActive(dto.majorAqlCode, dto.minorAqlCode, company, plant);

    const policy = this.policyRepo.create({
      company,
      plant,
      policyCode,
      policyName: dto.policyName.trim(),
      inspectionLevel: dto.inspectionLevel || null,
      majorAqlCode: dto.majorAqlCode ? this.normalizeCode(dto.majorAqlCode) : null,
      minorAqlCode: dto.minorAqlCode ? this.normalizeCode(dto.minorAqlCode) : null,
      criticalMode: 'IMMEDIATE_FAIL',
      useYn: dto.useYn ?? 'Y',
      remark: dto.remark ?? null,
      createdBy: userId,
      updatedBy: userId,
    });
    await this.policyRepo.save(policy);
    return policy;
  }

  async updatePolicy(policyCodeParam: string, dto: UpdateIqcAqlPolicyDto, company: string, plant: string, userId: string) {
    const policy = await this.findPolicyOrThrow(policyCodeParam, company, plant, { allowInactive: true });
    await this.assertPolicyAqlCodesActive(
      dto.majorAqlCode ?? policy.majorAqlCode ?? undefined,
      dto.minorAqlCode ?? policy.minorAqlCode ?? undefined,
      company,
      plant,
    );

    Object.assign(policy, {
      policyName: dto.policyName ?? policy.policyName,
      inspectionLevel: dto.inspectionLevel ?? policy.inspectionLevel,
      majorAqlCode: dto.majorAqlCode !== undefined ? (dto.majorAqlCode ? this.normalizeCode(dto.majorAqlCode) : null) : policy.majorAqlCode,
      minorAqlCode: dto.minorAqlCode !== undefined ? (dto.minorAqlCode ? this.normalizeCode(dto.minorAqlCode) : null) : policy.minorAqlCode,
      useYn: dto.useYn ?? policy.useYn,
      remark: dto.remark ?? policy.remark,
      updatedBy: userId,
    });
    await this.policyRepo.save(policy);
    return policy;
  }

  async deletePolicy(policyCodeParam: string, company: string, plant: string, userId = 'system') {
    const policy = await this.findPolicyOrThrow(policyCodeParam, company, plant, { allowInactive: true });
    const assignedCount = await this.partRepo.count({ where: { company, plant, iqcAqlPolicyCode: policy.policyCode } });
    if (assignedCount > 0) throw new BadRequestException('품목에 배정된 AQL 정책은 사용중지할 수 없습니다.');
    policy.useYn = 'N';
    policy.updatedBy = userId;
    await this.policyRepo.save(policy);
    return { policyCode: policy.policyCode, deleted: true };
  }

  async create(dto: CreateAqlDto, company: string, plant: string, userId: string) {
    const aqlCode = this.normalizeCode(dto.aqlCode);
    const exists = await this.standardRepo.findOne({ where: { company, plant, aqlCode } });
    if (exists) throw new BadRequestException(`이미 등록된 AQL 코드입니다: ${aqlCode}`);

    this.assertValidRules(dto.rules ?? []);
    const standard = this.standardRepo.create({
      company,
      plant,
      aqlCode,
      aqlName: dto.aqlName,
      inspectionLevel: dto.inspectionLevel ?? null,
      aqlValue: dto.aqlValue ?? null,
      useYn: dto.useYn ?? 'Y',
      remark: dto.remark ?? null,
      createdBy: userId,
      updatedBy: userId,
    });
    await this.standardRepo.save(standard);
    await this.replaceRules(aqlCode, dto.rules ?? [], company, plant, userId);
    return this.findOne(aqlCode, company, plant);
  }

  async update(aqlCodeParam: string, dto: UpdateAqlDto, company: string, plant: string, userId: string) {
    const aqlCode = this.normalizeCode(aqlCodeParam);
    const standard = await this.findStandardOrThrow(aqlCode, company, plant);
    const rules = dto.rules ?? undefined;
    if (rules) this.assertValidRules(rules);

    Object.assign(standard, {
      aqlName: dto.aqlName ?? standard.aqlName,
      inspectionLevel: dto.inspectionLevel ?? standard.inspectionLevel,
      aqlValue: dto.aqlValue ?? standard.aqlValue,
      useYn: dto.useYn ?? standard.useYn,
      remark: dto.remark ?? standard.remark,
      updatedBy: userId,
    });
    await this.standardRepo.save(standard);
    if (rules) await this.replaceRules(aqlCode, rules, company, plant, userId);
    return this.findOne(aqlCode, company, plant);
  }

  async delete(aqlCodeParam: string, company: string, plant: string, userId = 'system') {
    const aqlCode = this.normalizeCode(aqlCodeParam);
    const standard = await this.findStandardOrThrow(aqlCode, company, plant);
    const assignedPolicyCount = await this.policyRepo.count({
      where: [
        { company, plant, useYn: 'Y', majorAqlCode: aqlCode },
        { company, plant, useYn: 'Y', minorAqlCode: aqlCode },
      ],
    });
    if (assignedPolicyCount > 0) {
      throw new BadRequestException('IQC AQL 정책에서 참조 중인 AQL 기준은 사용중지할 수 없습니다.');
    }
    standard.useYn = 'N';
    standard.updatedBy = userId;
    await this.standardRepo.save(standard);
    return { aqlCode, deleted: true };
  }

  async resolveByAqlCode(aqlCodeParam: string, lotQty: number, company?: string, plant?: string) {
    const aqlCode = this.normalizeCode(aqlCodeParam);
    const standard = await this.findStandardOrThrow(aqlCode, company, plant);
    if (standard.useYn !== 'Y') throw new BadRequestException('사용 중지된 AQL 기준입니다.');

    const rule = await this.resolveIsoRule({
      aqlCode,
      aqlValue: this.resolveAqlValue(standard.aqlValue, aqlCode),
      inspectionLevel: standard.inspectionLevel ?? 'II',
      inspectionMode: 'NORMAL',
      lotQty,
      company: standard.company,
      plant: standard.plant,
    });
    return {
      aqlCode,
      aqlName: standard.aqlName,
      lotQty,
      ...rule,
    };
  }

  async resolveIqcPolicy(input: {
    itemCode: string;
    vendorCode?: string | null;
    lotQty: number;
    defectCounts?: IqcDefectCounts;
    defectCodes?: IqcDefectCodeCount[];
    company?: string;
    plant?: string;
  }): Promise<IqcAqlPolicyResolution> {
    const part = await this.partRepo.findOne({
      where: {
        itemCode: input.itemCode,
        ...(input.company ? { company: input.company } : {}),
        ...(input.plant ? { plant: input.plant } : {}),
      },
    });
    if (!part) throw new NotFoundException(`품목 AQL 기준을 찾을 수 없습니다: ${input.itemCode}`);

    const vendorCode = input.vendorCode?.trim() || null;
    const partner = vendorCode
      ? await this.partnerRepo.findOne({
          where: {
            partnerCode: vendorCode,
            ...(input.company ? { company: input.company } : {}),
            ...(input.plant ? { plant: input.plant } : {}),
          },
        })
      : null;

    const policy = await this.resolvePartPolicy(part, input.company, input.plant);
    const inspectionLevel = (policy?.inspectionLevel || 'II').trim().toUpperCase();
    const inspectionMode = this.normalizeInspectionMode(partner?.inspectionMode);
    const lotQty = Math.max(1, Number(input.lotQty) || 1);
    const defectCounts = await this.resolveIqcDefectCounts(input.defectCounts, input.defectCodes, input.company, input.plant);
    const defectCritical = defectCounts.critical;
    const defectMajor = defectCounts.major;
    const defectMinor = defectCounts.minor;

    const majorRule = policy?.majorAqlCode
      ? await this.resolveRuleByStandardCode(policy.majorAqlCode, lotQty, input.company, input.plant)
      : null;
    const minorRule = policy?.minorAqlCode
      ? await this.resolveRuleByStandardCode(policy.minorAqlCode, lotQty, input.company, input.plant)
      : null;

    let result: 'PASS' | 'FAIL' = 'PASS';
    let judgeReason = 'AQL 기준 합격';

    if (defectCritical > 0) {
      result = 'FAIL';
      judgeReason = 'Critical 불량 1건 이상으로 즉시 불합격';
    } else if (majorRule && defectMajor > majorRule.acceptQty) {
      result = 'FAIL';
      judgeReason = `Major 불량 ${defectMajor}건이 Ac ${majorRule.acceptQty} 초과`;
    } else if (minorRule && defectMinor > minorRule.acceptQty) {
      result = 'FAIL';
      judgeReason = `Minor 불량 ${defectMinor}건이 Ac ${minorRule.acceptQty} 초과`;
    }

    return {
      itemCode: part.itemCode,
      vendorCode,
      lotQty,
      policyCode: policy?.policyCode ?? null,
      inspectionLevel,
      inspectionMode,
      result,
      sampleQty: Math.max(majorRule?.sampleSize ?? 0, minorRule?.sampleSize ?? 0),
      defectCritical,
      defectMajor,
      defectMinor,
      majorRule,
      minorRule,
      judgeReason,
    };
  }

  /**
   * 검사항목별 AQL 판정 — 각 검사항목(IQC_PART_SPEC_ITEMS)의 검사수준/불량등급/AQL로 항목별 Ac/Re 산출 후 판정.
   * - CRITICAL 등급 항목: 불량 1건 이상이면 FAIL
   * - MAJOR/MINOR 등급 항목: AQL→Ac 초과 시 FAIL (AQL 미설정 시 1건 이상 FAIL로 보수 판정)
   * - 항목 중 하나라도 FAIL이면 LOT FAIL
   * 등급(DEFECT_GRADE)이 설정된 검사항목이 없으면 기존 품목 단일 resolveIqcPolicy로 폴백한다.
   */
  async resolveIqcPolicyByItem(input: {
    itemCode: string;
    vendorCode?: string | null;
    lotQty: number;
    itemDefectCounts: Record<number, number>; // seq -> FAIL 샘플 수
    itemInspectedCounts?: Record<number, number>; // seq -> 실제 검사수량(파괴/전수용)
    fallbackDefectCounts?: IqcDefectCounts;
    fallbackDefectCodes?: IqcDefectCodeCount[];
    company?: string;
    plant?: string;
  }): Promise<IqcAqlPolicyResolution> {
    const specItems = await this.specItemRepo.find({
      where: {
        itemCode: input.itemCode,
        useYn: 'Y',
        ...(input.company ? { company: input.company } : {}),
        ...(input.plant ? { plant: input.plant } : {}),
      },
      order: { seq: 'ASC' },
    });
    const activeItems = specItems.filter((item) => {
      const grade = String(item.defectGrade ?? '').trim().toUpperCase();
      const type = String(item.inspectionType ?? 'AQL').trim().toUpperCase();
      return ['CRITICAL', 'MAJOR', 'MINOR'].includes(grade) || ['DESTRUCTIVE', 'FULL'].includes(type);
    });

    // 등급 설정 검사항목이 없으면 기존 품목 단일 모델로 폴백
    if (activeItems.length === 0) {
      return this.resolveIqcPolicy({
        itemCode: input.itemCode,
        vendorCode: input.vendorCode,
        lotQty: input.lotQty,
        defectCounts: input.fallbackDefectCounts,
        defectCodes: input.fallbackDefectCodes,
        company: input.company,
        plant: input.plant,
      });
    }

    const part = await this.partRepo.findOne({
      where: {
        itemCode: input.itemCode,
        ...(input.company ? { company: input.company } : {}),
        ...(input.plant ? { plant: input.plant } : {}),
      },
    });
    const vendorCode = input.vendorCode?.trim() || null;
    const partner = vendorCode
      ? await this.partnerRepo.findOne({
          where: {
            partnerCode: vendorCode,
            ...(input.company ? { company: input.company } : {}),
            ...(input.plant ? { plant: input.plant } : {}),
          },
        })
      : null;

    const policy = part ? await this.resolvePartPolicy(part, input.company, input.plant) : null;
    const partLevel = (policy?.inspectionLevel || 'II').trim().toUpperCase();
    const inspectionMode = this.normalizeInspectionMode(partner?.inspectionMode);
    const lotQty = Math.max(1, Number(input.lotQty) || 1);

    let result: 'PASS' | 'FAIL' = 'PASS';
    let defectCritical = 0;
    let defectMajor = 0;
    let defectMinor = 0;
    let sampleQty = 0;
    let majorRule: AqlSeverityRule | null = null;
    let minorRule: AqlSeverityRule | null = null;
    const itemResults: IqcItemJudgeResult[] = [];
    const failReasons: string[] = [];

    for (const item of activeItems) {
      const grade = String(item.defectGrade ?? '').trim().toUpperCase();
      const type = String(item.inspectionType ?? 'AQL').trim().toUpperCase();
      const method = String(item.sampleMethod ?? 'AQL').trim().toUpperCase();
      const level = (item.inspectionLevel || partLevel).trim().toUpperCase();
      const aql = item.aql != null ? Number(item.aql) : null;
      const defectCount = this.toNonNegativeInt(input.itemDefectCounts[item.seq]);

      if (grade === 'CRITICAL') defectCritical += defectCount;
      else if (grade === 'MAJOR') defectMajor += defectCount;
      else if (grade === 'MINOR') defectMinor += defectCount;

      let itemResult: 'PASS' | 'FAIL' = 'PASS';
      let reason = '';
      let rule: AqlSeverityRule | null = null;
      let requiredQty: number | null = null;
      let inspectedQty: number | null = null;

      if (type === 'DESTRUCTIVE' || type === 'FULL' || method === 'FIXED') {
        // 파괴/전수/고정 — AQL 무관, 불량 1건 이상이면 FAIL
        requiredQty = type === 'FULL' ? lotQty : this.toNonNegativeInt(item.sampleQty);
        const providedInspected = input.itemInspectedCounts?.[item.seq];
        inspectedQty = providedInspected != null ? this.toNonNegativeInt(providedInspected) : requiredQty;
        if (defectCount > 0) {
          itemResult = 'FAIL';
          reason = `${item.inspItemCode} ${type === 'FULL' ? '전수' : '파괴'}검사 불량 ${defectCount}건`;
        }
      } else if (grade === 'CRITICAL') {
        requiredQty = inspectedQty = null;
        if (defectCount > 0) {
          itemResult = 'FAIL';
          reason = `${item.inspItemCode} Critical 불량 ${defectCount}건`;
        }
      } else if (aql != null) {
        rule = await this.resolveSeverityRule(level, inspectionMode, aql, lotQty, input.company, input.plant);
        sampleQty = Math.max(sampleQty, rule.actualInspectQty ?? rule.sampleSize);
        requiredQty = inspectedQty = rule.actualInspectQty ?? rule.sampleSize;
        if (grade === 'MAJOR' && !majorRule) majorRule = rule;
        if (grade === 'MINOR' && !minorRule) minorRule = rule;
        if (defectCount > rule.acceptQty) {
          itemResult = 'FAIL';
          reason = `${item.inspItemCode} ${grade} 불량 ${defectCount}건이 Ac ${rule.acceptQty} 초과`;
        }
      } else if (defectCount > 0) {
        // 등급은 있으나 AQL 미설정 → 보수적으로 1건 이상이면 FAIL
        itemResult = 'FAIL';
        reason = `${item.inspItemCode} ${grade} 불량 ${defectCount}건 (AQL 미설정)`;
      }

      if (itemResult === 'FAIL') {
        result = 'FAIL';
        failReasons.push(reason);
      }
      itemResults.push({
        seq: item.seq,
        inspItemCode: item.inspItemCode,
        defectGrade: grade,
        inspectionLevel: level,
        aql,
        defectCount,
        acceptQty: rule?.acceptQty ?? null,
        rejectQty: rule?.rejectQty ?? null,
        inspectionType: type,
        requiredQty,
        inspectedQty,
        result: itemResult,
        reason,
      });
    }

    return {
      itemCode: input.itemCode,
      vendorCode,
      lotQty,
      policyCode: policy?.policyCode ?? null,
      inspectionLevel: partLevel,
      inspectionMode,
      result,
      sampleQty,
      defectCritical,
      defectMajor,
      defectMinor,
      majorRule,
      minorRule,
      judgeReason: result === 'PASS' ? '검사항목별 AQL 기준 합격' : failReasons.join('; '),
      itemResults,
    };
  }

  async updateVendorInspectionModeAfterLot(input: {
    vendorCode?: string | null;
    itemCode?: string | null;
    arrivalNo?: string | null;
    company?: string;
    plant?: string;
  }) {
    const vendorCode = input.vendorCode?.trim();
    if (!vendorCode) return null;

    const partner = await this.partnerRepo.findOne({
      where: {
        partnerCode: vendorCode,
        ...(input.company ? { company: input.company } : {}),
        ...(input.plant ? { plant: input.plant } : {}),
      },
    });
    if (!partner) return null;

    const currentMode = this.normalizeInspectionMode(partner.inspectionMode);
    const recent = await this.iqcLogRepo.find({
      where: {
        vendorCode,
        status: 'DONE',
        ...(input.company ? { company: input.company } : {}),
        ...(input.plant ? { plant: input.plant } : {}),
      },
      order: { inspectDate: 'DESC' },
      take: 10,
    });

    const last5 = recent.slice(0, 5);
    const last10 = recent.slice(0, 10);
    const recent5FailCount = last5.filter((log) => log.result === 'FAIL').length;
    const consecutiveFail2 = recent.length >= 2 && recent.slice(0, 2).every((log) => log.result === 'FAIL');
    const pass5 = last5.length >= 5 && last5.every((log) => log.result === 'PASS');
    const pass10NoMajor = last10.length >= 10
      && last10.every((log) => log.result === 'PASS')
      && last10.every((log) => (log.defectCritical ?? 0) === 0 && (log.defectMajor ?? 0) === 0);

    let nextMode = currentMode;
    let reason: string | null = null;
    if (currentMode === 'NORMAL' && (recent5FailCount >= 2 || consecutiveFail2)) {
      nextMode = 'TIGHTENED';
      reason = recent5FailCount >= 2 ? '최근 5 LOT 중 2 LOT 이상 FAIL' : '연속 FAIL 2회';
    } else if (currentMode === 'NORMAL' && pass10NoMajor) {
      nextMode = 'REDUCED';
      reason = '최근 10 LOT 연속 PASS 및 중대 불량 없음';
    } else if (currentMode === 'TIGHTENED' && pass5) {
      nextMode = 'NORMAL';
      reason = '강화검사 후 최근 5 LOT 연속 PASS';
    } else if (currentMode === 'REDUCED' && recent[0]?.result === 'FAIL') {
      nextMode = 'NORMAL';
      reason = '완화검사 중 FAIL 발생';
    }

    if (nextMode === currentMode) return { vendorCode, inspectionMode: currentMode, changed: false };

    partner.inspectionMode = nextMode;
    await this.partnerRepo.save(partner);
    await this.modeHistoryRepo.save(this.modeHistoryRepo.create({
      company: partner.company,
      plant: partner.plant,
      vendorCode,
      prevMode: currentMode,
      newMode: nextMode,
      reason,
      refArrivalNo: input.arrivalNo ?? null,
      refItemCode: input.itemCode ?? null,
    }));

    return { vendorCode, inspectionMode: nextMode, previousMode: currentMode, changed: true, reason };
  }

  async revertVendorInspectionModeForCanceledLot(input: {
    vendorCode?: string | null;
    itemCode?: string | null;
    arrivalNo?: string | null;
    company?: string;
    plant?: string;
  }) {
    const vendorCode = input.vendorCode?.trim();
    if (!vendorCode) return null;

    const partner = await this.partnerRepo.findOne({
      where: {
        partnerCode: vendorCode,
        ...(input.company ? { company: input.company } : {}),
        ...(input.plant ? { plant: input.plant } : {}),
      },
    });
    if (!partner) return null;

    const currentMode = this.normalizeInspectionMode(partner.inspectionMode);
    const histories = await this.modeHistoryRepo.find({
      where: {
        vendorCode,
        ...(input.company ? { company: input.company } : {}),
        ...(input.plant ? { plant: input.plant } : {}),
      },
      order: { changedAt: 'DESC', seq: 'DESC' },
      take: 1,
    });
    const latest = histories[0];
    if (!latest) return { vendorCode, inspectionMode: currentMode, changed: false };

    const sameCanceledLot =
      (latest.refArrivalNo ?? null) === (input.arrivalNo ?? null) &&
      (latest.refItemCode ?? null) === (input.itemCode ?? null);
    const latestNewMode = this.normalizeInspectionMode(latest.newMode);
    if (!sameCanceledLot || currentMode !== latestNewMode) {
      return { vendorCode, inspectionMode: currentMode, changed: false };
    }

    const revertedMode = this.normalizeInspectionMode(latest.prevMode);
    if (revertedMode === currentMode) {
      return { vendorCode, inspectionMode: currentMode, changed: false };
    }

    const reason = 'IQC 판정 취소로 검사강도 원복';
    partner.inspectionMode = revertedMode;
    await this.partnerRepo.save(partner);
    await this.modeHistoryRepo.save(this.modeHistoryRepo.create({
      company: partner.company,
      plant: partner.plant,
      vendorCode,
      prevMode: currentMode,
      newMode: revertedMode,
      reason,
      refArrivalNo: input.arrivalNo ?? null,
      refItemCode: input.itemCode ?? null,
    }));

    return { vendorCode, inspectionMode: revertedMode, previousMode: currentMode, changed: true, reason };
  }

  private async findStandardOrThrow(aqlCodeParam: string, company?: string, plant?: string) {
    const aqlCode = this.normalizeCode(aqlCodeParam);
    const standard = await this.standardRepo.findOne({
      where: {
        aqlCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!standard) throw new NotFoundException(`AQL 기준을 찾을 수 없습니다: ${aqlCode}`);
    return standard;
  }

  private async findPolicyOrThrow(policyCodeParam: string, company?: string, plant?: string, options?: { allowInactive?: boolean }) {
    const policyCode = this.normalizeCode(policyCodeParam);
    const policy = await this.policyRepo.findOne({
      where: {
        policyCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!policy) throw new NotFoundException(`IQC AQL 정책을 찾을 수 없습니다: ${policyCode}`);
    if (!options?.allowInactive && policy.useYn !== 'Y') throw new BadRequestException('사용 중지된 IQC AQL 정책입니다.');
    return policy;
  }

  private async assertPolicyAqlCodesActive(
    majorAqlCode: string | null | undefined,
    minorAqlCode: string | null | undefined,
    company?: string,
    plant?: string,
  ) {
    const aqlCodes = [majorAqlCode, minorAqlCode].filter(Boolean) as string[];
    if (aqlCodes.length === 0) return;
    // N+1 제거: 코드별 개별 조회 대신 In(...)으로 한 번에 조회 (오류 메시지/검증 순서는 동일하게 유지)
    const normalizedCodes = [...new Set(aqlCodes.map((c) => this.normalizeCode(c)))];
    const standards = await this.standardRepo.find({
      where: {
        aqlCode: In(normalizedCodes),
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    const byCode = new Map(standards.map((s) => [s.aqlCode, s]));
    for (const aqlCode of aqlCodes) {
      const normCode = this.normalizeCode(aqlCode);
      const standard = byCode.get(normCode);
      if (!standard) throw new NotFoundException(`AQL 기준을 찾을 수 없습니다: ${normCode}`);
      if (standard.useYn !== 'Y') throw new BadRequestException(`사용 중지된 AQL 기준입니다: ${standard.aqlCode}`);
    }
  }

  private async resolvePartPolicy(part: ItemMaster, company?: string, plant?: string) {
    const policyCode = part.iqcAqlPolicyCode?.trim();
    if (!policyCode) {
      throw new BadRequestException(`IQC AQL 정책이 설정되지 않은 품목입니다: ${part.itemCode}`);
    }
    return this.findPolicyOrThrow(policyCode, company, plant);
  }

  private async resolveRuleByStandardCode(
    aqlCodeParam: string,
    lotQty: number,
    company?: string,
    plant?: string,
  ): Promise<AqlSeverityRule> {
    const standard = await this.findStandardOrThrow(aqlCodeParam, company, plant);
    if (standard.useYn !== 'Y') throw new BadRequestException('사용 중지된 AQL 기준입니다.');

    return this.resolveIsoRule({
      aqlCode: standard.aqlCode,
      aqlValue: this.resolveAqlValue(standard.aqlValue, standard.aqlCode),
      inspectionLevel: standard.inspectionLevel ?? 'II',
      inspectionMode: 'NORMAL',
      lotQty,
      company: standard.company,
      plant: standard.plant,
    });
  }

  private async resolveSeverityRule(
    inspectionLevel: string,
    inspectionMode: string,
    aqlValue: number,
    lotQty: number,
    company?: string,
    plant?: string,
  ): Promise<AqlSeverityRule> {
    const standard = await this.findFirstStandard(
      this.buildAqlCodeCandidates(inspectionLevel, inspectionMode, aqlValue),
      company,
      plant,
    );
    if (!standard) throw new NotFoundException(`AQL 기준을 찾을 수 없습니다: ${inspectionLevel} / ${aqlValue}`);
    if (standard.useYn !== 'Y') throw new BadRequestException('사용 중지된 AQL 기준입니다.');

    return this.resolveIsoRule({
      aqlCode: standard.aqlCode,
      aqlValue,
      inspectionLevel,
      inspectionMode,
      lotQty,
      company: standard.company,
      plant: standard.plant,
    });
  }

  private async resolveIsoRule(input: {
    aqlCode: string;
    aqlValue: number;
    inspectionLevel: string;
    inspectionMode: string;
    lotQty: number;
    company?: string;
    plant?: string;
  }): Promise<AqlSeverityRule> {
    const lotQty = Math.max(1, Number(input.lotQty) || 1);
    const inspectionLevel = this.normalizeInspectionLevel(input.inspectionLevel);
    const inspectionMode = this.normalizeInspectionMode(input.inspectionMode);
    const rules = await this.codeLetterRuleRepo.find({
      where: {
        inspectionLevel,
        ...(input.company ? { company: input.company } : {}),
        ...(input.plant ? { plant: input.plant } : {}),
      },
      order: { lotQtyFrom: 'ASC' },
    });
    const codeRule = rules.find((rule) => rule.lotQtyFrom <= lotQty && lotQty <= rule.lotQtyTo);
    if (!codeRule) throw new NotFoundException('LOT 수량과 검사수준에 해당하는 AQL Code Letter가 없습니다.');

    const codeLetter = codeRule.codeLetter
      ?? this.deriveCodeLetterForLevel(inspectionLevel, lotQty)
      ?? this.deriveCodeLetter(codeRule.lotQtyFrom);
    if (!codeLetter) throw new NotFoundException('LOT 수량과 검사수준에 해당하는 AQL Code Letter가 없습니다.');

    const acceptance = await this.findAcceptanceRule(
      codeLetter,
      input.aqlValue,
      inspectionMode,
      input.company,
      input.plant,
    );
    if (!acceptance) {
      throw new NotFoundException(`AQL 판정표를 찾을 수 없습니다: ${codeRule.codeLetter} / ${input.aqlValue}`);
    }

    const sample = await this.codeLetterSampleRepo.findOne({
      where: {
        codeLetter: acceptance.sampleCodeLetter,
        ...(input.company ? { company: input.company } : {}),
        ...(input.plant ? { plant: input.plant } : {}),
      },
    });
    if (!sample) throw new NotFoundException(`AQL 샘플수량 표를 찾을 수 없습니다: ${acceptance.sampleCodeLetter}`);

    return {
      aqlCode: input.aqlCode,
      aqlValue: input.aqlValue,
      codeLetter,
      sampleCodeLetter: acceptance.sampleCodeLetter,
      sampleSize: sample.sampleSize,
      standardSampleSize: sample.sampleSize,
      actualInspectQty: Math.min(sample.sampleSize, lotQty),
      acceptQty: acceptance.acceptQty,
      rejectQty: acceptance.rejectQty,
    };
  }

  private async findAcceptanceRule(
    codeLetter: string,
    aqlValue: number,
    inspectionMode: string,
    company?: string,
    plant?: string,
  ) {
    const baseWhere = {
      codeLetter,
      aqlValue,
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    return await this.acceptanceRuleRepo.findOne({ where: { ...baseWhere, inspectionMode } })
      ?? await this.acceptanceRuleRepo.findOne({ where: { ...baseWhere, inspectionMode: 'NORMAL' } });
  }

  private async findFirstStandard(aqlCodes: string[], company?: string, plant?: string) {
    if (aqlCodes.length === 0) return null;
    // N+1 제거: 후보 코드별 개별 조회 대신 In(...)으로 한 번에 조회 후 후보 우선순위대로 첫 매칭 반환
    const standards = await this.standardRepo.find({
      where: {
        aqlCode: In(aqlCodes),
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    const byCode = new Map<string, (typeof standards)[number]>();
    for (const standard of standards) {
      if (!byCode.has(standard.aqlCode)) byCode.set(standard.aqlCode, standard);
    }
    for (const aqlCode of aqlCodes) {
      const standard = byCode.get(aqlCode);
      if (standard) return standard;
    }
    return null;
  }

  private buildAqlCodeCandidates(inspectionLevel: string, inspectionMode: string, aqlValue: number) {
    const values = this.formatAqlValues(aqlValue);
    const level = inspectionLevel.trim().toUpperCase();
    const mode = this.normalizeInspectionMode(inspectionMode);
    const codes: string[] = [];
    for (const value of values) {
      codes.push(`AQL-${level}-${mode}-${value}`);
    }
    for (const value of values) {
      codes.push(`AQL-${level}-${value}`);
    }
    return [...new Set(codes.map((code) => this.normalizeCode(code)))];
  }

  private formatAqlValues(aqlValue: number) {
    const raw = String(aqlValue);
    const fixed1 = Number.isInteger(aqlValue) ? aqlValue.toFixed(1) : raw;
    const trimmed = raw.replace(/\.0+$/, '');
    return [...new Set([raw, fixed1, trimmed])].filter(Boolean);
  }

  private deriveCodeLetter(lotQtyFrom: number) {
    const levelIiLetters: Array<[number, string]> = [
      [2, 'A'],
      [9, 'B'],
      [16, 'C'],
      [26, 'D'],
      [51, 'E'],
      [91, 'F'],
      [151, 'G'],
      [281, 'H'],
      [501, 'J'],
      [1201, 'K'],
      [3201, 'L'],
      [10001, 'M'],
      [35001, 'N'],
      [150001, 'P'],
      [500001, 'Q'],
    ];
    return levelIiLetters.find(([from]) => from === Number(lotQtyFrom))?.[1] ?? null;
  }

  private deriveCodeLetterForLevel(inspectionLevel: string, lotQty: number) {
    const rows: Array<[number, number, Record<string, string>]> = [
      [2, 8, { I: 'A', II: 'A', III: 'B', S1: 'A', S2: 'A', S3: 'A', S4: 'A' }],
      [9, 15, { I: 'A', II: 'B', III: 'C', S1: 'A', S2: 'A', S3: 'A', S4: 'A' }],
      [16, 25, { I: 'B', II: 'C', III: 'D', S1: 'A', S2: 'A', S3: 'B', S4: 'B' }],
      [26, 50, { I: 'C', II: 'D', III: 'E', S1: 'A', S2: 'B', S3: 'B', S4: 'C' }],
      [51, 90, { I: 'C', II: 'E', III: 'F', S1: 'B', S2: 'B', S3: 'C', S4: 'C' }],
      [91, 150, { I: 'D', II: 'F', III: 'G', S1: 'B', S2: 'B', S3: 'C', S4: 'D' }],
      [151, 280, { I: 'E', II: 'G', III: 'H', S1: 'B', S2: 'C', S3: 'D', S4: 'E' }],
      [281, 500, { I: 'F', II: 'H', III: 'J', S1: 'B', S2: 'C', S3: 'D', S4: 'E' }],
      [501, 1200, { I: 'G', II: 'J', III: 'K', S1: 'C', S2: 'C', S3: 'E', S4: 'F' }],
      [1201, 3200, { I: 'H', II: 'K', III: 'L', S1: 'C', S2: 'D', S3: 'E', S4: 'G' }],
      [3201, 10000, { I: 'J', II: 'L', III: 'M', S1: 'C', S2: 'D', S3: 'F', S4: 'G' }],
      [10001, 35000, { I: 'K', II: 'M', III: 'N', S1: 'C', S2: 'D', S3: 'F', S4: 'H' }],
      [35001, 150000, { I: 'L', II: 'N', III: 'P', S1: 'D', S2: 'E', S3: 'G', S4: 'J' }],
      [150001, 500000, { I: 'M', II: 'P', III: 'Q', S1: 'D', S2: 'E', S3: 'G', S4: 'J' }],
      [500001, 999999999, { I: 'N', II: 'Q', III: 'R', S1: 'D', S2: 'E', S3: 'H', S4: 'K' }],
    ];
    return rows.find(([from, to]) => from <= lotQty && lotQty <= to)?.[2]?.[inspectionLevel] ?? null;
  }

  private normalizeInspectionMode(value?: string | null) {
    const mode = String(value || 'NORMAL').trim().toUpperCase();
    return ['TIGHTENED', 'NORMAL', 'REDUCED'].includes(mode) ? mode : 'NORMAL';
  }

  private normalizeInspectionLevel(value?: string | null) {
    return String(value || 'II').trim().toUpperCase().replace(/^S-/, 'S');
  }

  private resolveAqlValue(value: number | null | undefined, aqlCode: string) {
    if (value != null && Number.isFinite(Number(value))) return Number(value);
    const tail = this.normalizeCode(aqlCode).match(/-([0-9]+(?:\.[0-9]+)?)$/);
    if (tail) return Number(tail[1]);
    const match = this.normalizeCode(aqlCode).match(/([0-9]+(?:\.[0-9]+)?)/);
    return match ? Number(match[1]) : 0;
  }

  private toNonNegativeInt(value: unknown) {
    const n = Math.trunc(Number(value ?? 0));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private async resolveIqcDefectCounts(
    directCounts?: IqcDefectCounts,
    defectCodes?: IqcDefectCodeCount[],
    company?: string,
    plant?: string,
  ) {
    const counts = {
      critical: this.toNonNegativeInt(directCounts?.critical),
      major: this.toNonNegativeInt(directCounts?.major),
      minor: this.toNonNegativeInt(directCounts?.minor),
    };
    const effectiveDefects = (defectCodes ?? [])
      .map((defect) => ({
        defectCode: String(defect.defectCode ?? '').trim().toUpperCase(),
        qty: this.toNonNegativeInt(defect.qty),
      }))
      .filter((defect) => defect.defectCode && defect.qty > 0);
    if (effectiveDefects.length === 0) return counts;

    const defectCodeSet = [...new Set(effectiveDefects.map((defect) => defect.defectCode))];
    const codes = await this.defectCodeRepo.find({
      where: {
        defectCode: In(defectCodeSet),
        useYn: 'Y',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    const codeMap = new Map(codes.map((code) => [code.defectCode.toUpperCase(), code]));

    for (const defect of effectiveDefects) {
      const code = codeMap.get(defect.defectCode);
      if (!code) {
        throw new BadRequestException(`등록되지 않았거나 사용 중지된 불량코드입니다: ${defect.defectCode}`);
      }
      const severity = String(code.defectGrade ?? '').trim().toUpperCase();
      if (!['CRITICAL', 'MAJOR', 'MINOR'].includes(severity)) {
        throw new BadRequestException(`불량코드 등급이 누락되었습니다: ${defect.defectCode}`);
      }
      if (severity === 'CRITICAL') counts.critical += defect.qty;
      if (severity === 'MAJOR') counts.major += defect.qty;
      if (severity === 'MINOR') counts.minor += defect.qty;
    }

    return counts;
  }

  private async replaceRules(aqlCode: string, rules: AqlRuleDto[], company: string, plant: string, userId: string) {
    void aqlCode;
    void rules;
    void company;
    void plant;
    void userId;
  }

  private assertValidRules(rules: AqlRuleDto[]) {
    const sorted = [...rules].sort((a, b) => a.lotQtyFrom - b.lotQtyFrom);
    for (let index = 0; index < sorted.length; index += 1) {
      const rule = sorted[index];
      if (rule.lotQtyFrom > rule.lotQtyTo) {
        throw new BadRequestException('LOT 수량 From은 To보다 클 수 없습니다.');
      }
      if (rule.rejectQty <= rule.acceptQty) {
        throw new BadRequestException('Re 수량은 Ac 수량보다 커야 합니다.');
      }
      const previous = sorted[index - 1];
      if (previous && rule.lotQtyFrom <= previous.lotQtyTo) {
        throw new BadRequestException('같은 AQL 코드 안에서 LOT 수량 범위가 겹칠 수 없습니다.');
      }
    }
  }

  private normalizeCode(value: string) {
    return String(value ?? '').trim().toUpperCase();
  }
}

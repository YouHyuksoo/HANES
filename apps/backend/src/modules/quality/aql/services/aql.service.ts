import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AqlStandard } from '../../../../entities/aql-standard.entity';
import { AqlSamplingRule } from '../../../../entities/aql-sampling-rule.entity';
import { ComCode } from '../../../../entities/com-code.entity';
import { IqcLog } from '../../../../entities/iqc-log.entity';
import { PartMaster } from '../../../../entities/part-master.entity';
import { PartnerMaster } from '../../../../entities/partner-master.entity';
import { VendorInspectionModeHistory } from '../../../../entities/vendor-inspection-mode-history.entity';
import { IqcPartSpecItem } from '../../../../entities/iqc-part-spec-item.entity';
import { AqlQueryDto, AqlRuleDto, CreateAqlDto, UpdateAqlDto } from '../dto/aql.dto';

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
  sampleSize: number;
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
  result: 'PASS' | 'FAIL';
  reason: string;
};

export type IqcAqlPolicyResolution = {
  itemCode: string;
  vendorCode: string | null;
  lotQty: number;
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
    @InjectRepository(AqlSamplingRule)
    private readonly ruleRepo: Repository<AqlSamplingRule>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerRepo: Repository<PartnerMaster>,
    @InjectRepository(IqcLog)
    private readonly iqcLogRepo: Repository<IqcLog>,
    @InjectRepository(VendorInspectionModeHistory)
    private readonly modeHistoryRepo: Repository<VendorInspectionModeHistory>,
    @InjectRepository(ComCode)
    private readonly comCodeRepo: Repository<ComCode>,
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
    const rules = await this.ruleRepo.find({
      where: { aqlCode: standard.aqlCode, company: standard.company, plant: standard.plant },
      order: { lotQtyFrom: 'ASC' },
    });
    return { ...standard, rules };
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
    standard.useYn = 'N';
    standard.updatedBy = userId;
    await this.standardRepo.save(standard);
    return { aqlCode, deleted: true };
  }

  async resolveByAqlCode(aqlCodeParam: string, lotQty: number, company?: string, plant?: string) {
    const aqlCode = this.normalizeCode(aqlCodeParam);
    const standard = await this.findStandardOrThrow(aqlCode, company, plant);
    if (standard.useYn !== 'Y') throw new BadRequestException('사용 중지된 AQL 기준입니다.');

    const rules = await this.ruleRepo.find({
      where: { company: standard.company, plant: standard.plant, aqlCode },
      order: { lotQtyFrom: 'ASC' },
    });
    const matched = rules.find((rule) => rule.lotQtyFrom <= lotQty && lotQty <= rule.lotQtyTo);
    if (!matched) throw new NotFoundException('LOT 수량에 해당하는 AQL sampling rule이 없습니다.');

    return {
      aqlCode,
      aqlName: standard.aqlName,
      lotQty,
      lotQtyFrom: matched.lotQtyFrom,
      lotQtyTo: matched.lotQtyTo,
      codeLetter: matched.codeLetter ?? this.deriveCodeLetter(matched.lotQtyFrom),
      sampleSize: matched.sampleSize,
      acceptQty: matched.acceptQty,
      rejectQty: matched.rejectQty,
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

    const inspectionLevel = (part.inspectionLevel || 'II').trim().toUpperCase();
    const inspectionMode = this.normalizeInspectionMode(partner?.inspectionMode);
    const lotQty = Math.max(1, Number(input.lotQty) || 1);
    const defectCounts = await this.resolveIqcDefectCounts(input.defectCounts, input.defectCodes, input.company, input.plant);
    const defectCritical = defectCounts.critical;
    const defectMajor = defectCounts.major;
    const defectMinor = defectCounts.minor;

    const majorRule = part.aqlMajor != null
      ? await this.resolveSeverityRule(inspectionLevel, inspectionMode, Number(part.aqlMajor), lotQty, input.company, input.plant)
      : null;
    const minorRule = part.aqlMinor != null
      ? await this.resolveSeverityRule(inspectionLevel, inspectionMode, Number(part.aqlMinor), lotQty, input.company, input.plant)
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
    const gradedItems = specItems.filter(
      (item) => ['CRITICAL', 'MAJOR', 'MINOR'].includes(String(item.defectGrade ?? '').trim().toUpperCase()),
    );

    // 등급 설정 검사항목이 없으면 기존 품목 단일 모델로 폴백
    if (gradedItems.length === 0) {
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

    const partLevel = (part?.inspectionLevel || 'II').trim().toUpperCase();
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

    for (const item of gradedItems) {
      const grade = String(item.defectGrade ?? '').trim().toUpperCase();
      const level = (item.inspectionLevel || partLevel).trim().toUpperCase();
      const aql = item.aql != null ? Number(item.aql) : null;
      const defectCount = this.toNonNegativeInt(input.itemDefectCounts[item.seq]);

      if (grade === 'CRITICAL') defectCritical += defectCount;
      else if (grade === 'MAJOR') defectMajor += defectCount;
      else if (grade === 'MINOR') defectMinor += defectCount;

      let itemResult: 'PASS' | 'FAIL' = 'PASS';
      let reason = '';
      let rule: AqlSeverityRule | null = null;

      if (grade === 'CRITICAL') {
        if (defectCount > 0) {
          itemResult = 'FAIL';
          reason = `${item.inspItemCode} Critical 불량 ${defectCount}건`;
        }
      } else if (aql != null) {
        rule = await this.resolveSeverityRule(level, inspectionMode, aql, lotQty, input.company, input.plant);
        sampleQty = Math.max(sampleQty, rule.sampleSize);
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
        result: itemResult,
        reason,
      });
    }

    return {
      itemCode: input.itemCode,
      vendorCode,
      lotQty,
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

    const rules = await this.ruleRepo.find({
      where: { company: standard.company, plant: standard.plant, aqlCode: standard.aqlCode },
      order: { lotQtyFrom: 'ASC' },
    });
    const matched = rules.find((rule) => rule.lotQtyFrom <= lotQty && lotQty <= rule.lotQtyTo);
    if (!matched) throw new NotFoundException('LOT 수량에 해당하는 AQL sampling rule이 없습니다.');

    return {
      aqlCode: standard.aqlCode,
      aqlValue,
      codeLetter: matched.codeLetter ?? this.deriveCodeLetter(matched.lotQtyFrom),
      sampleSize: matched.sampleSize,
      acceptQty: matched.acceptQty,
      rejectQty: matched.rejectQty,
    };
  }

  private async findFirstStandard(aqlCodes: string[], company?: string, plant?: string) {
    for (const aqlCode of aqlCodes) {
      const standard = await this.standardRepo.findOne({
        where: {
          aqlCode,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      });
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

  private normalizeInspectionMode(value?: string | null) {
    const mode = String(value || 'NORMAL').trim().toUpperCase();
    return ['TIGHTENED', 'NORMAL', 'REDUCED'].includes(mode) ? mode : 'NORMAL';
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
    const codes = await this.comCodeRepo.find({
      where: {
        groupCode: 'DEFECT_TYPE',
        detailCode: In(defectCodeSet),
        useYn: 'Y',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    const codeMap = new Map(codes.map((code) => [code.detailCode.toUpperCase(), code]));

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
    await this.ruleRepo.delete({ company, plant, aqlCode });
    if (rules.length === 0) return;

    const entities = rules
      .sort((a, b) => a.lotQtyFrom - b.lotQtyFrom)
      .map((rule, index) => this.ruleRepo.create({
        company,
        plant,
        aqlCode,
        lotQtyFrom: rule.lotQtyFrom,
        lotQtyTo: rule.lotQtyTo,
        sampleSize: rule.sampleSize,
        acceptQty: rule.acceptQty,
        rejectQty: rule.rejectQty,
        sortOrder: rule.sortOrder ?? index + 1,
        createdBy: userId,
        updatedBy: userId,
      }));
    await this.ruleRepo.save(entities);
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AqlStandard } from '../../../../entities/aql-standard.entity';
import { AqlSamplingRule } from '../../../../entities/aql-sampling-rule.entity';
import { AqlQueryDto, AqlRuleDto, CreateAqlDto, UpdateAqlDto } from '../dto/aql.dto';

@Injectable()
export class AqlService {
  constructor(
    @InjectRepository(AqlStandard)
    private readonly standardRepo: Repository<AqlStandard>,
    @InjectRepository(AqlSamplingRule)
    private readonly ruleRepo: Repository<AqlSamplingRule>,
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
      sampleSize: matched.sampleSize,
      acceptQty: matched.acceptQty,
      rejectQty: matched.rejectQty,
    };
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

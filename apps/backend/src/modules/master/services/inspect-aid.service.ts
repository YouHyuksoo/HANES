/**
 * @file inspect-aid.service.ts
 * @description 검사보조구 마스터(한도견본·검사홀더) CRUD + 사진 경로 갱신 + 만료·임박 조회
 *
 * 초보자 가이드:
 * 1. findAll: 테넌트 + 유형/상태/품목/공정/사용여부/검색어 필터, 페이징
 * 2. create/update: PK(COMPANY, PLANT_CD, AID_CODE). 날짜는 'YYYY-MM-DD' 문자열을 로컬 Date로 변환해 저장
 * 3. findExpiring(days): VALID_TO가 오늘+days 이내(이미 지난 것 포함)이고 폐기(RETIRED)가 아닌 사용중 보조구
 * 4. 응답의 validFrom/validTo는 'YYYY-MM-DD' 문자열로 정규화(타임존 off-by-one 방지)
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectAid } from '../../../entities/inspect-aid.entity';
import { CreateInspectAidDto, InspectAidQueryDto, UpdateInspectAidDto } from '../dto/inspect-aid.dto';

export type InspectAidExpiryState = 'EXPIRED' | 'EXPIRING' | 'VALID' | 'NONE';

export interface InspectAidView extends Omit<InspectAid, 'validFrom' | 'validTo'> {
  validFrom: string | null;
  validTo: string | null;
  /** 오늘 기준 유효기간 상태 (days 기준 임박 판정) */
  expiryState: InspectAidExpiryState;
  /** 만료까지 남은 일수 (음수면 경과일, validTo 없으면 null) */
  daysToExpiry: number | null;
}

const DEFAULT_EXPIRING_DAYS = 30;

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

@Injectable()
export class InspectAidService {
  constructor(
    @InjectRepository(InspectAid)
    private readonly repo: Repository<InspectAid>,
  ) {}

  toView(aid: InspectAid, expiringDays = DEFAULT_EXPIRING_DAYS): InspectAidView {
    const validTo = toDateOnly(aid.validTo);
    const validToDate = parseLocalDate(validTo);
    let daysToExpiry: number | null = null;
    let expiryState: InspectAidExpiryState = 'NONE';
    if (validToDate) {
      daysToExpiry = Math.round((validToDate.getTime() - startOfToday().getTime()) / 86_400_000);
      expiryState = daysToExpiry < 0 ? 'EXPIRED' : daysToExpiry <= expiringDays ? 'EXPIRING' : 'VALID';
    }
    return { ...aid, validFrom: toDateOnly(aid.validFrom), validTo, expiryState, daysToExpiry };
  }

  async findAll(query: InspectAidQueryDto, company: string, plant: string) {
    const { page = 1, limit = 50, search, aidType, status, itemCode, processCode, useYn } = query;
    const qb = this.repo.createQueryBuilder('a')
      .where('a.company = :company', { company })
      .andWhere('a.plant = :plant', { plant });

    if (aidType) qb.andWhere('a.aidType = :aidType', { aidType });
    if (status) qb.andWhere('a.status = :status', { status });
    if (itemCode) qb.andWhere('a.itemCode = :itemCode', { itemCode });
    if (processCode) qb.andWhere('a.processCode = :processCode', { processCode });
    if (useYn) qb.andWhere('a.useYn = :useYn', { useYn });
    if (search?.trim()) {
      qb.andWhere(
        '(UPPER(a.aidCode) LIKE :search OR UPPER(a.aidName) LIKE :search OR UPPER(a.itemCode) LIKE :search OR UPPER(a.location) LIKE :search)',
        { search: `%${search.trim().toUpperCase()}%` },
      );
    }

    const [rows, total] = await qb
      .orderBy('a.aidType', 'ASC')
      .addOrderBy('a.aidCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data: rows.map((r) => this.toView(r)), total, page, limit };
  }

  /** VALID_TO ≤ 오늘 + days (경과분 포함), 사용중이고 폐기 아님. VALID_TO 오름차순. */
  async findExpiring(days: number, company: string, plant: string) {
    const rows = await this.repo.createQueryBuilder('a')
      .where('a.company = :company', { company })
      .andWhere('a.plant = :plant', { plant })
      .andWhere("a.useYn = 'Y'")
      .andWhere("a.status <> 'RETIRED'")
      .andWhere('a.validTo IS NOT NULL')
      .andWhere('a.validTo <= TRUNC(SYSDATE) + :days', { days })
      .orderBy('a.validTo', 'ASC')
      .addOrderBy('a.aidCode', 'ASC')
      .getMany();
    return rows.map((r) => this.toView(r, days));
  }

  async findByCode(aidCode: string, company: string, plant: string) {
    const aid = await this.repo.findOne({ where: { company, plant, aidCode } });
    if (!aid) throw new NotFoundException(`검사보조구를 찾을 수 없습니다: ${aidCode}`);
    return aid;
  }

  async create(dto: CreateInspectAidDto, company: string, plant: string, userId: string) {
    const aidCode = dto.aidCode.trim();
    const existing = await this.repo.findOne({ where: { company, plant, aidCode } });
    if (existing) throw new ConflictException(`이미 존재하는 검사보조구 코드입니다: ${aidCode}`);

    const entity = this.repo.create({
      company,
      plant,
      aidCode,
      aidType: dto.aidType,
      aidName: dto.aidName.trim(),
      itemCode: dto.itemCode ?? null,
      processCode: dto.processCode ?? null,
      defectCode: dto.defectCode ?? null,
      imageUrl: null,
      location: dto.location ?? null,
      validFrom: parseLocalDate(dto.validFrom),
      validTo: parseLocalDate(dto.validTo),
      approvedBy: dto.approvedBy ?? null,
      approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : null,
      status: dto.status ?? 'ACTIVE',
      remark: dto.remark ?? null,
      useYn: dto.useYn ?? 'Y',
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.repo.save(entity);
    return this.toView(saved);
  }

  async update(aidCode: string, dto: UpdateInspectAidDto, company: string, plant: string, userId: string) {
    const aid = await this.findByCode(aidCode, company, plant);
    const patch: Partial<InspectAid> = {
      ...(dto.aidType !== undefined ? { aidType: dto.aidType } : {}),
      ...(dto.aidName !== undefined ? { aidName: dto.aidName.trim() } : {}),
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode } : {}),
      ...(dto.processCode !== undefined ? { processCode: dto.processCode } : {}),
      ...(dto.defectCode !== undefined ? { defectCode: dto.defectCode } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.validFrom !== undefined ? { validFrom: parseLocalDate(dto.validFrom) } : {}),
      ...(dto.validTo !== undefined ? { validTo: parseLocalDate(dto.validTo) } : {}),
      ...(dto.approvedBy !== undefined ? { approvedBy: dto.approvedBy } : {}),
      ...(dto.approvedAt !== undefined ? { approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : null } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      updatedBy: userId,
    };
    Object.assign(aid, patch);
    const saved = await this.repo.save(aid);
    return this.toView(saved);
  }

  async updateImage(aidCode: string, imageUrl: string | null, company: string, plant: string, userId: string) {
    await this.findByCode(aidCode, company, plant);
    await this.repo.update({ company, plant, aidCode }, { imageUrl, updatedBy: userId });
    return this.toView(await this.findByCode(aidCode, company, plant));
  }

  async delete(aidCode: string, company: string, plant: string) {
    const aid = await this.findByCode(aidCode, company, plant);
    await this.repo.remove(aid);
    return { aidCode, deleted: true, imageUrl: aid.imageUrl };
  }
}

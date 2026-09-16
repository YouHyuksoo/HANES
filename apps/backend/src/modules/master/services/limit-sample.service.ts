/**
 * @file limit-sample.service.ts
 * @description 양불마스터(양품/불량 한도견본) CRUD + 사진 다중 관리 + 만료·임박 조회
 *
 * 초보자 가이드:
 * 1. findAll: 테넌트 + 유형/상태/품목/공정/사용여부/검색어 필터, 페이징. 사진은 페이지 단위로 한 번에 조회한다(N+1 금지).
 * 2. create/update: PK(COMPANY, PLANT_CD, SAMPLE_CODE). 날짜는 'YYYY-MM-DD' 문자열을 로컬 Date로 변환해 저장
 * 3. findExpiring(days): VALID_TO가 오늘+days 이내(이미 지난 것 포함)이고 폐기(RETIRED)가 아닌 사용중 견본
 * 4. 사진은 LIMIT_SAMPLE_IMAGES가 단일출처. 첫 사진은 자동 대표, 대표는 견본당 1장만 허용한다.
 * 5. 응답의 validFrom/validTo는 'YYYY-MM-DD' 문자열로 정규화(타임존 off-by-one 방지)
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LimitSample } from '../../../entities/limit-sample.entity';
import { LimitSampleImage } from '../../../entities/limit-sample-image.entity';
import {
  CreateLimitSampleDto,
  LimitSampleQueryDto,
  UpdateLimitSampleDto,
  UpdateLimitSampleImageDto,
} from '../dto/limit-sample.dto';

export type LimitSampleExpiryState = 'EXPIRED' | 'EXPIRING' | 'VALID' | 'NONE';

export interface LimitSampleImageView {
  seqNo: number;
  imageUrl: string;
  caption: string | null;
  isPrimary: string;
  sortOrder: number;
}

export interface LimitSampleView extends Omit<LimitSample, 'validFrom' | 'validTo'> {
  validFrom: string | null;
  validTo: string | null;
  /** 오늘 기준 유효기간 상태 (days 기준 임박 판정) */
  expiryState: LimitSampleExpiryState;
  /** 만료까지 남은 일수 (음수면 경과일, validTo 없으면 null) */
  daysToExpiry: number | null;
  /** 견본 사진 목록 (sortOrder, seqNo 순) */
  images: LimitSampleImageView[];
  /** 대표 사진 경로 — IS_PRIMARY='Y' 1건, 없으면 첫 사진 */
  primaryImageUrl: string | null;
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

/** 사진 정렬 — 표시순서 우선, 같으면 등록순(SEQ_NO) */
function byDisplayOrder(a: LimitSampleImage, b: LimitSampleImage): number {
  return a.sortOrder - b.sortOrder || a.seqNo - b.seqNo;
}

@Injectable()
export class LimitSampleService {
  constructor(
    @InjectRepository(LimitSample)
    private readonly repo: Repository<LimitSample>,
    @InjectRepository(LimitSampleImage)
    private readonly imageRepo: Repository<LimitSampleImage>,
  ) {}

  toView(
    sample: LimitSample,
    images: LimitSampleImage[] = [],
    expiringDays = DEFAULT_EXPIRING_DAYS,
  ): LimitSampleView {
    const validTo = toDateOnly(sample.validTo);
    const validToDate = parseLocalDate(validTo);
    let daysToExpiry: number | null = null;
    let expiryState: LimitSampleExpiryState = 'NONE';
    if (validToDate) {
      daysToExpiry = Math.round((validToDate.getTime() - startOfToday().getTime()) / 86_400_000);
      expiryState = daysToExpiry < 0 ? 'EXPIRED' : daysToExpiry <= expiringDays ? 'EXPIRING' : 'VALID';
    }

    const sorted = [...images].sort(byDisplayOrder);
    const primary = sorted.find((img) => img.isPrimary === 'Y') ?? sorted[0] ?? null;

    return {
      ...sample,
      validFrom: toDateOnly(sample.validFrom),
      validTo,
      expiryState,
      daysToExpiry,
      images: sorted.map((img) => ({
        seqNo: img.seqNo,
        imageUrl: img.imageUrl,
        caption: img.caption ?? null,
        isPrimary: img.isPrimary,
        sortOrder: img.sortOrder ?? 0,
      })),
      primaryImageUrl: primary?.imageUrl ?? null,
    };
  }

  /** 견본 코드 묶음의 사진을 한 번에 읽어 코드별로 묶는다 (목록 N+1 방지) */
  private async loadImageMap(
    sampleCodes: string[],
    company: string,
    plant: string,
  ): Promise<Map<string, LimitSampleImage[]>> {
    const map = new Map<string, LimitSampleImage[]>();
    if (sampleCodes.length === 0) return map;
    const rows = await this.imageRepo.find({
      where: { company, plant, sampleCode: In(sampleCodes) },
    });
    for (const row of rows) {
      const list = map.get(row.sampleCode);
      if (list) list.push(row);
      else map.set(row.sampleCode, [row]);
    }
    return map;
  }

  private async loadImages(sampleCode: string, company: string, plant: string) {
    return this.imageRepo.find({ where: { company, plant, sampleCode } });
  }

  async findAll(query: LimitSampleQueryDto, company: string, plant: string) {
    const { page = 1, limit = 50, search, sampleType, status, itemCode, processCode, useYn, inspectType } = query;
    const qb = this.repo.createQueryBuilder('s')
      .where('s.company = :company', { company })
      .andWhere('s.plant = :plant', { plant });

    if (sampleType) qb.andWhere('s.sampleType = :sampleType', { sampleType });
    if (status) qb.andWhere('s.status = :status', { status });
    if (itemCode) qb.andWhere('s.itemCode = :itemCode', { itemCode });
    if (processCode) qb.andWhere('s.processCode = :processCode', { processCode });
    if (useYn) qb.andWhere('s.useYn = :useYn', { useYn });
    // 검사유형이 비어 있는 견본(전 검사유형 공통)도 함께 보여준다.
    if (inspectType) {
      qb.andWhere('(s.inspectType = :inspectType OR s.inspectType IS NULL)', { inspectType });
    }
    if (search?.trim()) {
      qb.andWhere(
        '(UPPER(s.sampleCode) LIKE :search OR UPPER(s.sampleName) LIKE :search OR UPPER(s.itemCode) LIKE :search OR UPPER(s.location) LIKE :search)',
        { search: `%${search.trim().toUpperCase()}%` },
      );
    }

    const [rows, total] = await qb
      .orderBy('s.sortOrder', 'ASC')
      .addOrderBy('s.sampleType', 'ASC')
      .addOrderBy('s.sampleCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const imageMap = await this.loadImageMap(rows.map((r) => r.sampleCode), company, plant);
    return {
      data: rows.map((r) => this.toView(r, imageMap.get(r.sampleCode) ?? [])),
      total,
      page,
      limit,
    };
  }

  /** VALID_TO ≤ 오늘 + days (경과분 포함), 사용중이고 폐기 아님. VALID_TO 오름차순. */
  async findExpiring(days: number, company: string, plant: string) {
    const rows = await this.repo.createQueryBuilder('s')
      .where('s.company = :company', { company })
      .andWhere('s.plant = :plant', { plant })
      .andWhere("s.useYn = 'Y'")
      .andWhere("s.status <> 'RETIRED'")
      .andWhere('s.validTo IS NOT NULL')
      .andWhere('s.validTo <= TRUNC(SYSDATE) + :days', { days })
      .orderBy('s.validTo', 'ASC')
      .addOrderBy('s.sampleCode', 'ASC')
      .getMany();

    const imageMap = await this.loadImageMap(rows.map((r) => r.sampleCode), company, plant);
    return rows.map((r) => this.toView(r, imageMap.get(r.sampleCode) ?? [], days));
  }

  async findByCode(sampleCode: string, company: string, plant: string) {
    const sample = await this.repo.findOne({ where: { company, plant, sampleCode } });
    if (!sample) throw new NotFoundException(`견본을 찾을 수 없습니다: ${sampleCode}`);
    return sample;
  }

  async findDetail(sampleCode: string, company: string, plant: string) {
    const sample = await this.findByCode(sampleCode, company, plant);
    return this.toView(sample, await this.loadImages(sampleCode, company, plant));
  }

  async create(dto: CreateLimitSampleDto, company: string, plant: string, userId: string) {
    const sampleCode = dto.sampleCode.trim();
    const existing = await this.repo.findOne({ where: { company, plant, sampleCode } });
    if (existing) throw new ConflictException(`이미 존재하는 견본 코드입니다: ${sampleCode}`);

    const entity = this.repo.create({
      company,
      plant,
      sampleCode,
      sampleType: dto.sampleType,
      sampleName: dto.sampleName.trim(),
      itemCode: dto.itemCode ?? null,
      processCode: dto.processCode ?? null,
      // 대표 불량코드는 불량견본(NG)에만 의미가 있다.
      defectCode: dto.sampleType === 'NG' ? (dto.defectCode ?? null) : null,
      inspectType: dto.inspectType ?? null,
      location: dto.location ?? null,
      validFrom: parseLocalDate(dto.validFrom),
      validTo: parseLocalDate(dto.validTo),
      approvedBy: dto.approvedBy ?? null,
      approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : null,
      status: dto.status ?? 'ACTIVE',
      requiredYn: dto.requiredYn ?? 'Y',
      sortOrder: dto.sortOrder ?? 0,
      remark: dto.remark ?? null,
      useYn: dto.useYn ?? 'Y',
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.repo.save(entity);
    return this.toView(saved, []);
  }

  async update(
    sampleCode: string,
    dto: UpdateLimitSampleDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const sample = await this.findByCode(sampleCode, company, plant);
    const patch: Partial<LimitSample> = {
      ...(dto.sampleType !== undefined ? { sampleType: dto.sampleType } : {}),
      ...(dto.sampleName !== undefined ? { sampleName: dto.sampleName.trim() } : {}),
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode } : {}),
      ...(dto.processCode !== undefined ? { processCode: dto.processCode } : {}),
      ...(dto.defectCode !== undefined ? { defectCode: dto.defectCode } : {}),
      ...(dto.inspectType !== undefined ? { inspectType: dto.inspectType } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.validFrom !== undefined ? { validFrom: parseLocalDate(dto.validFrom) } : {}),
      ...(dto.validTo !== undefined ? { validTo: parseLocalDate(dto.validTo) } : {}),
      ...(dto.approvedBy !== undefined ? { approvedBy: dto.approvedBy } : {}),
      ...(dto.approvedAt !== undefined ? { approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : null } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.requiredYn !== undefined ? { requiredYn: dto.requiredYn } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      updatedBy: userId,
    };
    Object.assign(sample, patch);
    // 양품견본으로 바뀌면 대표 불량코드는 성립하지 않는다.
    if (sample.sampleType === 'OK') sample.defectCode = null;
    const saved = await this.repo.save(sample);
    return this.toView(saved, await this.loadImages(sampleCode, company, plant));
  }

  async delete(sampleCode: string, company: string, plant: string) {
    const sample = await this.findByCode(sampleCode, company, plant);
    const images = await this.loadImages(sampleCode, company, plant);
    await this.imageRepo.delete({ company, plant, sampleCode });
    await this.repo.remove(sample);
    return { sampleCode, deleted: true, imageUrls: images.map((img) => img.imageUrl) };
  }

  /** 사진 추가 — SEQ_NO는 견본 내 MAX+1, 첫 사진은 자동 대표 */
  async addImage(
    sampleCode: string,
    imageUrl: string,
    company: string,
    plant: string,
    userId: string,
  ) {
    const sample = await this.findByCode(sampleCode, company, plant);
    const existing = await this.loadImages(sampleCode, company, plant);
    const nextSeq = existing.reduce((max, img) => Math.max(max, img.seqNo), 0) + 1;

    await this.imageRepo.save(
      this.imageRepo.create({
        company,
        plant,
        sampleCode,
        seqNo: nextSeq,
        imageUrl,
        caption: null,
        isPrimary: existing.length === 0 ? 'Y' : 'N',
        sortOrder: nextSeq,
        createdBy: userId,
      }),
    );

    return this.toView(sample, await this.loadImages(sampleCode, company, plant));
  }

  /** 사진 메타(설명·대표·순서) 수정 — 대표는 견본당 1장만 남긴다 */
  async updateImageMeta(
    sampleCode: string,
    seqNo: number,
    dto: UpdateLimitSampleImageDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const sample = await this.findByCode(sampleCode, company, plant);
    const image = await this.imageRepo.findOne({ where: { company, plant, sampleCode, seqNo } });
    if (!image) throw new NotFoundException(`견본 사진을 찾을 수 없습니다: ${sampleCode} #${seqNo}`);

    if (dto.isPrimary === 'Y') {
      // 유니크 인덱스에 걸리지 않도록 같은 견본의 대표를 먼저 전부 내린다.
      await this.imageRepo.update({ company, plant, sampleCode }, { isPrimary: 'N' });
      image.isPrimary = 'Y';
    } else if (dto.isPrimary === 'N') {
      image.isPrimary = 'N';
    }
    if (dto.caption !== undefined) image.caption = dto.caption;
    if (dto.sortOrder !== undefined) image.sortOrder = dto.sortOrder;
    if (userId) image.createdBy = image.createdBy ?? userId;

    await this.imageRepo.save(image);
    return this.toView(sample, await this.loadImages(sampleCode, company, plant));
  }

  /**
   * 사진 삭제 — 지운 것이 대표였으면 남은 첫 사진을 새 대표로 올린다.
   * 반환한 imageUrl은 컨트롤러가 업로드 파일을 지우는 데 쓴다.
   */
  async removeImage(sampleCode: string, seqNo: number, company: string, plant: string) {
    const sample = await this.findByCode(sampleCode, company, plant);
    const image = await this.imageRepo.findOne({ where: { company, plant, sampleCode, seqNo } });
    if (!image) throw new NotFoundException(`견본 사진을 찾을 수 없습니다: ${sampleCode} #${seqNo}`);

    await this.imageRepo.delete({ company, plant, sampleCode, seqNo });

    const remaining = await this.loadImages(sampleCode, company, plant);
    if (image.isPrimary === 'Y' && remaining.length > 0) {
      const next = [...remaining].sort(byDisplayOrder)[0];
      next.isPrimary = 'Y';
      await this.imageRepo.save(next);
    }

    return {
      imageUrl: image.imageUrl,
      view: this.toView(sample, await this.loadImages(sampleCode, company, plant)),
    };
  }
}

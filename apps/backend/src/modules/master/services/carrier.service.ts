/**
 * @file carrier.service.ts
 * @description 대차 마스터 CRUD. 상태(EMPTY/LOADING/IN_TRANSIT)는 여기서 다루지 않는다 — production/CarrierFlowService가 라벨·LOT 테이블로 도출한다.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarrierMaster } from '../../../entities/carrier-master.entity';
import { CarrierQueryDto, CreateCarrierDto, UpdateCarrierDto } from '../dto/carrier.dto';

/** 대차번호 정규화 — 스캐너 입력과 마스터 저장값이 같아야 하므로 공백 제거 + 대문자 */
export function normalizeCarrierNo(raw: string): string {
  return raw.trim().toUpperCase();
}

@Injectable()
export class CarrierService {
  constructor(@InjectRepository(CarrierMaster) private readonly repo: Repository<CarrierMaster>) {}

  async findAll(query: CarrierQueryDto, company: string, plant: string) {
    const { page = 1, limit = 50, search, carrierType, useYn } = query;
    const qb = this.repo.createQueryBuilder('c')
      .where('c.company = :company', { company })
      .andWhere('c.plant = :plant', { plant });
    if (carrierType) qb.andWhere('c.carrierType = :carrierType', { carrierType });
    if (useYn) qb.andWhere('c.useYn = :useYn', { useYn });
    if (search?.trim()) {
      qb.andWhere('(UPPER(c.carrierNo) LIKE :search OR UPPER(c.carrierName) LIKE :search)', { search: `%${search.trim().toUpperCase()}%` });
    }
    const [rows, total] = await qb.orderBy('c.carrierType', 'ASC').addOrderBy('c.carrierNo', 'ASC')
      .skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data: rows, total, page, limit };
  }

  async findByNo(carrierNo: string, company: string, plant: string): Promise<CarrierMaster | null> {
    return this.repo.findOne({ where: { company, plant, carrierNo: normalizeCarrierNo(carrierNo) } });
  }

  async findOneOrFail(carrierNo: string, company: string, plant: string): Promise<CarrierMaster> {
    const row = await this.findByNo(carrierNo, company, plant);
    if (!row) throw new NotFoundException(`대차를 찾을 수 없습니다: ${carrierNo}`);
    return row;
  }

  private assertCapacity(capacity: number | null | undefined): void {
    if (capacity != null && capacity <= 0) throw new BadRequestException('수용량은 1 이상이거나 비워 두어야 합니다.');
  }

  async create(dto: CreateCarrierDto, company: string, plant: string, userId: string) {
    const carrierNo = normalizeCarrierNo(dto.carrierNo);
    if (!carrierNo) throw new BadRequestException('대차번호는 필수입니다.');
    this.assertCapacity(dto.capacity);
    const existing = await this.repo.findOne({ where: { company, plant, carrierNo } });
    if (existing) throw new ConflictException(`이미 존재하는 대차번호입니다: ${carrierNo}`);
    const entity = this.repo.create({
      company, plant, carrierNo,
      carrierType: dto.carrierType,
      carrierName: dto.carrierName?.trim() || null,
      capacity: dto.capacity ?? null,
      useYn: dto.useYn ?? 'Y',
      remark: dto.remark ?? null,
      createdBy: userId, updatedBy: userId,
    });
    return this.repo.save(entity);
  }

  async update(carrierNo: string, dto: UpdateCarrierDto, company: string, plant: string, userId: string) {
    const row = await this.findOneOrFail(carrierNo, company, plant);
    this.assertCapacity(dto.capacity);
    Object.assign(row, {
      ...(dto.carrierType !== undefined ? { carrierType: dto.carrierType } : {}),
      ...(dto.carrierName !== undefined ? { carrierName: dto.carrierName?.trim() || null } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      updatedBy: userId,
    });
    return this.repo.save(row);
  }

  async delete(carrierNo: string, company: string, plant: string) {
    const row = await this.findOneOrFail(carrierNo, company, plant);
    await this.repo.remove(row);
    return { carrierNo: row.carrierNo, deleted: true };
  }
}

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

/** 라벨 접두어로 시작하는 대차번호는 스캔 화면이 라벨로 먼저 해석해 대차로 인식되지 않는다 — 등록 단계에서 막는다. */
const LABEL_LIKE_CARRIER_NO = [/^(SG|FG)\d/, /^VH1-RM/];

export function assertNotLabelLikeCarrierNo(carrierNo: string): void {
  if (LABEL_LIKE_CARRIER_NO.some((re) => re.test(carrierNo))) {
    throw new BadRequestException('대차번호는 라벨 접두어(SG/FG/VH1-RM)로 시작할 수 없습니다.');
  }
}

/** 대차에 남아 있는 참조 수 — SG/FG 라벨과 원자재 LOT 3테이블 */
const REFERENCE_COUNT_SQL = `
  SELECT COUNT(*) CNT FROM (
    SELECT 1 FROM SG_LABELS WHERE COMPANY = :1 AND PLANT_CD = :2 AND CARRIER_NO = :3
    UNION ALL SELECT 1 FROM FG_LABELS WHERE COMPANY = :4 AND PLANT_CD = :5 AND CARRIER_NO = :6 AND STATUS NOT IN ('PACKED','SHIPPED')
    UNION ALL SELECT 1 FROM MAT_LOTS WHERE COMPANY = :7 AND PLANT_CD = :8 AND CARRIER_NO = :9)`;

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
    assertNotLabelLikeCarrierNo(carrierNo);
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
    // 담긴 라벨/LOT이 있으면 물리 삭제 시 CARRIER_NO가 고아로 남는다(FK 없음) — 먼저 비우게 한다.
    // CarrierFlowService(production)를 master 모듈로 끌어오면 순환 의존이 생기므로 manager 질의 1회로 센다.
    const refRows: Array<{ CNT: number }> = await this.repo.manager.query(REFERENCE_COUNT_SQL, [
      company, plant, row.carrierNo,
      company, plant, row.carrierNo,
      company, plant, row.carrierNo,
    ]);
    if (Number(refRows[0]?.CNT ?? 0) > 0) {
      throw new BadRequestException('담긴 라벨/LOT이 있는 대차는 삭제할 수 없습니다. 먼저 비우세요.');
    }
    await this.repo.remove(row);
    return { carrierNo: row.carrierNo, deleted: true };
  }
}

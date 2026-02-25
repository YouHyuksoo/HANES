/**
 * @file services/vendor-barcode-mapping.service.ts
 * @description 자재 제조사 바코드 매핑 서비스
 *
 * 초보자 가이드:
 * 1. CRUD: 매핑 데이터 생성/조회/수정/삭제
 * 2. resolveBarcode: 제조사 바코드 → MES 품목 자동 매칭
 *    - EXACT: 정확히 일치하는 바코드 검색
 *    - PREFIX: 접두사 매칭 (startsWith)
 *    - REGEX: 정규식 매칭
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorBarcodeMapping } from '../../../entities/vendor-barcode-mapping.entity';
import {
  CreateVendorBarcodeMappingDto,
  UpdateVendorBarcodeMappingDto,
  VendorBarcodeMappingQueryDto,
} from '../dto/vendor-barcode-mapping.dto';

@Injectable()
export class VendorBarcodeMappingService {
  constructor(
    @InjectRepository(VendorBarcodeMapping)
    private readonly repo: Repository<VendorBarcodeMapping>,
  ) {}

  /** 목록 조회 */
  async findAll(query: VendorBarcodeMappingQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 100, search, vendorCode, useYn } = query;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('m')

    if (company) {
      qb.andWhere('m.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('m.plant = :plant', { plant });
    }

    if (search) {
      qb.andWhere(
        '(UPPER(m.vendorBarcode) LIKE UPPER(:search) OR UPPER(m.itemCode) LIKE UPPER(:search) OR UPPER(m.itemName) LIKE UPPER(:search))',
        { search: `%${search}%` },
      );
    }

    if (vendorCode) {
      qb.andWhere('m.vendorCode = :vendorCode', { vendorCode });
    }

    if (useYn) {
      qb.andWhere('m.useYn = :useYn', { useYn });
    }

    const [data, total] = await qb
      .orderBy('m.vendorBarcode', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  /** 상세 조회 */
  async findById(id: string) {
    const mapping = await this.repo.findOne({
      where: { id },
    });
    if (!mapping) {
      throw new NotFoundException(`바코드 매핑을 찾을 수 없습니다: ${id}`);
    }
    return mapping;
  }

  /** 생성 */
  async create(dto: CreateVendorBarcodeMappingDto) {
    const existing = await this.repo.findOne({
      where: { vendorBarcode: dto.vendorBarcode },
    });
    if (existing) {
      throw new ConflictException(
        `이미 등록된 제조사 바코드입니다: ${dto.vendorBarcode}`,
      );
    }

    const mapping = this.repo.create({
      ...dto,
      matchType: dto.matchType ?? 'EXACT',
      useYn: dto.useYn ?? 'Y',
    });

    return this.repo.save(mapping);
  }

  /** 수정 */
  async update(id: string, dto: UpdateVendorBarcodeMappingDto) {
    await this.findById(id);
    await this.repo.update(id, dto);
    return this.findById(id);
  }

  /** 삭제 (Soft Delete) */
  async delete(id: string) {
    await this.findById(id);
    await this.repo.delete(id);
    return { id };
  }

  /**
   * 바코드 스캔 → 품목 매칭
   * 1. EXACT: 정확히 일치
   * 2. PREFIX: 접두사 매칭
   * 3. REGEX: 정규식 매칭 (메모리 내 처리)
   */
  async resolveBarcode(barcode: string) {
    // 1단계: EXACT 매칭
    const exact = await this.repo.findOne({
      where: {
        vendorBarcode: barcode,
        matchType: 'EXACT',
        useYn: 'Y',
      },
    });
    if (exact) return { matched: true, mapping: exact, matchMethod: 'EXACT' };

    // 2단계: PREFIX 매칭 (DB에서 PREFIX 타입만 로드 후 비교)
    const prefixMappings = await this.repo.find({
      where: { matchType: 'PREFIX', useYn: 'Y' },
    });
    for (const m of prefixMappings) {
      if (barcode.startsWith(m.vendorBarcode)) {
        return { matched: true, mapping: m, matchMethod: 'PREFIX' };
      }
    }

    // 3단계: REGEX 매칭
    const regexMappings = await this.repo.find({
      where: { matchType: 'REGEX', useYn: 'Y' },
    });
    for (const m of regexMappings) {
      try {
        const re = new RegExp(m.vendorBarcode);
        if (re.test(barcode)) {
          return { matched: true, mapping: m, matchMethod: 'REGEX' };
        }
      } catch {
        // 잘못된 정규식 무시
      }
    }

    return { matched: false, mapping: null, matchMethod: null };
  }
}

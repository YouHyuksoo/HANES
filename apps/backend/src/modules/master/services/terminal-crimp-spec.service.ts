/**
 * @file terminal-crimp-spec.service.ts
 * @description 단자별 압착 규격 마스터 CRUD + resolve 서비스
 *
 * 초보자 가이드:
 * 1. findAll: 테넌트 + 필터(단자품목/종류/전선사이즈/사용여부/검색어) 페이징 목록
 * 2. create: SEQ_TERMINAL_CRIMP_SPEC.NEXTVAL로 SPEC_ID 채번, (단자품목, 전선사이즈) 중복이면 409
 * 3. resolve: 단자품목코드 + 전선사이즈로 사용중(USE_YN='Y') 규격 1건 조회 — 없으면 null (추측 fallback 없음)
 */
import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TerminalCrimpSpec } from '../../../entities/terminal-crimp-spec.entity';
import {
  CreateTerminalCrimpSpecDto,
  TerminalCrimpSpecQueryDto,
  UpdateTerminalCrimpSpecDto,
} from '../dto/terminal-crimp-spec.dto';

@Injectable()
export class TerminalCrimpSpecService {
  constructor(
    @InjectRepository(TerminalCrimpSpec)
    private readonly repo: Repository<TerminalCrimpSpec>,
  ) {}

  async findAll(query: TerminalCrimpSpecQueryDto, company: string, plant: string) {
    const { page = 1, limit = 50, search, terminalItemCode, terminalType, wireSize, useYn } = query;
    const qb = this.repo.createQueryBuilder('s')
      .where('s.company = :company', { company })
      .andWhere('s.plant = :plant', { plant });

    if (terminalItemCode) qb.andWhere('s.terminalItemCode = :terminalItemCode', { terminalItemCode });
    if (terminalType) qb.andWhere('s.terminalType = :terminalType', { terminalType });
    if (wireSize) qb.andWhere('s.wireSize = :wireSize', { wireSize });
    if (useYn) qb.andWhere('s.useYn = :useYn', { useYn });
    if (search?.trim()) {
      qb.andWhere(
        '(UPPER(s.terminalItemCode) LIKE :search OR UPPER(s.wireSize) LIKE :search OR UPPER(s.wireItemCode) LIKE :search OR UPPER(s.applicatorCode) LIKE :search)',
        { search: `%${search.trim().toUpperCase()}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('s.terminalItemCode', 'ASC')
      .addOrderBy('s.wireSize', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(specId: number, company: string, plant: string) {
    const spec = await this.repo.findOne({ where: { specId, company, plant } });
    if (!spec) throw new NotFoundException(`압착 규격을 찾을 수 없습니다: ${specId}`);
    return spec;
  }

  /** 단자품목 + 전선사이즈로 사용중 규격 1건. 없으면 null — 호출측이 "규격 미등록"을 명시적으로 처리한다. */
  async resolve(terminalItemCode: string, wireSize: string, company: string, plant: string) {
    return this.repo.findOne({
      where: { company, plant, terminalItemCode: terminalItemCode.trim(), wireSize: wireSize.trim(), useYn: 'Y' },
    });
  }

  async create(dto: CreateTerminalCrimpSpecDto, company: string, plant: string, userId: string) {
    const terminalItemCode = dto.terminalItemCode.trim();
    const wireSize = dto.wireSize.trim();
    const duplicate = await this.repo.findOne({ where: { company, plant, terminalItemCode, wireSize } });
    if (duplicate) {
      throw new ConflictException(`이미 등록된 단자·전선 조합입니다: ${terminalItemCode} / ${wireSize}`);
    }

    const specId = await this.nextSpecId();
    const entity = this.repo.create({
      specId,
      company,
      plant,
      terminalItemCode,
      terminalType: dto.terminalType ?? null,
      wireSize,
      wireItemCode: dto.wireItemCode ?? null,
      crimpHeightLsl: dto.crimpHeightLsl ?? null,
      crimpHeightUsl: dto.crimpHeightUsl ?? null,
      crimpWidthLsl: dto.crimpWidthLsl ?? null,
      crimpWidthUsl: dto.crimpWidthUsl ?? null,
      insCrimpHeightLsl: dto.insCrimpHeightLsl ?? null,
      insCrimpHeightUsl: dto.insCrimpHeightUsl ?? null,
      pullForceMin: dto.pullForceMin ?? null,
      stripLengthMin: dto.stripLengthMin ?? null,
      stripLengthMax: dto.stripLengthMax ?? null,
      applicatorCode: dto.applicatorCode ?? null,
      remark: dto.remark ?? null,
      useYn: dto.useYn ?? 'Y',
      createdBy: userId,
      updatedBy: userId,
    });
    return this.repo.save(entity);
  }

  async update(specId: number, dto: UpdateTerminalCrimpSpecDto, company: string, plant: string, userId: string) {
    const spec = await this.findById(specId, company, plant);
    const nextTerminal = dto.terminalItemCode?.trim() ?? spec.terminalItemCode;
    const nextWire = dto.wireSize?.trim() ?? spec.wireSize;
    if (nextTerminal !== spec.terminalItemCode || nextWire !== spec.wireSize) {
      const duplicate = await this.repo.findOne({
        where: { company, plant, terminalItemCode: nextTerminal, wireSize: nextWire },
      });
      if (duplicate && duplicate.specId !== specId) {
        throw new ConflictException(`이미 등록된 단자·전선 조합입니다: ${nextTerminal} / ${nextWire}`);
      }
    }

    const patch: Partial<TerminalCrimpSpec> = {
      terminalItemCode: nextTerminal,
      wireSize: nextWire,
      ...(dto.terminalType !== undefined ? { terminalType: dto.terminalType } : {}),
      ...(dto.wireItemCode !== undefined ? { wireItemCode: dto.wireItemCode } : {}),
      ...(dto.crimpHeightLsl !== undefined ? { crimpHeightLsl: dto.crimpHeightLsl } : {}),
      ...(dto.crimpHeightUsl !== undefined ? { crimpHeightUsl: dto.crimpHeightUsl } : {}),
      ...(dto.crimpWidthLsl !== undefined ? { crimpWidthLsl: dto.crimpWidthLsl } : {}),
      ...(dto.crimpWidthUsl !== undefined ? { crimpWidthUsl: dto.crimpWidthUsl } : {}),
      ...(dto.insCrimpHeightLsl !== undefined ? { insCrimpHeightLsl: dto.insCrimpHeightLsl } : {}),
      ...(dto.insCrimpHeightUsl !== undefined ? { insCrimpHeightUsl: dto.insCrimpHeightUsl } : {}),
      ...(dto.pullForceMin !== undefined ? { pullForceMin: dto.pullForceMin } : {}),
      ...(dto.stripLengthMin !== undefined ? { stripLengthMin: dto.stripLengthMin } : {}),
      ...(dto.stripLengthMax !== undefined ? { stripLengthMax: dto.stripLengthMax } : {}),
      ...(dto.applicatorCode !== undefined ? { applicatorCode: dto.applicatorCode } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      updatedBy: userId,
    };
    Object.assign(spec, patch);
    return this.repo.save(spec);
  }

  async delete(specId: number, company: string, plant: string) {
    const spec = await this.findById(specId, company, plant);
    await this.repo.remove(spec);
    return { specId, deleted: true };
  }

  /** SPEC_ID 채번 — Oracle SEQUENCE 단일 출처 (MAX+1 금지) */
  private async nextSpecId(): Promise<number> {
    const rows: Array<{ nextSeq: unknown }> = await this.repo.manager.query(
      `SELECT SEQ_TERMINAL_CRIMP_SPEC.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    const next = Number(rows[0]?.nextSeq);
    if (!Number.isFinite(next) || next <= 0) {
      throw new InternalServerErrorException(`압착 규격 ID 시퀀스 값이 비정상입니다: ${String(rows[0]?.nextSeq)}`);
    }
    return next;
  }
}

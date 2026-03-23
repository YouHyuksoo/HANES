/**
 * @file src/modules/master/services/process-capa.service.ts
 * @description 공정x제품별 CAPA 마스터 CRUD 비즈니스 로직
 *
 * 초보자 가이드:
 * 1. 공정+품목 조합별 생산능력(CAPA) 정보를 관리한다.
 * 2. 복합 PK: COMPANY + PLANT_CD + PROCESS_CODE + ITEM_CODE
 * 3. stdUph 미입력 시 3600 / stdTactTime 으로 자동 계산
 * 4. dailyCapa는 UPH x 가동시간 x 인원/설비 수 x 밸런싱효율로 자동 계산
 * 5. ProcessMaster, PartMaster 존재 여부를 검증한 후 저장한다.
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessCapa } from '../../../entities/process-capa.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  CreateProcessCapaDto,
  UpdateProcessCapaDto,
  ProcessCapaQueryDto,
} from '../dto/process-capa.dto';

@Injectable()
export class ProcessCapaService {
  constructor(
    @InjectRepository(ProcessCapa)
    private readonly repo: Repository<ProcessCapa>,
    @InjectRepository(ProcessMaster)
    private readonly processRepo: Repository<ProcessMaster>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
  ) {}

  /** 공정 CAPA 목록 조회 (공정/품목 JOIN) */
  async findAll(query: ProcessCapaQueryDto, company: string, plant: string) {
    const { processCode, itemCode, search, limit = 5000 } = query;

    const qb = this.repo.createQueryBuilder('capa')
      .leftJoinAndSelect('capa.process', 'proc')
      .leftJoinAndSelect('capa.part', 'part');

    if (company) qb.andWhere('capa.company = :company', { company });
    if (plant) qb.andWhere('capa.plant = :plant', { plant });

    if (processCode) {
      qb.andWhere('capa.processCode = :processCode', { processCode });
    }
    if (itemCode) {
      qb.andWhere('capa.itemCode = :itemCode', { itemCode });
    }
    if (search) {
      qb.andWhere(
        '(capa.processCode LIKE :s OR proc.processName LIKE :s'
        + ' OR capa.itemCode LIKE :s OR part.itemName LIKE :s)',
        { s: `%${search}%` },
      );
    }

    const data = await qb
      .orderBy('capa.processCode', 'ASC')
      .addOrderBy('capa.itemCode', 'ASC')
      .take(limit)
      .getMany();

    return data;
  }

  /** 공정 CAPA 생성 (중복 체크 + FK 검증 + 자동계산) */
  async create(dto: CreateProcessCapaDto, company: string, plant: string) {
    // 중복 체크
    const existing = await this.repo.findOne({
      where: {
        company,
        plant,
        processCode: dto.processCode,
        itemCode: dto.itemCode,
      },
    });
    if (existing) {
      throw new ConflictException(
        `이미 존재하는 공정 CAPA: ${dto.processCode} + ${dto.itemCode}`,
      );
    }

    // FK 검증 - ProcessMaster
    const proc = await this.processRepo.findOne({
      where: { processCode: dto.processCode },
    });
    if (!proc) {
      throw new BadRequestException(
        `공정 마스터를 찾을 수 없습니다: ${dto.processCode}`,
      );
    }

    // FK 검증 - PartMaster
    const part = await this.partRepo.findOne({
      where: { itemCode: dto.itemCode },
    });
    if (!part) {
      throw new BadRequestException(
        `품목 마스터를 찾을 수 없습니다: ${dto.itemCode}`,
      );
    }

    // stdUph 자동계산 (미입력 시)
    const stdUph = dto.stdUph ?? Math.round((3600 / dto.stdTactTime) * 100) / 100;

    const entity = this.repo.create({
      company,
      plant,
      processCode: dto.processCode,
      itemCode: dto.itemCode,
      stdTactTime: dto.stdTactTime,
      stdUph,
      workerCnt: dto.workerCnt ?? 0,
      boardCnt: dto.boardCnt ?? 0,
      equipCnt: dto.equipCnt ?? 0,
      setupTime: dto.setupTime ?? 0,
      balanceEff: dto.balanceEff ?? 85,
      useYn: dto.useYn ?? 'Y',
      remark: dto.remark ?? null,
    });

    // dailyCapa 자동계산
    entity.dailyCapa = this.calculateDailyCapa(entity);

    return this.repo.save(entity);
  }

  /** 공정 CAPA 수정 (자동계산 재수행) */
  async update(
    processCode: string,
    itemCode: string,
    dto: UpdateProcessCapaDto,
    company: string,
    plant: string,
  ) {
    const existing = await this.repo.findOne({
      where: { company, plant, processCode, itemCode },
    });
    if (!existing) {
      throw new NotFoundException(
        `공정 CAPA를 찾을 수 없습니다: ${processCode} + ${itemCode}`,
      );
    }

    // 필드 업데이트
    if (dto.stdTactTime !== undefined) existing.stdTactTime = dto.stdTactTime;
    if (dto.stdUph !== undefined) existing.stdUph = dto.stdUph;
    if (dto.workerCnt !== undefined) existing.workerCnt = dto.workerCnt;
    if (dto.boardCnt !== undefined) existing.boardCnt = dto.boardCnt;
    if (dto.equipCnt !== undefined) existing.equipCnt = dto.equipCnt;
    if (dto.setupTime !== undefined) existing.setupTime = dto.setupTime;
    if (dto.balanceEff !== undefined) existing.balanceEff = dto.balanceEff;
    if (dto.useYn !== undefined) existing.useYn = dto.useYn;
    if (dto.remark !== undefined) existing.remark = dto.remark ?? null;

    // stdUph 자동계산 (stdTactTime이 변경됐고 stdUph가 명시되지 않은 경우)
    if (dto.stdTactTime !== undefined && dto.stdUph === undefined) {
      existing.stdUph = Math.round((3600 / existing.stdTactTime) * 100) / 100;
    }

    // dailyCapa 재계산
    existing.dailyCapa = this.calculateDailyCapa(existing);

    await this.repo.save(existing);
    return existing;
  }

  /** 공정 CAPA 삭제 */
  async delete(processCode: string, itemCode: string, company: string, plant: string) {
    const existing = await this.repo.findOne({
      where: { company, plant, processCode, itemCode },
    });
    if (!existing) {
      throw new NotFoundException(
        `공정 CAPA를 찾을 수 없습니다: ${processCode} + ${itemCode}`,
      );
    }

    await this.repo.delete({ company, plant, processCode, itemCode });
    return { processCode, itemCode, deleted: true };
  }

  /**
   * 일 생산능력(dailyCapa) 자동 계산
   * 산식: UPH x 가동시간(8h) x 인원/설비 수 x 밸런싱효율
   */
  private calculateDailyCapa(entity: ProcessCapa): number {
    const hours = 8;
    const uph = entity.stdUph || 0;
    const eff = (entity.balanceEff || 85) / 100;
    const multiplier = entity.equipCnt > 0
      ? entity.equipCnt
      : entity.workerCnt > 0
        ? entity.workerCnt
        : 1;
    return Math.floor(uph * hours * multiplier * eff);
  }
}

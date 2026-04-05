/**
 * @file src/modules/master/services/worker.service.ts
 * @description 작업자마스터 비즈니스 로직 서비스 - TypeORM Repository 패턴
 *
 * 초보자 가이드:
 * 1. **processIds**: JSON 타입으로 DB에 저장 (담당 공정 목록)
 * 2. **중복 체크**: workerCode 기준 유니크 제약
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { CreateWorkerDto, UpdateWorkerDto, WorkerQueryDto } from '../dto/worker.dto';

@Injectable()
export class WorkerService {
  constructor(
    @InjectRepository(WorkerMaster)
    private readonly workerRepository: Repository<WorkerMaster>,
  ) {}

  async findAll(query: WorkerQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, dept, useYn } = query;
    const skip = (page - 1) * limit;

    console.log(`[WorkerService.findAll] query=`, JSON.stringify(query), ', company=', company);

    const queryBuilder = this.workerRepository.createQueryBuilder('worker')

    if (company) {
      queryBuilder.andWhere('worker.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('worker.plant = :plant', { plant });
    }

    if (dept) {
      queryBuilder.andWhere('worker.dept LIKE :dept', { dept: `%${dept}%` });
    }

    if (useYn) {
      queryBuilder.andWhere('worker.useYn = :useYn', { useYn });
    }

    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(worker.workerCode LIKE :search OR worker.workerName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('worker.createdAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    console.log(`[WorkerService.findAll] total=${total}, data.length=${data.length}`);

    // Parse processIds from CLOB string to array
    const parsedData = data.map(worker => ({
      ...worker,
      processIds: worker.processIds ? JSON.parse(worker.processIds) : [],
    }));

    return { data: parsedData, total, page, limit };
  }

  async findById(workerCode: string) {
    const item = await this.workerRepository.findOne({
      where: { workerCode },
    });
    if (!item) throw new NotFoundException(`작업자를 찾을 수 없습니다: ${workerCode}`);

    return {
      ...item,
      processIds: item.processIds ? JSON.parse(item.processIds) : [],
    };
  }

  /**
   * QR 코드로 작업자 조회 (PDA 연동용)
   *
   * 1차: QR_CODE 컬럼으로 조회
   * 2차: QR에 workerCode가 담긴 경우 대비해 WORKER_CODE로 재시도
   * 둘 다 없으면 NotFoundException 발생
   */
  async findByQrCode(qrCode: string) {
    // 1차 시도: qrCode 컬럼으로 조회
    let item = await this.workerRepository.findOne({
      where: { qrCode },
    });

    // 2차 시도: workerCode로 조회 (QR에 사번이 인쇄된 경우)
    if (!item) {
      item = await this.workerRepository.findOne({
        where: { workerCode: qrCode },
      });
    }

    if (!item) throw new NotFoundException('해당 QR 코드의 작업자를 찾을 수 없습니다');

    return {
      workerCode: item.workerCode,
      workerName: item.workerName,
      dept: item.dept,
    };
  }

  async create(dto: CreateWorkerDto) {
    const existing = await this.workerRepository.findOne({
      where: { workerCode: dto.workerCode },
    });
    if (existing) throw new ConflictException(`이미 존재하는 작업자 코드입니다: ${dto.workerCode}`);

    const worker = this.workerRepository.create({
      workerCode: dto.workerCode,
      workerName: dto.workerName,
      engName: dto.engName,
      dept: dto.dept,
      position: dto.position,
      phone: dto.phone,
      email: dto.email,
      hireDate: dto.hireDate,
      quitDate: dto.quitDate,
      qrCode: dto.qrCode,
      photoUrl: dto.photoUrl,
      processIds: dto.processIds ? JSON.stringify(dto.processIds) : null,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
    });

    const saved = await this.workerRepository.save(worker);
    return {
      ...saved,
      processIds: dto.processIds ?? [],
    };
  }

  async update(workerCode: string, dto: UpdateWorkerDto) {
    await this.findById(workerCode);

    const updateData: any = { ...dto };
    if (dto.processIds !== undefined) {
      updateData.processIds = dto.processIds ? JSON.stringify(dto.processIds) : null;
    }

    await this.workerRepository.update({ workerCode }, updateData);
    return this.findById(workerCode);
  }

  async delete(workerCode: string) {
    await this.findById(workerCode);
    await this.workerRepository.delete({ workerCode });
    return { workerCode };
  }
}

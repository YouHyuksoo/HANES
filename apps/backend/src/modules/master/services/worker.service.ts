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
      queryBuilder.andWhere('UPPER(worker.dept) LIKE UPPER(:dept)', { dept: `%${dept}%` });
    }

    if (useYn) {
      queryBuilder.andWhere('worker.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(worker.workerCode) LIKE UPPER(:search) OR UPPER(worker.workerName) LIKE UPPER(:search))',
        { search: `%${search}%` }
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

  async findById(id: string) {
    const item = await this.workerRepository.findOne({
      where: { id },
    });
    if (!item) throw new NotFoundException(`작업자를 찾을 수 없습니다: ${id}`);
    
    return {
      ...item,
      processIds: item.processIds ? JSON.parse(item.processIds) : [],
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

  async update(id: string, dto: UpdateWorkerDto) {
    await this.findById(id);
    
    const updateData: any = { ...dto };
    if (dto.processIds !== undefined) {
      updateData.processIds = dto.processIds ? JSON.stringify(dto.processIds) : null;
    }

    await this.workerRepository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.workerRepository.delete(id);
    return { id };
  }
}

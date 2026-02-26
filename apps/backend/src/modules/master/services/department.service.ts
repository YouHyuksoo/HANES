/**
 * @file src/modules/master/services/department.service.ts
 * @description 부서마스터 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentMaster } from '../../../entities/department-master.entity';
import { CreateDepartmentDto, UpdateDepartmentDto, DepartmentQueryDto } from '../dto/department.dto';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(DepartmentMaster)
    private readonly departmentRepository: Repository<DepartmentMaster>,
  ) {}

  async findAll(query: DepartmentQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.departmentRepository.createQueryBuilder('dept')

    if (company) {
      queryBuilder.andWhere('dept.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('dept.plant = :plant', { plant });
    }

    if (useYn) {
      queryBuilder.andWhere('dept.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(dept.deptCode) LIKE UPPER(:search) OR UPPER(dept.deptName) LIKE UPPER(:search) OR UPPER(dept.managerName) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('dept.sortOrder', 'ASC')
        .addOrderBy('dept.deptCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(deptCode: string) {
    const dept = await this.departmentRepository.findOne({
      where: { deptCode },
    });
    if (!dept) throw new NotFoundException(`부서를 찾을 수 없습니다: ${deptCode}`);
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.departmentRepository.findOne({
      where: { deptCode: dto.deptCode },
    });
    if (existing) throw new ConflictException(`이미 존재하는 부서코드입니다: ${dto.deptCode}`);

    const dept = this.departmentRepository.create({
      deptCode: dto.deptCode,
      deptName: dto.deptName,
      parentDeptCode: dto.parentDeptCode,
      sortOrder: dto.sortOrder ?? 0,
      managerName: dto.managerName,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
    });

    return this.departmentRepository.save(dept);
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findById(id);
    await this.departmentRepository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.departmentRepository.delete(id);
    return { id };
  }
}

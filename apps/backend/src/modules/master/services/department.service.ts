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

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

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
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(dept.deptCode LIKE :search OR dept.deptName LIKE :searchRaw OR dept.managerName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` }
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

  async findById(deptCode: string, company?: string, plant?: string) {
    const dept = await this.departmentRepository.findOne({
      where: { deptCode, ...this.tenantWhere(company, plant) },
    });
    if (!dept) throw new NotFoundException(`부서를 찾을 수 없습니다: ${deptCode}`);
    return dept;
  }

  async create(dto: CreateDepartmentDto, company?: string, plant?: string) {
    const existing = await this.departmentRepository.findOne({
      where: { deptCode: dto.deptCode, ...this.tenantWhere(company, plant) },
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
      company: company || null,
      plant: plant || null,
    });

    return this.departmentRepository.save(dept);
  }

  async update(id: string, dto: UpdateDepartmentDto, company?: string, plant?: string) {
    await this.findById(id, company, plant);
    const updateData: Partial<DepartmentMaster> = {
      ...(dto.deptName !== undefined ? { deptName: dto.deptName } : {}),
      ...(dto.parentDeptCode !== undefined ? { parentDeptCode: dto.parentDeptCode } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.managerName !== undefined ? { managerName: dto.managerName } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
    };
    await this.departmentRepository.update({ deptCode: id, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(id, company, plant);
  }

  async delete(id: string, company?: string, plant?: string) {
    await this.findById(id, company, plant);
    await this.departmentRepository.delete({ deptCode: id, ...this.tenantWhere(company, plant) });
    return { id };
  }
}

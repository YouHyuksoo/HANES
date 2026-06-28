import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { BomMaster } from '../../../entities/bom-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { EquipMaterialService } from './equip-material.service';
import { KioskMaterialService } from './kiosk-material.service';

describe('KioskMaterialService', () => {
  let target: KioskMaterialService;
  let jobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let bomRepo: DeepMocked<Repository<BomMaster>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let equipMaterialService: DeepMocked<EquipMaterialService>;
  const bomEffectiveDate = new Date(2026, 3, 15);

  beforeEach(async () => {
    jobOrderRepo = createMock<Repository<JobOrder>>();
    bomRepo = createMock<Repository<BomMaster>>();
    matLotRepo = createMock<Repository<MatLot>>();
    equipMaterialService = createMock<EquipMaterialService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KioskMaterialService,
        { provide: getRepositoryToken(JobOrder), useValue: jobOrderRepo },
        { provide: getRepositoryToken(BomMaster), useValue: bomRepo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: EquipMaterialService, useValue: equipMaterialService },
      ],
    }).compile();

    target = module.get(KioskMaterialService);
  });

  it('should reject BOM validation when job order has no planDate', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-001',
      itemCode: 'FG-001',
      equipCode: 'EQ-1',
      company: 'C1',
      plant: 'P1',
    } as JobOrder);

    await expect(target.scanMount('JO-001', 'MAT-001', 'C1', 'P1')).rejects.toThrow(BadRequestException);
    await expect(target.scanMount('JO-001', 'MAT-001', 'C1', 'P1')).rejects.toThrow(
      '작업지시 계획일이 없어 BOM 기준일을 결정할 수 없습니다',
    );
    expect(matLotRepo.findOne).not.toHaveBeenCalled();
    expect(bomRepo.count).not.toHaveBeenCalled();
  });

  it('should validate scanned material against BOM effective on job order planDate', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-001',
      itemCode: 'FG-001',
      equipCode: 'EQ-1',
      company: 'C1',
      plant: 'P1',
      planDate: bomEffectiveDate,
    } as JobOrder);
    matLotRepo.findOne.mockResolvedValue({
      matUid: 'MAT-001',
      itemCode: 'RM-001',
      company: 'C1',
      plant: 'P1',
    } as MatLot);
    bomRepo.count.mockResolvedValue(1);
    equipMaterialService.mount.mockResolvedValue({ matUid: 'MAT-001' } as any);

    await target.scanMount('JO-001', 'MAT-001', 'C1', 'P1');

    expect(bomRepo.count).toHaveBeenCalledWith({
      where: {
        parentItemCode: 'FG-001',
        childItemCode: 'RM-001',
        useYn: 'Y',
        validFrom: LessThanOrEqual(bomEffectiveDate),
        validTo: MoreThanOrEqual(bomEffectiveDate),
        company: 'C1',
        plant: 'P1',
      },
    });
  });

  it('should reject when scanned material is not in effective BOM', async () => {
    jobOrderRepo.findOne.mockResolvedValue({
      orderNo: 'JO-001',
      itemCode: 'FG-001',
      equipCode: 'EQ-1',
      company: 'C1',
      plant: 'P1',
      planDate: bomEffectiveDate,
    } as JobOrder);
    matLotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'RM-X' } as MatLot);
    bomRepo.count.mockResolvedValue(0);

    await expect(target.scanMount('JO-001', 'MAT-001', 'C1', 'P1')).rejects.toThrow(
      '오장착: 이 제품 BOM에 없는 자재입니다',
    );
    expect(equipMaterialService.mount).not.toHaveBeenCalled();
  });

  it('should keep existing not-found behavior when job order is missing', async () => {
    jobOrderRepo.findOne.mockResolvedValue(null);

    await expect(target.scanMount('JO-404', 'MAT-001', 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });
});

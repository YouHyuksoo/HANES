import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CarrierService } from './carrier.service';
import { CarrierMaster } from '../../../entities/carrier-master.entity';

const COMPANY = '40';
const PLANT = '1000';

describe('CarrierService', () => {
  let service: CarrierService;
  const repo = { findOne: jest.fn(), create: jest.fn((v) => v), save: jest.fn(async (v) => v), remove: jest.fn(), createQueryBuilder: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [CarrierService, { provide: getRepositoryToken(CarrierMaster), useValue: repo }],
    }).compile();
    service = module.get(CarrierService);
  });

  it('대차번호는 공백 제거·대문자로 저장한다', async () => {
    repo.findOne.mockResolvedValue(null);
    const saved = await service.create({ carrierNo: ' cr-001 ', carrierType: 'CART' }, COMPANY, PLANT, 'tester');
    expect(saved.carrierNo).toBe('CR-001');
    expect(saved.useYn).toBe('Y');
  });

  it('중복 대차번호는 409', async () => {
    repo.findOne.mockResolvedValue({ carrierNo: 'CR-001' });
    await expect(service.create({ carrierNo: 'CR-001', carrierType: 'CART' }, COMPANY, PLANT, 'tester')).rejects.toThrow(ConflictException);
  });

  it('수용량 0 이하는 400', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.create({ carrierNo: 'CR-002', carrierType: 'TRAY', capacity: 0 }, COMPANY, PLANT, 'tester')).rejects.toThrow(BadRequestException);
  });
});

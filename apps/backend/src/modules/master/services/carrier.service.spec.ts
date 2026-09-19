import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CarrierService } from './carrier.service';
import { CarrierMaster } from '../../../entities/carrier-master.entity';

const COMPANY = '40';
const PLANT = '1000';

describe('CarrierService', () => {
  let service: CarrierService;
  const repo = {
    findOne: jest.fn(), create: jest.fn((v) => v), save: jest.fn(async (v) => v), remove: jest.fn(), createQueryBuilder: jest.fn(),
    manager: { query: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.manager.query.mockResolvedValue([{ CNT: 0 }]);
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

  it('라벨 접두어로 시작하는 대차번호는 400', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.create({ carrierNo: 'SG1234', carrierType: 'CART' }, COMPANY, PLANT, 'tester')).rejects.toThrow(/라벨 접두어/);
    await expect(service.create({ carrierNo: 'vh1-rm0001', carrierType: 'CART' }, COMPANY, PLANT, 'tester')).rejects.toThrow(BadRequestException);
  });

  it('담긴 라벨/LOT이 있는 대차는 삭제 400', async () => {
    repo.findOne.mockResolvedValue({ carrierNo: 'CR-001' });
    repo.manager.query.mockResolvedValue([{ CNT: 2 }]);
    await expect(service.delete('CR-001', COMPANY, PLANT)).rejects.toThrow(/먼저 비우세요/);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('빈 대차는 삭제된다', async () => {
    repo.findOne.mockResolvedValue({ carrierNo: 'CR-001' });
    repo.manager.query.mockResolvedValue([{ CNT: 0 }]);
    await expect(service.delete('CR-001', COMPANY, PLANT)).resolves.toEqual({ carrierNo: 'CR-001', deleted: true });
    expect(repo.remove).toHaveBeenCalled();
  });
});

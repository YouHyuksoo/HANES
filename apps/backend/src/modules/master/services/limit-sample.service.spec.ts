/**
 * @file limit-sample.service.spec.ts
 * @description 양불마스터 서비스 — 유효기간 판정, 대표 사진 유일성 검증
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LimitSampleService } from './limit-sample.service';
import { LimitSample } from '../../../entities/limit-sample.entity';
import { LimitSampleImage } from '../../../entities/limit-sample-image.entity';

const COMPANY = '40';
const PLANT = '1000';

function sample(over: Partial<LimitSample> = {}): LimitSample {
  return {
    company: COMPANY,
    plant: PLANT,
    sampleCode: 'LS-OK-0001',
    sampleType: 'OK',
    sampleName: '양품 한도견본',
    itemCode: null,
    processCode: null,
    defectCode: null,
    inspectType: null,
    location: null,
    validFrom: null,
    validTo: null,
    approvedBy: null,
    approvedAt: null,
    status: 'ACTIVE',
    requiredYn: 'Y',
    sortOrder: 0,
    remark: null,
    useYn: 'Y',
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as LimitSample;
}

function image(over: Partial<LimitSampleImage> = {}): LimitSampleImage {
  return {
    company: COMPANY,
    plant: PLANT,
    sampleCode: 'LS-OK-0001',
    seqNo: 1,
    imageUrl: '/uploads/limit-samples/a.png',
    caption: null,
    isPrimary: 'N',
    sortOrder: 0,
    createdBy: null,
    createdAt: new Date(),
    ...over,
  } as LimitSampleImage;
}

/** 오늘 기준 offset일 뒤 날짜 (로컬) */
function dayOffset(offset: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
}

describe('LimitSampleService', () => {
  let service: LimitSampleService;
  let sampleRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let imageRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    sampleRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };
    imageRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LimitSampleService,
        { provide: getRepositoryToken(LimitSample), useValue: sampleRepo },
        { provide: getRepositoryToken(LimitSampleImage), useValue: imageRepo },
      ],
    }).compile();

    service = module.get<LimitSampleService>(LimitSampleService);
  });

  describe('toView — 유효기간 판정', () => {
    it('VALID_TO가 없으면 NONE', () => {
      const view = service.toView(sample({ validTo: null }), []);
      expect(view.expiryState).toBe('NONE');
      expect(view.daysToExpiry).toBeNull();
    });

    it('VALID_TO가 지났으면 EXPIRED', () => {
      const view = service.toView(sample({ validTo: dayOffset(-3) }), []);
      expect(view.expiryState).toBe('EXPIRED');
      expect(view.daysToExpiry).toBe(-3);
    });

    it('VALID_TO가 임박 기준 이내면 EXPIRING', () => {
      const view = service.toView(sample({ validTo: dayOffset(10) }), [], 30);
      expect(view.expiryState).toBe('EXPIRING');
      expect(view.daysToExpiry).toBe(10);
    });

    it('VALID_TO가 임박 기준 밖이면 VALID', () => {
      const view = service.toView(sample({ validTo: dayOffset(90) }), [], 30);
      expect(view.expiryState).toBe('VALID');
    });

    it('대표 사진이 primaryImageUrl로 나오고, 없으면 첫 사진을 쓴다', () => {
      const withPrimary = service.toView(sample(), [
        image({ seqNo: 1, imageUrl: '/a.png', isPrimary: 'N', sortOrder: 1 }),
        image({ seqNo: 2, imageUrl: '/b.png', isPrimary: 'Y', sortOrder: 2 }),
      ]);
      expect(withPrimary.primaryImageUrl).toBe('/b.png');
      expect(withPrimary.images).toHaveLength(2);

      const noPrimary = service.toView(sample(), [
        image({ seqNo: 1, imageUrl: '/a.png', isPrimary: 'N', sortOrder: 5 }),
        image({ seqNo: 2, imageUrl: '/b.png', isPrimary: 'N', sortOrder: 1 }),
      ]);
      expect(noPrimary.primaryImageUrl).toBe('/b.png');
    });
  });

  describe('addImage — 대표 사진 자동 지정', () => {
    it('첫 사진은 자동으로 대표가 된다', async () => {
      sampleRepo.findOne.mockResolvedValue(sample());
      imageRepo.find.mockResolvedValueOnce([]).mockResolvedValue([
        image({ seqNo: 1, isPrimary: 'Y' }),
      ]);

      await service.addImage('LS-OK-0001', '/uploads/limit-samples/a.png', COMPANY, PLANT, 'tester');

      expect(imageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ seqNo: 1, isPrimary: 'Y' }),
      );
    });

    it('두 번째 사진은 대표가 되지 않고 SEQ_NO가 MAX+1이다', async () => {
      sampleRepo.findOne.mockResolvedValue(sample());
      imageRepo.find
        .mockResolvedValueOnce([image({ seqNo: 1, isPrimary: 'Y' })])
        .mockResolvedValue([image({ seqNo: 1, isPrimary: 'Y' }), image({ seqNo: 2 })]);

      await service.addImage('LS-OK-0001', '/uploads/limit-samples/b.png', COMPANY, PLANT, 'tester');

      expect(imageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ seqNo: 2, isPrimary: 'N' }),
      );
    });
  });

  describe('updateImageMeta — 대표는 견본당 1장', () => {
    it('대표를 바꾸면 기존 대표를 먼저 내린다', async () => {
      sampleRepo.findOne.mockResolvedValue(sample());
      imageRepo.findOne.mockResolvedValue(image({ seqNo: 2, isPrimary: 'N' }));
      imageRepo.find.mockResolvedValue([
        image({ seqNo: 1, isPrimary: 'N' }),
        image({ seqNo: 2, isPrimary: 'Y' }),
      ]);

      await service.updateImageMeta('LS-OK-0001', 2, { isPrimary: 'Y' }, COMPANY, PLANT, 'tester');

      // 같은 견본의 모든 사진을 N으로 내린 뒤 대상만 Y로 올린다
      expect(imageRepo.update).toHaveBeenCalledWith(
        { company: COMPANY, plant: PLANT, sampleCode: 'LS-OK-0001' },
        { isPrimary: 'N' },
      );
      expect(imageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ seqNo: 2, isPrimary: 'Y' }),
      );
    });
  });
});

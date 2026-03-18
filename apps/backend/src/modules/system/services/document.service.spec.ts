/**
 * @file src/modules/system/services/document.service.spec.ts
 * @description DocumentService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "DocumentService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DocumentService } from './document.service';
import { DocumentMaster } from '../../../entities/document-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('DocumentService', () => {
  let target: DocumentService;
  let mockRepo: DeepMocked<Repository<DocumentMaster>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<DocumentMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: getRepositoryToken(DocumentMaster), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<DocumentService>(DocumentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return document when found', async () => {
      // Arrange
      const doc = { docNo: 'DOC-001', status: 'DRAFT' } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);

      // Act
      const result = await target.findById('DOC-001');

      // Assert
      expect(result).toEqual(doc);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create document with DRAFT status and auto-generated docNo', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.getOne.mockResolvedValue(null);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const dto = { docTitle: 'Test Doc', docType: 'QMS' } as any;
      const entity = { docNo: 'DOC-20260318-001', status: 'DRAFT', revisionNo: 1, ...dto } as DocumentMaster;
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      // Act
      const result = await target.create(dto, 'COMP', 'PLANT', 'user@test.com');

      // Assert
      expect(result.status).toBe('DRAFT');
      expect(result.revisionNo).toBe(1);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update DRAFT document', async () => {
      // Arrange
      const doc = { docNo: 'DOC-001', status: 'DRAFT' } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);
      mockRepo.save.mockResolvedValue(doc);

      // Act
      const result = await target.update('DOC-001', { docTitle: 'Updated' } as any, 'user');

      // Assert
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when status is not DRAFT', async () => {
      // Arrange
      const doc = { docNo: 'DOC-001', status: 'APPROVED' } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);

      // Act & Assert
      await expect(target.update('DOC-001', {} as any, 'user')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete DRAFT document', async () => {
      // Arrange
      const doc = { docNo: 'DOC-001', status: 'DRAFT' } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);
      mockRepo.remove.mockResolvedValue(doc);

      // Act
      await target.delete('DOC-001');

      // Assert
      expect(mockRepo.remove).toHaveBeenCalledWith(doc);
    });

    it('should throw BadRequestException when status is not DRAFT', async () => {
      // Arrange
      const doc = { docNo: 'DOC-001', status: 'APPROVED' } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);

      // Act & Assert
      await expect(target.delete('DOC-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── approve ───
  describe('approve', () => {
    it('should approve DRAFT document', async () => {
      // Arrange
      const doc = { docNo: 'DOC-001', status: 'DRAFT' } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);
      mockRepo.save.mockResolvedValue({ ...doc, status: 'APPROVED' } as DocumentMaster);

      // Act
      const result = await target.approve('DOC-001', 'user');

      // Assert
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should approve REVIEW document', async () => {
      // Arrange
      const doc = { docNo: 'DOC-001', status: 'REVIEW' } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);
      mockRepo.save.mockResolvedValue({ ...doc, status: 'APPROVED' } as DocumentMaster);

      // Act
      const result = await target.approve('DOC-001', 'user');

      // Assert
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when status is APPROVED', async () => {
      // Arrange
      const doc = { docNo: 'DOC-001', status: 'APPROVED' } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);

      // Act & Assert
      await expect(target.approve('DOC-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── revise ───
  describe('revise', () => {
    it('should revise APPROVED document', async () => {
      // Arrange
      const doc = {
        docNo: 'DOC-001',
        status: 'APPROVED',
        revisionNo: 1,
        docTitle: 'Test',
        docType: 'QMS',
        company: 'COMP',
        plant: 'PLANT',
      } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);
      mockRepo.save.mockImplementation((entity) => Promise.resolve(entity as DocumentMaster));

      const newDoc = { ...doc, revisionNo: 2, status: 'DRAFT' } as DocumentMaster;
      mockRepo.create.mockReturnValue(newDoc);

      // Act
      const result = await target.revise('DOC-001', 'user');

      // Assert
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when status is not APPROVED', async () => {
      // Arrange
      const doc = { docNo: 'DOC-001', status: 'DRAFT' } as DocumentMaster;
      mockRepo.findOne.mockResolvedValue(doc);

      // Act & Assert
      await expect(target.revise('DOC-001', 'user')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return paginated results with query builder', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.skip.mockReturnThis();
      qb.take.mockReturnThis();
      qb.getCount.mockResolvedValue(1);
      qb.getMany.mockResolvedValue([{ docNo: 'DOC-001' }]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.findAll({ page: 1, limit: 50 } as any, 'COMP', 'PLANT');

      // Assert
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  // ─── getExpiring ───
  describe('getExpiring', () => {
    it('should return expiring documents', async () => {
      // Arrange
      const qb = createMock<any>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.getMany.mockResolvedValue([{ docNo: 'DOC-001' }]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await target.getExpiring(30, 'COMP', 'PLANT');

      // Assert
      expect(result).toHaveLength(1);
    });
  });
});

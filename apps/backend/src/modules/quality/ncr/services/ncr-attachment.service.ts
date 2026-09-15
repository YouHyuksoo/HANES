/**
 * @file quality/ncr/services/ncr-attachment.service.ts
 * @description 부적합 보고서 첨부파일 — 등록·목록·삭제
 *
 * 초보자 가이드:
 * 1. SEQ 는 DB DEFAULT 가 아니라 여기서 count+1 로 계산한다. 복합 PK 컬럼의 DEFAULT 를
 *    TypeORM 이 INSERT 에 안 채워 ORA-01400 이 나는 전례가 있었다(LABEL_PRINT_LOGS).
 * 2. 동시 업로드로 SEQ 가 겹치지 않게 트랜잭션 안에서 대상 보고서 행을 잠그고 계산한다.
 * 3. 종결된 보고서에는 첨부를 추가·삭제할 수 없다. 본문 수정을 막아놓고 증빙만 바뀌면
 *    품질기록의 불변 보장이 뚫린다.
 * 4. 파일 실체 삭제는 DB 삭제가 성공한 뒤에 한다. 반대로 하면 파일만 사라지고 행이 남는다.
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { NcrAttachment } from '../../../../entities/ncr-attachment.entity';
import { NcrReport } from '../../../../entities/ncr-report.entity';
import { lockRowsForUpdate } from '../../../../common/utils/row-lock.util';
import { TransactionService } from '../../../../shared/transaction.service';

/** 업로드된 파일에서 서비스가 필요로 하는 값만 추린 모양 (multer File 의 부분집합) */
export interface UploadedFileInfo {
  originalname: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class NcrAttachmentService {
  private readonly logger = new Logger(NcrAttachmentService.name);

  constructor(
    @InjectRepository(NcrAttachment)
    private readonly attachRepo: Repository<NcrAttachment>,
    @InjectRepository(NcrReport)
    private readonly ncrRepo: Repository<NcrReport>,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  /** 이미지인지 문서인지 — 인쇄 양식에 사진으로 실을지 링크로만 둘지를 가른다 */
  private resolveKind(mimetype: string, originalname: string): 'IMAGE' | 'DOC' {
    if (/^image\//i.test(mimetype)) return 'IMAGE';
    if (/\.(jpe?g|png|gif|bmp|webp)$/i.test(originalname)) return 'IMAGE';
    return 'DOC';
  }

  private async findReportOrThrow(ncrNo: string, company?: string, plant?: string): Promise<NcrReport> {
    const row = await this.ncrRepo.findOne({
      where: { ncrNo, ...this.tenantWhere(company, plant) },
    });
    if (!row) throw new NotFoundException(`부적합 보고서를 찾을 수 없습니다: ${ncrNo}`);
    return row;
  }

  private assertNotClosed(row: NcrReport): void {
    if (row.status === 'CLOSED') {
      throw new BadRequestException(
        `종결된 부적합 보고서는 첨부를 변경할 수 없습니다: ${row.ncrNo}. 필요하면 새로 발행하세요.`,
      );
    }
  }

  async findAll(ncrNo: string, company?: string, plant?: string): Promise<NcrAttachment[]> {
    await this.findReportOrThrow(ncrNo, company, plant);
    return this.attachRepo.find({
      where: { ncrNo, ...this.tenantWhere(company, plant) },
      order: { seq: 'ASC' },
    });
  }

  async create(
    ncrNo: string,
    file: UploadedFileInfo,
    remark: string | undefined,
    userId: string,
    company: string,
    plant: string,
  ): Promise<NcrAttachment> {
    const report = await this.findReportOrThrow(ncrNo, company, plant);
    this.assertNotClosed(report);

    const saved = await this.tx.run(async (qr) => {
      // 같은 보고서에 동시 업로드가 들어와도 SEQ 가 겹치지 않도록 보고서 행을 잠근다
      await lockRowsForUpdate(qr, 'NCR_REPORTS', {
        COMPANY: company,
        PLANT_CD: plant,
        NCR_NO: ncrNo,
      });

      const used = await qr.manager.count(NcrAttachment, {
        where: { ncrNo, company, plant },
      });

      return qr.manager.save(
        qr.manager.create(NcrAttachment, {
          company,
          plant,
          ncrNo,
          // 복합 PK 라 DB DEFAULT 에 맡기지 않고 여기서 명시 계산한다(ORA-01400 전례)
          seq: used + 1,
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size ?? null,
          mimeType: file.mimetype ?? null,
          kind: this.resolveKind(file.mimetype ?? '', file.originalname),
          remark: remark?.trim() || null,
          createdBy: userId,
          updatedBy: userId,
        }),
      );
    });

    this.logger.log(`NCR 첨부 등록: ${ncrNo} #${saved.seq} ${file.originalname}`);
    return saved;
  }

  async remove(
    ncrNo: string,
    seq: number,
    userId: string,
    company: string,
    plant: string,
  ): Promise<void> {
    const report = await this.findReportOrThrow(ncrNo, company, plant);
    this.assertNotClosed(report);

    const row = await this.attachRepo.findOne({ where: { ncrNo, seq, company, plant } });
    if (!row) throw new NotFoundException(`첨부파일을 찾을 수 없습니다: ${ncrNo} #${seq}`);

    await this.attachRepo.remove(row);

    // 파일 실체는 DB 삭제가 끝난 뒤에 지운다. 실패해도 목록은 이미 정리됐으므로 경고만 남긴다.
    try {
      if (row.filePath && existsSync(row.filePath)) unlinkSync(row.filePath);
    } catch (error: unknown) {
      this.logger.warn(`첨부 파일 삭제 실패(행은 삭제됨): ${row.filePath} - ${String(error)}`);
    }
    this.logger.log(`NCR 첨부 삭제: ${ncrNo} #${seq} (${userId})`);
  }
}

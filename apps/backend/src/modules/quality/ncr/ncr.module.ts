/**
 * @file quality/ncr/ncr.module.ts
 * @description 부적합 보고서(NCR) 모듈
 *
 * quality.module 은 서브모듈 조합 역할만 하는 얇은 루트라(아키텍처 규칙),
 * NCR 도 전용 모듈로 분리해 엔티티·컨트롤러·서비스를 여기서 묶는다.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NcrReport } from '../../../entities/ncr-report.entity';
import { NcrAttachment } from '../../../entities/ncr-attachment.entity';
import { NcrController } from './controllers/ncr.controller';
import { NcrService } from './services/ncr.service';
import { NcrAttachmentService } from './services/ncr-attachment.service';

@Module({
  imports: [TypeOrmModule.forFeature([NcrReport, NcrAttachment])],
  controllers: [NcrController],
  providers: [NcrService, NcrAttachmentService],
  exports: [NcrService, NcrAttachmentService],
})
export class NcrModule {}

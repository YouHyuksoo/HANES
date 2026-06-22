/**
 * @file src/modules/ai/ai.module.ts
 * @description AI 채팅 모듈 (Mistral 연동)
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysConfig } from '../../entities/sys-config.entity';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [TypeOrmModule.forFeature([SysConfig])],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}

/**
 * @file src/modules/quality/crimp-inspect/crimp-inspect.module.ts
 * @description 절압물검사 서브모듈 — 압착 작업지시를 단자별 압착 규격(TERMINAL_CRIMP_SPECS)으로 판정한다.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { SharedModule } from '../../../shared/shared.module';
import { CrimpInspectController } from './controllers/crimp-inspect.controller';
import { CrimpInspectService } from './services/crimp-inspect.service';

@Module({
  imports: [TypeOrmModule.forFeature([InspectResult]), SharedModule],
  controllers: [CrimpInspectController],
  providers: [CrimpInspectService],
})
export class CrimpInspectModule {}

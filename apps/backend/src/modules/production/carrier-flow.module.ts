/**
 * @file carrier-flow.module.ts
 * @description 대차 흐름 전용 모듈 — CarrierFlowService/Controller를 production.module.ts에 직접 등록하지 않고
 * 별도 모듈로 분리한다. 이유: MatIssueService(material/issue 서브모듈)가 CarrierFlowService를 주입받아야 하는데
 * production.module.ts는 IssueModule을 import하므로, 반대로 production.module.ts에 직접 등록하면
 * IssueModule → CarrierFlowService 참조 시 순환 의존이 생긴다. CarrierFlowModule을 독립시켜
 * production.module.ts와 material/issue 양쪽에서 각자 import하면 순환 없이 공유할 수 있다.
 *
 * 초보자 가이드:
 * 1. TransactionService/NumberingService는 SharedModule이 @Global()이라 별도 import 없이 주입된다.
 * 2. exports에 CarrierFlowService를 반드시 넣어야 다른 모듈이 import 후 주입받을 수 있다.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarrierMaster } from '../../entities/carrier-master.entity';
import { EquipMaster } from '../../entities/equip-master.entity';
import { JobOrder } from '../../entities/job-order.entity';
import { RoutingProcess } from '../../entities/routing-process.entity';
import { ItemMaster } from '../../entities/item-master.entity';
import { SgLabel } from '../../entities/sg-label.entity';
import { FgLabel } from '../../entities/fg-label.entity';
import { MatLot } from '../../entities/mat-lot.entity';
import { CarrierFlowController } from './controllers/carrier-flow.controller';
import { CarrierFlowService } from './services/carrier-flow.service';

@Module({
  imports: [TypeOrmModule.forFeature([CarrierMaster, EquipMaster, JobOrder, RoutingProcess, ItemMaster, SgLabel, FgLabel, MatLot])],
  controllers: [CarrierFlowController],
  providers: [CarrierFlowService],
  exports: [CarrierFlowService],
})
export class CarrierFlowModule {}

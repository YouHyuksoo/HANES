import { Module } from '@nestjs/common';
import { AiScenariosController } from './ai-scenarios.controller';
import { AiScenariosService } from './ai-scenarios.service';

/**
 * 시나리오 모듈.
 * 정의는 definitions/*.json 이고 repo 에 커밋해 배포로 반영한다.
 * 서비스가 부팅 시 읽어 검증하며, 규격 위반 파일은 적재하지 않는다.
 */
@Module({
  controllers: [AiScenariosController],
  providers: [AiScenariosService],
  exports: [AiScenariosService],
})
export class AiScenariosModule {}

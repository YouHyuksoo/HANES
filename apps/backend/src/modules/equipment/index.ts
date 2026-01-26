/**
 * @file src/modules/equipment/index.ts
 * @description 설비관리 모듈 배럴 파일 (barrel file)
 *
 * 초보자 가이드:
 * 1. **배럴 파일 목적**: 모듈의 모든 export를 한 곳에서 관리
 * 2. **사용 방법**: import { EquipmentModule, EquipMasterService } from './modules/equipment';
 * 3. **장점**: import 경로 단순화, 모듈 API 명확화
 */

// Module
export { EquipmentModule } from './equipment.module';

// DTOs
export {
  CreateEquipMasterDto,
  UpdateEquipMasterDto,
  EquipMasterQueryDto,
  ChangeEquipStatusDto,
  EQUIP_STATUS,
  EQUIP_TYPES,
  COMM_TYPES,
  type EquipStatus,
  type EquipType,
  type CommType,
} from './dto/equip-master.dto';

export {
  CreateConsumableDto,
  UpdateConsumableDto,
  ConsumableQueryDto,
  CreateConsumableLogDto,
  ConsumableLogQueryDto,
  IncreaseCountDto,
  RegisterReplacementDto,
  CONSUMABLE_CATEGORIES,
  CONSUMABLE_STATUS,
  CONSUMABLE_LOG_TYPES,
  type ConsumableCategory,
  type ConsumableStatus,
  type ConsumableLogType,
} from './dto/consumable.dto';

// Services
export { EquipMasterService } from './services/equip-master.service';
export { ConsumableService } from './services/consumable.service';

// Controllers
export { EquipMasterController } from './controllers/equip-master.controller';
export {
  ConsumableController,
  ConsumableLogController,
} from './controllers/consumable.controller';

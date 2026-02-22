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
} from './dto/equip-master.dto';

export {
  EquipCreateConsumableDto,
  EquipUpdateConsumableDto,
  ConsumableQueryDto,
  EquipCreateConsumableLogDto,
  ConsumableLogQueryDto,
  IncreaseCountDto,
  RegisterReplacementDto,
} from './dto/consumable.dto';

// Constants and Types from @harness/shared
export {
  EQUIP_STATUS_VALUES,
  EQUIP_TYPE_VALUES,
  COMM_TYPE_VALUES,
  CONSUMABLE_CATEGORY_VALUES,
  CONSUMABLE_STATUS_VALUES,
  CONSUMABLE_LOG_TYPE_VALUES,
  type EquipStatusValue,
  type EquipTypeValue,
  type CommTypeValue,
  type ConsumableCategoryValue,
  type ConsumableStatusValue,
  type ConsumableLogTypeValue,
} from '@harness/shared';

// Type aliases for backward compatibility
export type EquipStatus = import('@harness/shared').EquipStatusValue;
export type EquipType = import('@harness/shared').EquipTypeValue;
export type CommType = import('@harness/shared').CommTypeValue;
export type ConsumableCategory = import('@harness/shared').ConsumableCategoryValue;
export type ConsumableStatus = import('@harness/shared').ConsumableStatusValue;
export type ConsumableLogType = import('@harness/shared').ConsumableLogTypeValue;

// Services
export { EquipMasterService } from './services/equip-master.service';
export { ConsumableService } from './services/consumable.service';

// Controllers
export { EquipMasterController } from './controllers/equip-master.controller';
export {
  ConsumableController,
  ConsumableLogController,
} from './controllers/consumable.controller';

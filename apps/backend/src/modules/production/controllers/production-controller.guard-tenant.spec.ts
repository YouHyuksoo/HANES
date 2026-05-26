import 'reflect-metadata';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { JobOrderController } from './job-order.controller';
import { ProdPlanController } from './prod-plan.controller';
import { ProdResultController } from './prod-result.controller';
import { ProductLabelController } from './product-label.controller';
import { ProductionViewsController } from './production-views.controller';
import { RepairController } from './repair.controller';
import { SampleInspectController } from './sample-inspect.controller';
import { SimulationController } from './simulation.controller';

type ControllerCase = {
  controller: new (...args: any[]) => any;
  methods: string[];
};

const CASES: ControllerCase[] = [
  {
    controller: JobOrderController,
    methods: [
      'findAll',
      'findTree',
      'findUnsyncedForErp',
      'findByOrderNo',
      'findById',
      'getJobOrderSummary',
      'create',
      'update',
      'delete',
      'start',
      'hold',
      'holdRelease',
      'complete',
      'cancel',
      'changeStatus',
      'updateErpSyncYn',
      'markAsSynced',
    ],
  },
  {
    controller: ProdPlanController,
    methods: [
      'findAll',
      'getSummary',
      'create',
      'bulkCreate',
      'searchOrders',
      'importOrders',
      'update',
      'delete',
      'confirm',
      'bulkConfirm',
      'unconfirm',
      'issueJobOrder',
      'close',
    ],
  },
  {
    controller: ProdResultController,
    methods: [
      'findAll',
      'findByJobOrderId',
      'findById',
      'create',
      'update',
      'delete',
      'complete',
      'cancel',
      'getSummaryByJobOrder',
      'getSummaryByEquip',
      'getSummaryByWorker',
      'getDailySummary',
      'getSummaryByProduct',
    ],
  },
  {
    controller: ProductLabelController,
    methods: ['findLabelableResults', 'findLabelableOqcPassed', 'createLabels'],
  },
  {
    controller: ProductionViewsController,
    methods: ['getProgress', 'getSampleInspect', 'getPackResult', 'getWipStock'],
  },
  {
    controller: RepairController,
    methods: ['findAll', 'getInventory', 'findOne', 'create', 'update', 'remove'],
  },
  {
    controller: SampleInspectController,
    methods: ['findHistory', 'findByJobOrder', 'create'],
  },
  {
    controller: SimulationController,
    methods: ['simulate', 'save', 'getLatest'],
  },
];

const mockExecutionContext = {
  switchToHttp: () => ({
    getRequest: () => ({
      user: {
        company: 'COMPANY_TEST',
        plant: 'PLANT_TEST',
      },
    }),
  }),
} as any;

describe('Production Controllers Guard/Tenant Metadata', () => {
  // JwtAuthGuard가 APP_GUARD로 전역 등록되어 컨트롤러 레벨 @UseGuards 검증은 더 이상 의미가 없다.
  // 회귀 방지 차원에서 컨트롤러에 별도의 가드 메타데이터가 끼어들지 않았는지만 확인한다.
  it.each(CASES)('does not attach extra controller-level guards: $controller.name', ({ controller }) => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
    expect(guards).toEqual([]);
  });

  it.each(
    CASES.flatMap(({ controller, methods }) =>
      methods.map((method) => ({ controller, method })),
    ),
  )('has @Company and @Plant decorators: $controller.name.$method', ({ controller, method }) => {
    const routeArgs = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {};
    const customFactories = Object.values(routeArgs)
      .map((arg: any) => arg?.factory)
      .filter((factory: unknown) => typeof factory === 'function') as Array<
      (data: unknown, ctx: unknown) => unknown
    >;

    const values = customFactories.map((factory) => factory(undefined, mockExecutionContext));

    expect(values).toContain('COMPANY_TEST');
    expect(values).toContain('PLANT_TEST');
  });
});

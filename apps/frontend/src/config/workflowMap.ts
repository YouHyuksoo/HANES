export type WorkflowLaneId =
  | "purchase-arrival"
  | "material-iqc"
  | "production"
  | "quality"
  | "shipping"
  | "trace-reversal";

export interface WorkflowLane {
  id: WorkflowLaneId;
  title: string;
  description: string;
  color: string;
  y: number;
}

export interface WorkflowRoute {
  label: string;
  path: string;
}

export interface WorkflowActivityNode {
  id: string;
  lane: WorkflowLaneId;
  activity: string;
  summary: string;
  detail: string;
  x: number;
  dataObjects: string[];
  routes: WorkflowRoute[];
  inputs: string[];
  outputs: string[];
}

export interface WorkflowBusinessEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: "normal" | "branch" | "reversal" | "reference";
}

export const workflowLanes: WorkflowLane[] = [
  {
    id: "purchase-arrival",
    title: "구매/입하",
    description: "외부 발주와 현장 입하가 MES 재고 흐름으로 들어오는 시작점입니다.",
    color: "#0f766e",
    y: 0,
  },
  {
    id: "material-iqc",
    title: "자재/IQC",
    description: "입하된 자재를 검사하고 라벨, 입고, 출고 가능한 재고로 전환합니다.",
    color: "#2563eb",
    y: 220,
  },
  {
    id: "production",
    title: "생산",
    description: "도면, 라우팅, 작업지시를 기준으로 키팅, 조립, 실적을 수행합니다.",
    color: "#7c3aed",
    y: 440,
  },
  {
    id: "quality",
    title: "공정검사/품질",
    description: "공정검사, 불량, 재작업, OQC로 제품 품질 게이트를 관리합니다.",
    color: "#b45309",
    y: 660,
  },
  {
    id: "shipping",
    title: "제품/출하",
    description: "완제품 입고 이후 박스, 팔레트, 출하지시, 출하확정으로 고객 출하를 완료합니다.",
    color: "#be123c",
    y: 880,
  },
  {
    id: "trace-reversal",
    title: "추적/역처리",
    description: "제품/자재 추적성과 입고취소, 출하취소처럼 뒤 공정 조건을 확인하는 보정 흐름입니다.",
    color: "#475569",
    y: 1100,
  },
];

export const workflowNodes: WorkflowActivityNode[] = [
  {
    id: "purchase-order",
    lane: "purchase-arrival",
    activity: "발주 등록",
    summary: "거래처에 요청한 품목과 수량을 PO로 확정합니다.",
    detail: "입하의 출처가 되는 구매오더를 만들고 라인별 품목, 수량, 납기, 거래처를 관리합니다.",
    x: 0,
    dataObjects: ["PURCHASE_ORDERS", "PURCHASE_ORDER_ITEMS"],
    routes: [
      { label: "발주관리", path: "/material/po" },
      { label: "발주현황", path: "/material/po-status" },
    ],
    inputs: ["거래처", "품목", "발주수량"],
    outputs: ["PO 라인", "입하 가능 잔량"],
  },
  {
    id: "arrival-register",
    lane: "purchase-arrival",
    activity: "입하 등록",
    summary: "PO 라인 또는 수동 입력으로 공장에 들어온 자재를 등록합니다.",
    detail: "입하 등록은 구매오더의 잔량을 차감하고 입하번호를 생성합니다. 이후 IQC 또는 라벨 발행 단계가 이 입하번호와 품목을 기준으로 움직입니다.",
    x: 260,
    dataObjects: ["MAT_ARRIVALS", "MAT_LOTS", "STOCK_TRANSACTIONS"],
    routes: [
      { label: "입하등록", path: "/material/arrival" },
      { label: "입하실적조회", path: "/material/arrival-result" },
    ],
    inputs: ["PO 라인", "입하수량", "제조사", "창고"],
    outputs: ["입하번호", "입하 시리얼 후보", "입하 수불"],
  },
  {
    id: "arrival-review",
    lane: "purchase-arrival",
    activity: "입하 실적 확인",
    summary: "입하 단위로 시리얼, 제조사, 취소 가능 여부를 확인합니다.",
    detail: "입하 이후 IQC, 라벨, 입고 진행 여부를 한곳에서 확인하고 뒤 공정이 없을 때만 입하취소를 수행할 수 있습니다.",
    x: 520,
    dataObjects: ["MAT_ARRIVALS", "MAT_LOTS", "STOCK_TRANSACTIONS"],
    routes: [
      { label: "입하실적조회", path: "/material/arrival-result" },
      { label: "입하수불", path: "/material/arrival-transaction" },
    ],
    inputs: ["입하번호", "품목"],
    outputs: ["입하 상태", "입하취소 가능 여부"],
  },
  {
    id: "iqc-policy",
    lane: "material-iqc",
    activity: "IQC 기준 준비",
    summary: "품목별 검사 항목과 AQL 정책을 준비합니다.",
    detail: "품목이 어떤 검사항목과 AQL 기준으로 검사될지 정합니다. 실제 IQC 판정은 이 기준을 읽어 샘플수와 Ac/Re를 계산합니다.",
    x: 0,
    dataObjects: ["IQC_PART_SPECS", "IQC_PART_SPEC_ITEMS", "IQC_AQL_POLICIES", "AQL_STANDARDS"],
    routes: [
      { label: "IQC품목규격", path: "/master/iqc-part-spec" },
      { label: "AQL 기준관리", path: "/quality/aql" },
    ],
    inputs: ["품목", "검사항목", "AQL 정책"],
    outputs: ["품목별 검사 기준", "샘플링 정책"],
  },
  {
    id: "iqc-inspection",
    lane: "material-iqc",
    activity: "IQC 판정",
    summary: "입하번호와 품목 단위로 샘플 검사 후 PASS/FAIL을 확정합니다.",
    detail: "입하된 자재가 생산에 투입 가능한지 판정합니다. PASS는 라벨/입고로 연결되고 FAIL은 불용 또는 재검토 흐름으로 분기됩니다.",
    x: 260,
    dataObjects: ["IQC_LOGS", "MAT_LOTS", "MAT_ARRIVALS", "DEFECT_CODE_MASTERS"],
    routes: [
      { label: "IQC검사", path: "/material/iqc" },
      { label: "IQC이력", path: "/material/iqc-history" },
      { label: "불량코드관리", path: "/quality/defect-code" },
    ],
    inputs: ["입하번호", "품목", "검사항목", "시료"],
    outputs: ["IQC 이력", "PASS/FAIL", "불량코드"],
  },
  {
    id: "material-label",
    lane: "material-iqc",
    activity: "자재 라벨 발행",
    summary: "IQC 합격 자재에 내부 관리용 MAT UID 라벨을 발행합니다.",
    detail: "외부 입하 정보가 현장 스캔 가능한 내부 시리얼로 전환됩니다. 자동입고 설정이 있으면 입고까지 이어집니다.",
    x: 520,
    dataObjects: ["MAT_LOTS", "LABEL_PRINT_LOGS"],
    routes: [
      { label: "입하라벨발행", path: "/material/receive-label" },
      { label: "라벨디자인관리", path: "/master/label" },
    ],
    inputs: ["IQC PASS 입하건"],
    outputs: ["MAT UID", "라벨 출력 이력"],
  },
  {
    id: "material-receive",
    lane: "material-iqc",
    activity: "자재 입고",
    summary: "라벨 발행된 자재를 창고 재고로 확정합니다.",
    detail: "입하 상태의 자재를 실제 사용 가능한 창고 재고로 전환합니다. 이후 출고요청, 공정투입, LOT 분할/병합의 기준이 됩니다.",
    x: 780,
    dataObjects: ["MAT_STOCKS", "STOCK_TRANSACTIONS", "MAT_RECEIVINGS"],
    routes: [
      { label: "자재입고", path: "/material/receive" },
      { label: "입고이력", path: "/material/receive-history" },
      { label: "자재재고", path: "/inventory/material-stock" },
    ],
    inputs: ["MAT UID", "입고창고"],
    outputs: ["자재재고", "입고 수불"],
  },
  {
    id: "lot-control",
    lane: "material-iqc",
    activity: "LOT 관리",
    summary: "입고된 LOT을 조회하고 필요하면 분할, 병합, 보류, 폐기합니다.",
    detail: "자재 LOT은 이후 생산 투입과 추적성의 기준입니다. 분할/병합은 원본 LOT을 폐기하고 새 LOT을 발행하는 재고 재가공 흐름입니다.",
    x: 1040,
    dataObjects: ["MAT_LOTS", "MAT_STOCKS", "STOCK_TRANSACTIONS"],
    routes: [
      { label: "LOT조회", path: "/material/lot" },
      { label: "LOT분할", path: "/material/lot-split" },
      { label: "LOT병합", path: "/material/lot-merge" },
      { label: "자재보류", path: "/material/hold" },
    ],
    inputs: ["입고 LOT", "재고상태"],
    outputs: ["가용 LOT", "분할/병합 LOT"],
  },
  {
    id: "material-request",
    lane: "material-iqc",
    activity: "자재 출고 요청",
    summary: "생산에 필요한 자재를 창고에서 공정으로 요청합니다.",
    detail: "작업지시나 현장 요청을 기준으로 출고할 품목과 수량을 요청하고 승인 흐름을 거칩니다.",
    x: 1300,
    dataObjects: ["MAT_ISSUE_REQUESTS", "MAT_ISSUE_REQUEST_ITEMS"],
    routes: [
      { label: "출고요청", path: "/material/request" },
      { label: "기타출고", path: "/material/issue-other" },
    ],
    inputs: ["작업지시", "품목", "소요량"],
    outputs: ["출고요청", "승인 대상"],
  },
  {
    id: "material-issue",
    lane: "material-iqc",
    activity: "자재 출고",
    summary: "승인된 요청 또는 스캔으로 자재를 생산 공정에 투입합니다.",
    detail: "출고는 자재 재고를 차감하고 공정 투입 이력을 남깁니다. 잘못된 품목 스캔은 출고 전에 차단되어야 합니다.",
    x: 1560,
    dataObjects: ["MAT_ISSUES", "MAT_STOCKS", "STOCK_TRANSACTIONS"],
    routes: [
      { label: "자재출고", path: "/material/issue" },
      { label: "수불조회", path: "/inventory/transaction" },
    ],
    inputs: ["출고요청", "MAT UID"],
    outputs: ["자재출고 이력", "공정 투입 자재"],
  },
  {
    id: "spec-setup",
    lane: "production",
    activity: "도면/회로 사양",
    summary: "하네스 제품의 도면, Revision, 회로별 제조 조건을 관리합니다.",
    detail: "전선 길이, stripping, 회로, BOM 자재 연결 같은 제품 제조 기준이 여기서 정리됩니다. 생산과 키팅은 이 기준을 참조합니다.",
    x: 0,
    dataObjects: ["HARNESS_DRAWING_MASTERS", "HARNESS_DRAWING_REVISIONS", "HARNESS_CIRCUIT_SPECS"],
    routes: [
      { label: "제품 도면관리", path: "/production/specification-setup" },
      { label: "라우팅", path: "/master/routing" },
      { label: "BOM", path: "/master/bom" },
    ],
    inputs: ["품목", "BOM", "라우팅"],
    outputs: ["도면 Revision", "회로 사양"],
  },
  {
    id: "production-plan",
    lane: "production",
    activity: "생산계획",
    summary: "수요와 CAPA를 기준으로 생산할 품목과 수량을 계획합니다.",
    detail: "월간 생산계획과 시뮬레이션은 작업지시 발행 전에 수량, 우선순위, 납기, CAPA를 확인하는 단계입니다.",
    x: 260,
    dataObjects: ["PROD_PLANS", "SIMULATION_HEADERS"],
    routes: [
      { label: "월간생산계획", path: "/production/monthly-plan" },
      { label: "시뮬레이션", path: "/production/simulation" },
    ],
    inputs: ["수주", "품목", "CAPA", "월력"],
    outputs: ["생산계획", "작업지시 발행 기준"],
  },
  {
    id: "job-order",
    lane: "production",
    activity: "작업지시",
    summary: "현장에 실행할 생산 작업을 지시합니다.",
    detail: "작업지시는 생산의 중심 데이터입니다. 라우팅, BOM, 설비, 계획일, 수량을 묶고 키오스크와 실적의 기준이 됩니다.",
    x: 520,
    dataObjects: ["JOB_ORDERS", "ROUTING_GROUPS", "BOM_MASTERS"],
    routes: [
      { label: "작업지시", path: "/production/order" },
      { label: "생산진도", path: "/production/progress" },
    ],
    inputs: ["생산계획", "품목", "라우팅", "BOM"],
    outputs: ["작업지시", "공정 실행 기준"],
  },
  {
    id: "input-kiosk-start",
    lane: "production",
    activity: "조립실적(키오스크)",
    summary: "작업지시를 현장에서 스캔해 실제 생산을 시작합니다.",
    detail: "키오스크는 현장 작업자가 작업지시, 설비, 작업자, SG/자재 바코드를 스캔해 생산을 시작하는 핵심 진입점입니다. 업무를 모르는 사용자는 이 노드에서 생산 실행이 실제로 시작된다고 이해하면 됩니다.",
    x: 780,
    dataObjects: ["JOB_ORDERS", "PROD_RESULTS", "SG_LABELS", "MAT_ISSUES"],
    routes: [
      { label: "입력키오스크", path: "/production/input-kiosk" },
      { label: "조립투입", path: "/production/input-assembly" },
      { label: "생산진도", path: "/production/progress" },
    ],
    inputs: ["작업지시", "작업자", "설비", "SG/자재 바코드"],
    outputs: ["생산 시작", "스캔 실적", "공정 진행 상태"],
  },
  {
    id: "subprocess-kitting",
    lane: "production",
    activity: "서브공정 키팅",
    summary: "이전 공정 SG를 소비하고 회로별 새 SG를 발행합니다.",
    detail: "서브공정은 단순 생산실적이 아니라 SG 계보를 잇는 흐름입니다. 이전 SG를 투입하고 새 SG 라벨을 발행해 다음 조립 단계로 넘깁니다.",
    x: 1040,
    dataObjects: ["SG_LABELS", "SG_GENEALOGY", "HARNESS_CIRCUIT_SPECS"],
    routes: [
      { label: "서브공정 키팅", path: "/production/subprocess-kitting" },
      { label: "입력키오스크", path: "/production/input-kiosk" },
    ],
    inputs: ["작업지시", "이전 SG", "회로 사양"],
    outputs: ["신규 SG", "SG 계보"],
  },
  {
    id: "assembly-input",
    lane: "production",
    activity: "조립/라벨 실적",
    summary: "SG와 자재를 투입해 완제품 또는 다음 공정 실적을 등록합니다.",
    detail: "키오스크에서 시작된 스캔 작업은 조립투입, SG/FG 라벨 발행, 자재 투입 이력으로 이어집니다. 이 단계는 현장 시작 이후 실제 산출물을 남기는 실행 기록입니다.",
    x: 1300,
    dataObjects: ["PROD_RESULTS", "SG_LABELS", "FG_LABELS"],
    routes: [
      { label: "조립투입", path: "/production/input-assembly" },
      { label: "입력키오스크", path: "/production/input-kiosk" },
      { label: "생산실적", path: "/production/result" },
    ],
    inputs: ["작업지시", "SG", "자재투입"],
    outputs: ["생산실적", "FG/SG 라벨"],
  },
  {
    id: "production-result",
    lane: "production",
    activity: "생산 실적 집계",
    summary: "작업지시별 양품, 불량, 진행률을 집계합니다.",
    detail: "생산 결과는 품질검사, 제품재고, 출하 가능 여부와 연결됩니다. 작업지시 완료도 이 실적을 기준으로 판단됩니다.",
    x: 1560,
    dataObjects: ["PROD_RESULTS", "JOB_ORDERS", "PRODUCT_STOCKS"],
    routes: [
      { label: "생산실적", path: "/production/result" },
      { label: "실적집계", path: "/production/result-summary" },
      { label: "WIP재고", path: "/production/wip-stock" },
    ],
    inputs: ["작업지시", "현장 실적"],
    outputs: ["양품수량", "불량수량", "WIP/제품재고 후보"],
  },
  {
    id: "process-inspection",
    lane: "quality",
    activity: "공정검사",
    summary: "생산 중 또는 생산 후 품질 항목을 검사합니다.",
    detail: "검사 결과는 제품 통과 여부, 불량 등록, 추적성 근거가 됩니다. 검사 화면은 공정별 검사 구조와 결과 이력을 제공합니다.",
    x: 780,
    dataObjects: ["INSPECT_RESULTS", "SAMPLE_INSPECT_RESULTS", "QC_RESULTS"],
    routes: [
      { label: "검사관리", path: "/quality/inspect" },
      { label: "검사결과", path: "/inspection/result" },
      { label: "샘플검사", path: "/production/sample-inspect" },
    ],
    inputs: ["생산실적", "검사항목"],
    outputs: ["검사결과", "합격/불합격"],
  },
  {
    id: "defect-rework",
    lane: "quality",
    activity: "불량/재작업",
    summary: "불량을 등록하고 재작업 또는 수리 흐름으로 연결합니다.",
    detail: "불량코드와 등급은 품질 판단의 기준입니다. 불량 발생 후 재작업, 수리, 재검사로 다시 합격 여부를 확인합니다.",
    x: 1040,
    dataObjects: ["DEFECT_LOGS", "REWORK_ORDERS", "REPAIR_ORDERS"],
    routes: [
      { label: "불량관리", path: "/quality/defect" },
      { label: "재작업", path: "/quality/rework" },
      { label: "재작업검사", path: "/quality/rework-inspect" },
      { label: "수리", path: "/production/repair" },
    ],
    inputs: ["검사 FAIL", "불량코드"],
    outputs: ["불량이력", "재작업지시", "수리이력"],
  },
  {
    id: "product-receive",
    lane: "shipping",
    activity: "제품 입고",
    summary: "생산 완료 제품을 제품재고로 확정합니다.",
    detail: "생산 실적과 검사 통과 제품이 출하 가능한 제품재고로 전환됩니다. 제품 입고 이후 포장과 출하 대상이 됩니다.",
    x: 1300,
    dataObjects: ["PRODUCT_STOCKS", "PRODUCT_TRANSACTIONS", "FG_LABELS"],
    routes: [
      { label: "제품입고", path: "/product/receive" },
      { label: "제품재고", path: "/inventory/stock" },
      { label: "제품입고취소", path: "/product/receipt-cancel" },
    ],
    inputs: ["생산실적", "FG 라벨"],
    outputs: ["제품재고", "제품수불"],
  },
  {
    id: "packing",
    lane: "shipping",
    activity: "포장",
    summary: "검사 합격 FG 시리얼을 박스에 담고 박스를 마감합니다.",
    detail: "포장은 출하의 물류 단위를 만듭니다. 박스 마감 이후 OQC 요청과 팔레트 적재 흐름으로 넘어갑니다.",
    x: 1560,
    dataObjects: ["BOX_MASTERS", "FG_LABELS", "OQC_REQUESTS"],
    routes: [
      { label: "포장", path: "/shipping/pack" },
      { label: "포장실적", path: "/production/pack-result" },
      { label: "박스입고재고", path: "/shipping/box-stock" },
    ],
    inputs: ["FG 라벨", "제품재고"],
    outputs: ["박스", "포장실적", "OQC 요청"],
  },
  {
    id: "oqc",
    lane: "quality",
    activity: "OQC",
    summary: "출하 전 박스 또는 제품 단위 최종 검사를 수행합니다.",
    detail: "OQC는 고객 출하 전 품질 게이트입니다. PASS 박스만 팔레트/출하로 이어지는 정책을 둘 수 있습니다.",
    x: 1560,
    dataObjects: ["OQC_REQUESTS", "OQC_RESULTS", "BOX_MASTERS"],
    routes: [
      { label: "OQC검사", path: "/quality/oqc" },
      { label: "OQC이력", path: "/quality/oqc-history" },
    ],
    inputs: ["마감 박스", "검사항목"],
    outputs: ["OQC PASS/FAIL", "출하 가능 박스"],
  },
  {
    id: "palletize",
    lane: "shipping",
    activity: "팔레트 구성",
    summary: "출하 가능한 박스를 팔레트에 적재하고 마감합니다.",
    detail: "팔레트는 박스 여러 개를 묶는 출하 단위입니다. 출하지시와 연결된 팔레트만 실제 출하 흐름으로 넘어갑니다.",
    x: 2080,
    dataObjects: ["PALLET_MASTERS", "PALLET_BOXES", "BOX_MASTERS"],
    routes: [
      { label: "팔레트관리", path: "/shipping/pallet" },
      { label: "팔레트출하", path: "/shipping/pallet-ship" },
    ],
    inputs: ["OQC PASS 박스", "출하지시"],
    outputs: ["팔레트", "박스 적재 관계"],
  },
  {
    id: "shipping-order",
    lane: "shipping",
    activity: "출하지시",
    summary: "고객에게 출하할 품목과 수량을 확정합니다.",
    detail: "출하지시는 고객 납품의 기준입니다. 확정된 지시를 기준으로 박스 또는 팔레트 출하를 수행합니다.",
    x: 1820,
    dataObjects: ["SHIPMENT_ORDERS", "SHIPMENT_ORDER_ITEMS"],
    routes: [
      { label: "출하지시", path: "/shipping/order" },
      { label: "고객PO", path: "/sales/customer-po" },
    ],
    inputs: ["고객주문", "품목", "출하수량"],
    outputs: ["확정 출하지시", "출하잔량"],
  },
  {
    id: "shipping-confirm",
    lane: "shipping",
    activity: "출하확정",
    summary: "박스 또는 팔레트를 실제 출하 처리하고 재고를 차감합니다.",
    detail: "출하확정은 제품재고 차감, 박스/팔레트 상태 전환, 출하지시 출하수량 갱신을 한 흐름으로 묶습니다.",
    x: 2340,
    dataObjects: ["SHIPMENT_LOGS", "PRODUCT_TRANSACTIONS", "BOX_MASTERS", "PALLET_MASTERS"],
    routes: [
      { label: "출하확정", path: "/shipping/confirm" },
      { label: "출하이력", path: "/shipping/history" },
    ],
    inputs: ["확정 출하지시", "박스/팔레트"],
    outputs: ["출하이력", "제품재고 차감", "출하상태"],
  },
  {
    id: "shipping-history",
    lane: "shipping",
    activity: "출하이력 확인",
    summary: "출하지시와 출하 완료 결과를 조회합니다.",
    detail: "출하 이후 고객, 품목, 팔레트, 박스 단위 이력을 확인하고 필요 시 출하취소 또는 추적성 조회로 연결합니다.",
    x: 2600,
    dataObjects: ["SHIPMENT_ORDERS", "SHIPMENT_LOGS", "PALLET_MASTERS"],
    routes: [
      { label: "출하이력", path: "/shipping/history" },
      { label: "출하취소", path: "/shipping/return" },
    ],
    inputs: ["출하확정 결과"],
    outputs: ["출하 조회 기준", "취소 검토 대상"],
  },
  {
    id: "traceability",
    lane: "trace-reversal",
    activity: "추적성 조회",
    summary: "제품 시리얼에서 SG, 자재, PO, IQC, 출하까지 역추적합니다.",
    detail: "추적성은 문제 발생 시 어느 자재와 검사, 생산, 출하가 연결되어 있는지 찾는 화면입니다. 업무 이해 관점에서는 모든 도메인의 연결 결과를 보여줍니다.",
    x: 2080,
    dataObjects: ["FG_LABELS", "SG_LABELS", "MAT_LOTS", "IQC_LOGS", "SHIPMENT_LOGS"],
    routes: [
      { label: "추적성", path: "/quality/trace" },
      { label: "LOT조회", path: "/material/lot" },
    ],
    inputs: ["FG 바코드", "SG 라벨", "MAT UID", "박스/팔레트"],
    outputs: ["제품-공정-자재-출하 연결"],
  },
  {
    id: "material-reversal",
    lane: "trace-reversal",
    activity: "입하/입고 취소",
    summary: "뒤 공정이 없을 때만 입하 또는 입고를 역처리합니다.",
    detail: "취소는 단순 삭제가 아니라 수불과 상태를 되돌리는 보정 거래입니다. 이미 출고나 생산이 진행된 자재는 먼저 후속 흐름을 정리해야 합니다.",
    x: 780,
    dataObjects: ["STOCK_TRANSACTIONS", "MAT_STOCKS", "MAT_ARRIVALS"],
    routes: [
      { label: "입하실적조회", path: "/material/arrival-result" },
      { label: "입고취소", path: "/material/receipt-cancel" },
    ],
    inputs: ["입하/입고 이력", "뒤 공정 없음"],
    outputs: ["취소 수불", "재고 원복"],
  },
  {
    id: "shipping-reversal",
    lane: "trace-reversal",
    activity: "출하취소",
    summary: "출하 완료 후 조건에 맞는 건을 보상 거래로 되돌립니다.",
    detail: "출하취소는 제품재고, 박스, 팔레트, 출하지시 수량을 함께 되돌려야 합니다. ERP 동기화나 후속 처리 여부가 취소 가능 조건이 됩니다.",
    x: 2600,
    dataObjects: ["SHIPMENT_RETURNS", "PRODUCT_TRANSACTIONS", "BOX_MASTERS", "SHIPMENT_ORDERS"],
    routes: [
      { label: "출하취소", path: "/shipping/return" },
      { label: "출하이력", path: "/shipping/history" },
    ],
    inputs: ["출하이력", "취소 사유"],
    outputs: ["취소이력", "제품재고 원복", "출하지시 수량 복원"],
  },
];

export const workflowEdges: WorkflowBusinessEdge[] = [
  { id: "e-po-arrival", source: "purchase-order", target: "arrival-register", label: "PO 잔량 기준 입하", kind: "normal" },
  { id: "e-arrival-review", source: "arrival-register", target: "arrival-review", label: "입하번호/시리얼 확인", kind: "normal" },
  { id: "e-arrival-iqc", source: "arrival-review", target: "iqc-inspection", label: "검사 대상", kind: "normal" },
  { id: "e-policy-iqc", source: "iqc-policy", target: "iqc-inspection", label: "검사 기준", kind: "reference" },
  { id: "e-iqc-label", source: "iqc-inspection", target: "material-label", label: "PASS", kind: "branch" },
  { id: "e-label-receive", source: "material-label", target: "material-receive", label: "MAT UID 입고", kind: "normal" },
  { id: "e-receive-lot", source: "material-receive", target: "lot-control", label: "가용 LOT", kind: "normal" },
  { id: "e-lot-request", source: "lot-control", target: "material-request", label: "출고 가능 재고", kind: "normal" },
  { id: "e-request-issue", source: "material-request", target: "material-issue", label: "승인/스캔", kind: "normal" },
  { id: "e-spec-plan", source: "spec-setup", target: "production-plan", label: "제조 기준", kind: "reference" },
  { id: "e-plan-order", source: "production-plan", target: "job-order", label: "작업지시 발행", kind: "normal" },
  { id: "e-issue-order", source: "material-issue", target: "job-order", label: "투입 자재 준비", kind: "reference" },
  { id: "e-order-kiosk", source: "job-order", target: "input-kiosk-start", label: "현장 시작", kind: "normal" },
  { id: "e-kiosk-subkit", source: "input-kiosk-start", target: "subprocess-kitting", label: "서브공정 시작", kind: "branch" },
  { id: "e-kiosk-assembly", source: "input-kiosk-start", target: "assembly-input", label: "조립 시작", kind: "branch" },
  { id: "e-subkit-assembly", source: "subprocess-kitting", target: "assembly-input", label: "SG 계보", kind: "normal" },
  { id: "e-assembly-result", source: "assembly-input", target: "production-result", label: "실적 등록", kind: "normal" },
  { id: "e-result-inspect", source: "production-result", target: "process-inspection", label: "검사 대상", kind: "normal" },
  { id: "e-inspect-defect", source: "process-inspection", target: "defect-rework", label: "FAIL/불량", kind: "branch" },
  { id: "e-inspect-product", source: "process-inspection", target: "product-receive", label: "PASS", kind: "branch" },
  { id: "e-result-product", source: "production-result", target: "product-receive", label: "완료 실적", kind: "normal" },
  { id: "e-product-packing", source: "product-receive", target: "packing", label: "FG 재고", kind: "normal" },
  { id: "e-packing-oqc", source: "packing", target: "oqc", label: "출하 전 검사", kind: "normal" },
  { id: "e-oqc-pallet", source: "oqc", target: "palletize", label: "PASS 박스", kind: "branch" },
  { id: "e-order-pallet", source: "shipping-order", target: "palletize", label: "출하지시 연결", kind: "reference" },
  { id: "e-pallet-confirm", source: "palletize", target: "shipping-confirm", label: "출하 단위", kind: "normal" },
  { id: "e-order-confirm", source: "shipping-order", target: "shipping-confirm", label: "확정 지시", kind: "normal" },
  { id: "e-confirm-history", source: "shipping-confirm", target: "shipping-history", label: "출하 완료", kind: "normal" },
  { id: "e-history-trace", source: "shipping-history", target: "traceability", label: "출하 기준 역추적", kind: "reference" },
  { id: "e-result-trace", source: "production-result", target: "traceability", label: "제품/공정 계보", kind: "reference" },
  { id: "e-lot-trace", source: "lot-control", target: "traceability", label: "자재 LOT 계보", kind: "reference" },
  { id: "e-arrival-reversal", source: "arrival-review", target: "material-reversal", label: "뒤 공정 없음", kind: "reversal" },
  { id: "e-receive-reversal", source: "material-receive", target: "material-reversal", label: "입고 취소", kind: "reversal" },
  { id: "e-history-reversal", source: "shipping-history", target: "shipping-reversal", label: "취소 검토", kind: "reversal" },
];

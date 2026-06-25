export type WorkflowLaneId =
  | "purchase-arrival"
  | "material-iqc"
  | "production"
  | "quality"
  | "shipping"
  | "trace"
  | "reversal"
  | "quality-system"
  | "consumables"
  | "pda";

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
  /** 가이드: 이 업무를 왜 하는가 (1~2문장) */
  why?: string;
  /** 가이드: 선행조건 / 언제 수행하나 */
  when?: string;
  /** 가이드: 자주 하는 실수 · 주의점 */
  cautions?: string[];
  /** 좌측 목록 진행번호 (레인 내 순서). 미지정 시 x 좌표 순서 */
  order?: number;
  /** help md 연결 override. 미지정 시 routes에서 메뉴코드 자동 도출 */
  helpRefs?: { menuCode: string; audience: "user" | "operator" }[];
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
    id: "trace",
    title: "추적성",
    description: "제품 시리얼에서 SG, 자재, PO, IQC, 출하까지 계보를 역추적하는 조회 흐름입니다.",
    color: "#475569",
    y: 1100,
  },
  {
    id: "reversal",
    title: "역처리",
    description: "입하/입고 취소, 출하취소처럼 이미 처리된 거래를 조건에 맞춰 되돌리는 보정 흐름입니다.",
    color: "#57534e",
    y: 1320,
  },
  {
    id: "quality-system",
    title: "품질관리(IATF)",
    description: "관리계획서, 4M변경, SPC, 클레임/CAPA처럼 양산을 둘러싼 품질시스템을 관리합니다.",
    color: "#15803d",
    y: 1540,
  },
  {
    id: "consumables",
    title: "소모품관리",
    description: "금형·지그·공구를 기준정보로 등록하고 입출고, 설비 장착, 수명까지 관리합니다.",
    color: "#4f46e5",
    y: 1760,
  },
  {
    id: "pda",
    title: "PDA(현장 단말)",
    description: "PC 화면과 동일한 입고·불출·출하·점검 업무를 현장 PDA 스캔으로도 처리합니다.",
    color: "#db2777",
    y: 1980,
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
    order: 1,
    why: "입하의 출처가 되는 구매 근거를 만들어 어떤 품목을 얼마나 받을지 사전에 확정한다.",
    when: "거래처에 자재를 발주할 때. 입하 등록보다 먼저 수행한다.",
    cautions: [
      "품목·수량·납기·거래처를 정확히 입력해야 입하 잔량 계산이 맞는다.",
      "발주 없이 입하하면 잔량 추적이 끊긴다.",
    ],
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
    order: 2,
    why: "현장에 실제 도착한 자재를 시스템 재고 흐름으로 진입시키고 입하번호를 만든다.",
    when: "공장에 자재가 물리적으로 도착했을 때.",
    cautions: [
      "PO 잔량을 초과해 입하하지 않는다.",
      "제조사·창고를 잘못 고르면 이후 추적과 입고가 어긋난다.",
    ],
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
    order: 3,
    why: "입하 건의 시리얼·제조사·후속 진행 여부를 확인하고 잘못된 입하를 취소할 근거를 본다.",
    when: "입하 등록 직후 또는 IQC·입고 진행 상태를 점검할 때.",
    cautions: [
      "뒤 공정(IQC·라벨·입고)이 시작된 입하는 취소할 수 없다.",
    ],
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
    order: 1,
    why: "품목이 어떤 항목·AQL 기준으로 검사될지 사전에 정해 IQC 판정의 기준을 만든다.",
    when: "신규 품목 도입 시 또는 검사 기준 변경 시. IQC 판정보다 먼저.",
    cautions: [
      "기준이 없으면 샘플수·Ac/Re를 계산할 수 없어 IQC가 막힌다.",
    ],
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
      { label: "특채처리", path: "/material/concession" },
    ],
    inputs: ["입하번호", "품목", "검사항목", "시료"],
    outputs: ["IQC 이력", "PASS/FAIL", "불량코드"],
    order: 2,
    why: "입하 자재가 생산에 투입 가능한 품질인지 PASS/FAIL로 확정한다.",
    when: "입하 등록 후, 라벨 발행·입고 전.",
    cautions: [
      "FAIL은 라벨·입고로 넘기지 말고 불용·재검토로 분기한다.",
      "입하번호·품목 단위로 판정해야 한다.",
    ],
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
    order: 3,
    why: "외부 입하 정보를 현장에서 스캔 가능한 내부 시리얼(MAT UID)로 전환한다.",
    when: "IQC PASS 직후.",
    cautions: [
      "자동입고 설정이 있으면 라벨 발행이 입고까지 이어지니 중복 입고에 주의한다.",
    ],
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
    order: 4,
    why: "라벨 발행된 자재를 실제 사용 가능한 창고 재고로 확정한다.",
    when: "라벨 발행 후, 출고·공정투입 전.",
    cautions: [
      "입고해야 출고요청·공정투입·LOT 분할/병합이 가능하다.",
    ],
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
    order: 5,
    why: "입고 LOT을 조회하고 분할·병합·보류·폐기로 재고 단위를 재구성한다.",
    when: "생산 투입 단위 조정이나 보류가 필요할 때.",
    cautions: [
      "분할·병합은 원본 LOT을 폐기하고 새 LOT을 발행하는 재가공이다.",
    ],
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
    order: 6,
    why: "생산에 필요한 자재를 창고에서 공정으로 요청한다.",
    when: "작업지시 실행 전 자재가 필요할 때.",
    cautions: [
      "요청 수량은 작업지시 소요량 기준으로 잡는다.",
    ],
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
    order: 7,
    why: "승인된 요청 또는 스캔으로 자재를 생산 공정에 실제 투입하고 재고를 차감한다.",
    when: "출고요청 승인 후 또는 현장 스캔 시점.",
    cautions: [
      "잘못된 품목 스캔은 출고 전에 차단되어야 한다.",
    ],
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
    order: 1,
    why: "도면·Revision·회로별 제조 조건 등 제품 제조 기준을 정리한다.",
    when: "신제품·설계 변경 시. 생산계획·키팅보다 먼저.",
    cautions: [
      "Revision 관리를 놓치면 잘못된 도면으로 생산된다.",
    ],
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
    order: 2,
    why: "수요와 CAPA를 기준으로 생산 품목·수량·우선순위를 계획한다.",
    when: "작업지시 발행 전.",
    cautions: [
      "CAPA를 넘는 계획은 납기 지연으로 이어진다.",
    ],
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
    order: 3,
    why: "현장에 실행할 생산 작업을 라우팅·BOM·설비·수량과 묶어 지시한다.",
    when: "생산계획 확정 후.",
    cautions: [
      "작업지시가 키오스크·실적의 기준이라 잘못 묶이면 현장이 멈춘다.",
    ],
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
    order: 4,
    why: "작업지시를 현장에서 스캔해 실제 생산 실행을 시작하는 진입점이다.",
    when: "작업지시가 현장에 내려온 뒤 작업 시작 시.",
    cautions: [
      "작업자·설비·바코드 스캔이 맞아야 실적이 올바르게 집계된다.",
    ],
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
    order: 5,
    why: "이전 공정 SG를 소비하고 회로별 새 SG를 발행해 SG 계보를 잇는다.",
    when: "서브공정(키팅) 단계에서.",
    cautions: [
      "단순 실적이 아니라 SG 계보를 잇는 흐름이라, 이전 SG 투입을 빠뜨리면 추적이 끊긴다.",
    ],
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
    order: 6,
    why: "SG·자재를 투입해 완제품 또는 다음 공정 실적과 FG/SG 라벨을 남긴다.",
    when: "키오스크 시작 이후 실제 조립 시점.",
    cautions: [
      "자재 투입 이력이 빠지면 BOM 소요와 재고가 어긋난다.",
    ],
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
    order: 7,
    why: "작업지시별 양품·불량·진행률을 집계해 완료·제품재고·출하 가능 여부의 기준을 만든다.",
    when: "조립·실적 등록 후.",
    cautions: [
      "작업지시 완료가 이 실적을 기준으로 판단된다.",
    ],
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
      { label: "통합검사", path: "/inspection/integrated" },
      { label: "검사결과", path: "/inspection/result" },
      { label: "단자검사결과", path: "/inspection/terminal-result" },
      { label: "검사이력", path: "/inspection/history" },
      { label: "샘플검사", path: "/production/sample-inspect" },
      { label: "의뢰검사", path: "/quality/request-inspect" },
      { label: "자주검사이력", path: "/quality/self-inspect-history" },
    ],
    inputs: ["생산실적", "검사항목"],
    outputs: ["검사결과", "합격/불합격"],
    order: 1,
    why: "생산 중·후 품질 항목을 검사해 제품 통과 여부와 추적 근거를 만든다.",
    when: "생산 실적 등록 후.",
    cautions: [
      "FAIL은 불량·재작업으로, PASS는 제품 입고로 분기된다.",
    ],
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
    order: 2,
    why: "불량을 등록하고 재작업·수리·재검사로 다시 합격 여부를 확인한다.",
    when: "검사 FAIL 발생 시.",
    cautions: [
      "불량코드·등급을 정확히 남겨야 품질 분석이 가능하다.",
    ],
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
    order: 1,
    why: "생산 완료·검사 통과 제품을 출하 가능한 제품재고로 확정한다.",
    when: "생산 실적·공정검사 PASS 후.",
    cautions: [
      "제품 입고가 돼야 포장·출하 대상이 된다.",
    ],
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
    order: 2,
    why: "검사 합격 FG 시리얼을 박스에 담아 출하 물류 단위를 만든다.",
    when: "제품 입고 후.",
    cautions: [
      "박스 마감 이후 OQC 요청과 팔레트 적재로 넘어간다.",
    ],
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
    order: 3,
    why: "출하 전 박스·제품 단위 최종 품질 게이트를 통과시킨다.",
    when: "포장 마감 후, 팔레트·출하 전.",
    cautions: [
      "PASS 박스만 팔레트·출하로 넘기는 정책을 둘 수 있다.",
    ],
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
    order: 3,
    why: "출하 가능한 박스를 팔레트로 묶어 출하 단위를 구성한다.",
    when: "OQC PASS 후, 출하확정 전.",
    cautions: [
      "출하지시와 연결된 팔레트만 실제 출하로 넘어간다.",
    ],
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
    order: 4,
    why: "고객에게 출하할 품목·수량을 확정한다.",
    when: "고객 주문 확정 시.",
    cautions: [
      "확정 지시 기준으로 박스·팔레트 출하가 수행된다.",
    ],
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
    order: 5,
    why: "박스·팔레트를 실제 출하 처리하고 제품재고를 차감한다.",
    when: "출하지시 확정·출하 단위 준비 후.",
    cautions: [
      "재고 차감·상태 전환·출하수량 갱신이 한 흐름으로 묶인다.",
    ],
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
    order: 6,
    why: "출하지시와 출하 완료 결과를 조회하고 취소·추적으로 연결한다.",
    when: "출하확정 후.",
    cautions: [
      "취소·추적성 조회의 진입점이다.",
    ],
  },
  {
    id: "traceability",
    lane: "trace",
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
    lane: "reversal",
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
    lane: "reversal",
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
  {
    id: "quality-planning",
    lane: "quality-system",
    activity: "사전품질 승인",
    summary: "양산 전 관리계획서·초물검사·PPAP로 품질 기준을 확정합니다.",
    detail: "신규 또는 변경 품목이 양산에 들어가기 전 공정별 검사방법과 빈도를 정의(관리계획서)하고, 첫 생산품을 검증(FAI)하며, 고객 승인용 PPAP를 제출합니다. 이후 공정검사와 출하 품질의 기준이 됩니다.",
    x: 780,
    dataObjects: ["CONTROL_PLANS", "FAI_REQUESTS", "PPAP_SUBMISSIONS"],
    routes: [
      { label: "관리계획서", path: "/quality/control-plan" },
      { label: "초물검사(FAI)", path: "/quality/fai" },
      { label: "PPAP", path: "/quality/ppap" },
    ],
    inputs: ["신규/변경 품목", "도면/사양", "고객 요구"],
    outputs: ["관리계획서", "FAI 판정", "PPAP 승인"],
    order: 1,
    why: "양산 전에 검사방법·초물·고객승인 기준을 확정해 품질 리스크를 사전에 통제한다(IATF 8.5.1).",
    when: "신규 품목 도입 또는 설계·공정 변경 시, 양산 시작 전.",
    cautions: [
      "관리계획서 없이 양산하면 공정검사 기준이 불명확해진다.",
      "FAI/PPAP 미승인 상태로 고객 출하하면 클레임 위험이 크다.",
    ],
  },
  {
    id: "quality-change",
    lane: "quality-system",
    activity: "4M 변경관리",
    summary: "인원·설비·자재·방법 변경점을 등록·검토·승인합니다.",
    detail: "4M(Man/Machine/Material/Method) 변경이 발생하면 변경점을 등록하고 영향 검토·승인 흐름을 거쳐 미검증 변경이 양산에 유입되는 것을 통제합니다(IATF 8.5.6).",
    x: 1300,
    dataObjects: ["CHANGE_ORDERS"],
    routes: [
      { label: "4M변경관리", path: "/quality/change-control" },
    ],
    inputs: ["변경 요청", "영향 범위"],
    outputs: ["변경 승인", "변경 이력"],
    order: 2,
    why: "변경점이 품질에 미치는 영향을 사전에 검토·승인해 추적 불가 불량의 원인을 차단한다.",
    when: "설비 교체, 자재 변경, 작업방법 변경 등 4M 변경 발생 시.",
    cautions: [
      "승인 전 변경 적용은 추적 불가 불량의 원인이 된다.",
    ],
  },
  {
    id: "quality-spc",
    lane: "quality-system",
    activity: "SPC·계측기",
    summary: "공정 데이터를 관리도로 모니터링하고 계측기 교정을 관리합니다.",
    detail: "X̄-R 관리도로 공정 산포를 모니터링하고 Cpk를 산출하며, 측정 신뢰성을 위해 계측기 교정 주기와 결과를 관리합니다. 공정검사 데이터가 SPC의 입력이 됩니다.",
    x: 1820,
    dataObjects: ["SPC_CHARTS", "SPC_DATA", "CALIBRATION_LOGS"],
    routes: [
      { label: "SPC", path: "/quality/spc" },
      { label: "계측기 교정", path: "/quality/msa" },
    ],
    inputs: ["공정 측정값", "계측기"],
    outputs: ["관리도/Cpk", "교정 상태"],
    order: 3,
    why: "공정 산포를 통계로 감시하고 계측기를 교정해 측정·판정의 신뢰성을 확보한다.",
    when: "양산 중 공정 데이터 축적 시 주기적으로, 계측기 교정 주기 도래 시.",
    cautions: [
      "교정 만료 계측기로 측정한 검사결과는 신뢰할 수 없다.",
    ],
  },
  {
    id: "quality-capa",
    lane: "quality-system",
    activity: "클레임·CAPA·심사",
    summary: "고객 클레임과 부적합에 시정·예방조치를 실행하고 내부심사로 점검합니다.",
    detail: "고객 클레임을 접수·조사·대응하고, 부적합에 시정조치·예방조치(CAPA)를 등록·추적하며, 내부심사로 품질시스템을 주기적으로 점검합니다(IATF 10.2).",
    x: 2340,
    dataObjects: ["CUSTOMER_COMPLAINTS", "CAPA_REQUESTS", "AUDIT_PLANS"],
    routes: [
      { label: "고객클레임", path: "/quality/complaint" },
      { label: "CAPA", path: "/quality/capa" },
      { label: "내부심사", path: "/quality/audit" },
    ],
    inputs: ["고객 클레임", "부적합 발견"],
    outputs: ["시정/예방조치", "심사 결과"],
    order: 4,
    why: "발생한 품질 문제에 근본원인 기반 시정·예방조치를 실행해 재발을 막고 시스템을 개선한다.",
    when: "고객 클레임 접수 시, 중대 부적합 발생 시, 정기 내부심사 주기.",
    cautions: [
      "근본원인 분석 없는 임시조치는 동일 불량의 재발로 이어진다.",
    ],
  },
  {
    id: "cons-master",
    lane: "consumables",
    activity: "소모품 기준/라벨",
    summary: "금형·지그·공구를 마스터로 등록하고 conUid 라벨을 발행합니다.",
    detail: "소모품 기준정보(카테고리·예상수명·단위)를 등록하고, 개별 인스턴스마다 conUid를 채번해 바코드 라벨을 인쇄함으로써 현장 추적 단위를 만듭니다.",
    x: 0,
    dataObjects: ["CONSUMABLE_MASTERS", "CONSUMABLE_STOCKS"],
    routes: [
      { label: "소모품마스터", path: "/consumables/master" },
      { label: "소모품라벨", path: "/consumables/label" },
    ],
    inputs: ["소모품 품목", "카테고리", "예상수명"],
    outputs: ["소모품 마스터", "conUid 라벨"],
    order: 1,
    why: "소모품을 개별 시리얼(conUid) 단위로 추적할 수 있게 기준정보와 라벨을 만든다.",
    when: "신규 소모품(금형/지그/공구) 도입 시.",
    cautions: [
      "예상수명을 잘못 등록하면 수명 알림이 부정확해진다.",
    ],
  },
  {
    id: "cons-stock",
    lane: "consumables",
    activity: "소모품 입출고/재고",
    summary: "conUid 단위로 입고·출고·재고 현황을 관리합니다.",
    detail: "라벨 발행된 소모품을 입고(반납 포함)하고 설비·현장으로 출고하며, conUid 단위 인스턴스 상태와 잔여수명을 재고로 조회합니다.",
    x: 520,
    dataObjects: ["CONSUMABLE_STOCKS", "CONSUMABLE_LOGS"],
    routes: [
      { label: "소모품입고", path: "/consumables/receiving" },
      { label: "소모품출고", path: "/consumables/issuing" },
      { label: "소모품재고", path: "/consumables/stock" },
    ],
    inputs: ["conUid 라벨", "입출고 대상"],
    outputs: ["소모품 재고", "입출고 이력"],
    order: 2,
    why: "소모품을 개별 인스턴스 단위로 입출고·재고 관리해 위치와 상태를 추적한다.",
    when: "소모품 입고/반납, 설비·현장 출고 시.",
    cautions: [
      "출고 대상(설비/현장)을 정확히 지정해야 장착·수명 추적이 이어진다.",
    ],
  },
  {
    id: "cons-mount",
    lane: "consumables",
    activity: "장착·수명관리",
    summary: "소모품을 설비에 장착·분리하고 사용횟수 기반 수명을 모니터링합니다.",
    detail: "소모품을 설비에 장착·분리하고 장착 이력을 남기며, 사용횟수 기반 수명 상태(NORMAL/WARNING/REPLACE)를 모니터링해 교체 주기를 넘기지 않게 합니다. 생산 키오스크의 설비 장착 소모품과 연결됩니다.",
    x: 1040,
    dataObjects: ["CONSUMABLE_MOUNT_LOGS", "CONSUMABLE_STOCKS"],
    routes: [
      { label: "장착/분리", path: "/consumables/mount" },
      { label: "수명현황", path: "/consumables/life" },
    ],
    inputs: ["소모품 conUid", "설비"],
    outputs: ["장착 이력", "수명 상태/교체 알림"],
    order: 3,
    why: "설비에 장착된 소모품의 사용 수명을 추적해 교체 주기를 넘긴 채 생산되는 것을 막는다.",
    when: "소모품을 설비에 장착·교체할 때, 수명 경고 발생 시.",
    cautions: [
      "수명 초과 소모품을 교체하지 않으면 제품 불량의 직접 원인이 된다.",
    ],
  },
  {
    id: "pda-mat-receive",
    lane: "pda",
    activity: "PDA 자재입고",
    summary: "현장 단말로 MAT UID를 스캔해 자재를 창고 재고로 입고합니다.",
    detail: "PDA에서 자재 시리얼(MAT UID)을 스캔해 입고 가능 여부(IQC 합격·특채)를 확인하고 창고를 선택해 입고를 확정합니다. PC 자재입고 화면과 동일한 업무를 현장에서 처리합니다.",
    x: 780,
    dataObjects: ["MAT_STOCKS", "STOCK_TRANSACTIONS", "MAT_RECEIVINGS"],
    routes: [
      { label: "PDA 자재입고", path: "/pda/material/receiving" },
    ],
    inputs: ["MAT UID 바코드", "입고창고"],
    outputs: ["자재재고", "입고 수불"],
    order: 1,
    why: "라벨 발행된 자재를 현장에서 즉시 스캔 입고해 PC 입력 없이 재고를 확정한다.",
    when: "라벨 발행·IQC 합격된 자재가 현장에 도착했을 때.",
    cautions: [
      "IQC 미합격·잔량 없는 시리얼은 입고가 차단된다.",
      "라벨 발행은 PDA가 아닌 PC에서 선행되어야 한다.",
    ],
  },
  {
    id: "pda-mat-issue",
    lane: "pda",
    activity: "PDA 자재불출",
    summary: "작업지시와 자재 LOT을 스캔해 생산 공정으로 불출합니다.",
    detail: "PDA에서 작업지시를 스캔하고 BOM 기준 불출 항목을 확인한 뒤 자재 LOT 시리얼을 스캔해 출고를 확정합니다. PC 자재출고와 동일 엔드포인트를 사용합니다.",
    x: 1560,
    dataObjects: ["MAT_ISSUES", "MAT_STOCKS", "STOCK_TRANSACTIONS"],
    routes: [
      { label: "PDA 자재불출", path: "/pda/material/issuing" },
    ],
    inputs: ["작업지시", "BOM 항목", "MAT UID"],
    outputs: ["자재출고 이력", "공정 투입 자재"],
    order: 2,
    why: "현장에서 작업지시·BOM 기준으로 자재를 스캔 불출해 오투입을 막고 재고를 차감한다.",
    when: "작업지시 실행을 위해 자재를 공정에 투입할 때.",
    cautions: [
      "BOM에 없는 자재 스캔은 차단된다.",
      "PDA 불출은 정식 출고요청 단계를 건너뛴다.",
    ],
  },
  {
    id: "pda-inventory",
    lane: "pda",
    activity: "PDA 재고조정·실사",
    summary: "현장에서 재고를 조정 요청하거나 재고실사 카운트를 수행합니다.",
    detail: "PDA에서 LOT을 스캔해 ±수량 조정을 요청(PC 승인 대기)하거나, PC에서 개시한 재고실사 세션에 대해 위치·바코드를 스캔해 실사 수량을 집계합니다.",
    x: 1040,
    dataObjects: ["MAT_STOCKS", "STOCK_TRANSACTIONS", "PHYSICAL_INV_SESSIONS", "PHYSICAL_INV_COUNT_DETAILS"],
    routes: [
      { label: "PDA 재고조정", path: "/pda/material/adjustment" },
      { label: "PDA 자재실사", path: "/pda/material/inventory-count" },
      { label: "PDA 제품실사", path: "/pda/product/inventory-count" },
    ],
    inputs: ["LOT 바코드", "조정수량/사유", "실사 세션"],
    outputs: ["조정 요청(PENDING)", "실사 카운트"],
    order: 3,
    why: "현장 실물 기준으로 재고 차이를 조정 요청하거나 실사 수량을 집계해 장부 정합성을 맞춘다.",
    when: "재고 불일치 발견 시(조정), PC가 재고실사 세션을 개시했을 때(실사).",
    cautions: [
      "조정은 즉시 반영이 아니라 PC 승인 후 확정된다.",
      "실사는 PC에서 세션을 먼저 열어야 시작할 수 있다.",
    ],
  },
  {
    id: "pda-product-receive",
    lane: "pda",
    activity: "PDA 제품입고",
    summary: "마감된 박스를 스캔해 완제품/반제품을 재고로 입고합니다.",
    detail: "PDA에서 박스 번호(마감 상태)를 스캔하고 창고를 선택해 완제품(FG) 또는 반제품(WIP) 재고로 입고합니다. 세션 내 입고 취소도 가능합니다.",
    x: 1300,
    dataObjects: ["PRODUCT_STOCKS", "PRODUCT_TRANSACTIONS", "FG_LABELS"],
    routes: [
      { label: "PDA 제품입고", path: "/pda/product/receiving" },
    ],
    inputs: ["박스 번호(마감)", "입고창고"],
    outputs: ["제품재고", "제품수불"],
    order: 4,
    why: "포장 마감된 박스를 현장에서 스캔해 즉시 제품재고로 확정한다.",
    when: "박스 마감 후 제품을 창고로 입고할 때.",
    cautions: [
      "마감(CLOSED) 상태 박스만 입고된다.",
    ],
  },
  {
    id: "pda-shipping",
    lane: "pda",
    activity: "PDA 출하",
    summary: "출하지시·작업자·박스를 스캔해 박스 단위로 즉시 출하합니다.",
    detail: "PDA에서 확정(CONFIRMED) 출하지시와 작업자 QR을 스캔한 뒤 제품 박스를 스캔하면 박스 단위로 즉시 출하 처리됩니다. 팔레트 단위 출하는 별도 'PDA 팔레트 출하' 화면에서 처리합니다.",
    x: 2340,
    dataObjects: ["SHIPMENT_LOGS", "PRODUCT_TRANSACTIONS", "BOX_MASTERS"],
    routes: [
      { label: "PDA 출하", path: "/pda/shipping" },
    ],
    inputs: ["출하지시(확정)", "작업자 QR", "박스 번호"],
    outputs: ["출하 처리", "제품재고 차감"],
    order: 5,
    why: "확정 출하지시에 대해 현장에서 박스를 스캔해 즉시 출하 처리한다.",
    when: "출하지시 확정 후 박스를 차량에 상차·출하할 때.",
    cautions: [
      "이 박스 출하 화면에서는 팔레트(PLT) 바코드가 거부된다 — 팔레트 출하는 'PDA 팔레트 출하' 화면 또는 PC 출하확정을 사용한다.",
      "박스는 스캔 즉시 출하되어 일괄 취소가 어렵다.",
    ],
  },
  {
    id: "pda-pallet-build",
    lane: "pda",
    activity: "PDA 팔레트 구성",
    summary: "출하지시를 스캔하고 새 팔레트를 생성해 박스를 스캔 적재한 뒤 마감합니다.",
    detail: "PDA에서 확정(CONFIRMED) 출하지시를 스캔하고 새 팔레트를 생성(또는 이어서)한 뒤 박스를 스캔해 적재하고 마감(CLOSED)까지 수행합니다. 출하는 별도 'PDA 팔레트 출하' 화면에서 처리합니다. PC의 팔레트 적재 화면과 동일한 프로세스를 현장 스캔으로 수행합니다.",
    x: 2600,
    dataObjects: ["PALLET_MASTERS", "PALLET_BOXES", "BOX_MASTERS"],
    routes: [
      { label: "PDA 팔레트 구성", path: "/pda/shipping-pallet" },
    ],
    inputs: ["출하지시(확정)", "박스 번호(마감·OQC합격·미할당)"],
    outputs: ["팔레트 구성", "마감 팔레트"],
    order: 6,
    why: "OQC 합격 박스를 팔레트로 묶어 출하 단위를 만드는 작업을 현장에서 스캔으로 처리한다.",
    when: "박스를 팔레트로 적재·마감할 때.",
    cautions: [
      "적재 가능한 박스는 마감·OQC합격·미할당 상태여야 한다.",
      "박스가 없는 팔레트는 마감할 수 없다.",
    ],
  },
  {
    id: "pda-pallet-ship",
    lane: "pda",
    activity: "PDA 팔레트 출하",
    summary: "마감된 팔레트를 스캔하고 작업자 QR을 스캔해 팔레트 단위로 출하합니다.",
    detail: "PDA에서 마감(CLOSED) 팔레트 바코드를 스캔하면 연결된 출하지시를 확인하고, 작업자 QR 스캔 후 팔레트 단위로 즉시 출하 처리합니다. 구성(적재·마감)은 'PDA 팔레트 구성' 화면에서 선행됩니다.",
    x: 2860,
    dataObjects: ["PALLET_MASTERS", "SHIPMENT_LOGS", "PRODUCT_TRANSACTIONS", "BOX_MASTERS"],
    routes: [
      { label: "PDA 팔레트 출하", path: "/pda/pallet-ship" },
    ],
    inputs: ["마감 팔레트", "작업자 QR"],
    outputs: ["출하 처리", "제품재고 차감"],
    order: 7,
    why: "구성·마감된 팔레트를 현장에서 스캔해 팔레트 단위로 출하한다.",
    when: "마감(CLOSED) 팔레트를 차량에 상차·출하할 때.",
    cautions: [
      "마감(CLOSED)·출하지시 연결된 팔레트만 출하된다.",
      "팔레트 구성(적재·마감)이 선행되어야 한다.",
    ],
  },
  {
    id: "pda-equip-inspect",
    lane: "pda",
    activity: "PDA 설비 일상점검",
    summary: "설비를 스캔해 일상점검 체크리스트를 입력합니다.",
    detail: "PDA에서 설비 바코드를 스캔해 당일 점검 여부를 확인하고 점검 항목별 PASS/FAIL/조건부를 입력합니다. FAIL 발생 시 인터락 경고가 표시됩니다.",
    x: 0,
    dataObjects: ["EQUIP_INSPECT_LOGS", "EQUIP_INSPECT_ITEM_MASTERS"],
    routes: [
      { label: "PDA 설비점검", path: "/pda/equip-inspect" },
      { label: "설비 일상점검(PC)", path: "/equipment/daily-inspect" },
    ],
    inputs: ["설비 바코드", "점검 항목"],
    outputs: ["점검 결과", "FAIL 인터락"],
    order: 8,
    why: "생산 시작 전 설비 상태를 현장에서 점검해 불량 설비 가동을 막는다.",
    when: "작업 시작 전 또는 일상점검 주기.",
    cautions: [
      "FAIL 항목은 인터락으로 후속 작업을 막을 수 있다.",
      "당일 이미 점검한 설비는 중복 점검이 제한된다.",
    ],
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
  { id: "e-planning-order", source: "quality-planning", target: "job-order", label: "양산 품질 기준", kind: "reference" },
  { id: "e-change-result", source: "quality-change", target: "production-result", label: "변경점 통제", kind: "reference" },
  { id: "e-inspect-spc", source: "process-inspection", target: "quality-spc", label: "공정 데이터", kind: "reference" },
  { id: "e-history-capa", source: "shipping-history", target: "quality-capa", label: "클레임 피드백", kind: "reference" },
  { id: "e-capa-planning", source: "quality-capa", target: "quality-planning", label: "재발방지 반영", kind: "reference" },
  { id: "e-cons-master-stock", source: "cons-master", target: "cons-stock", label: "라벨 발행분", kind: "normal" },
  { id: "e-cons-stock-mount", source: "cons-stock", target: "cons-mount", label: "출고 소모품", kind: "normal" },
  { id: "e-cons-mount-kiosk", source: "cons-mount", target: "input-kiosk-start", label: "설비 장착 소모품", kind: "reference" },
  { id: "e-receive-pda", source: "material-receive", target: "pda-mat-receive", label: "PDA로도 처리", kind: "reference" },
  { id: "e-issue-pda", source: "material-issue", target: "pda-mat-issue", label: "PDA로도 처리", kind: "reference" },
  { id: "e-lot-pda", source: "lot-control", target: "pda-inventory", label: "PDA 조정·실사", kind: "reference" },
  { id: "e-product-pda", source: "product-receive", target: "pda-product-receive", label: "PDA로도 처리", kind: "reference" },
  { id: "e-confirm-pda", source: "shipping-confirm", target: "pda-shipping", label: "PDA로도 처리(박스)", kind: "reference" },
  { id: "e-pallet-pda", source: "palletize", target: "pda-pallet-build", label: "PDA로도 구성(팔레트)", kind: "reference" },
  { id: "e-confirm-pda-pallet", source: "shipping-confirm", target: "pda-pallet-ship", label: "PDA로도 출하(팔레트)", kind: "reference" },
  { id: "e-pda-equip-kiosk", source: "pda-equip-inspect", target: "input-kiosk-start", label: "점검 후 가동", kind: "reference" },
];

const _nodeById = new Map(workflowNodes.map((n) => [n.id, n]));

/** 레인 순서대로, 각 레인 내 노드는 order(없으면 x) 오름차순 */
export function getNodesByLane(): { lane: WorkflowLane; nodes: WorkflowActivityNode[] }[] {
  return workflowLanes.map((lane) => ({
    lane,
    nodes: workflowNodes
      .filter((n) => n.lane === lane.id)
      .sort((a, b) => (a.order ?? a.x) - (b.order ?? b.x)),
  }));
}

/** 레인 활성 + 검색어 매칭 노드 id 집합 */
export function getVisibleNodeIds(query: string, activeLaneIds: Set<WorkflowLaneId>): Set<string> {
  const q = query.trim().toLowerCase();
  return new Set(
    workflowNodes
      .filter((n) => activeLaneIds.has(n.lane))
      .filter((n) => {
        if (!q) return true;
        const hay = [
          n.activity, n.summary, n.detail, n.why ?? "", n.when ?? "",
          ...(n.cautions ?? []),
          ...n.dataObjects, ...n.inputs, ...n.outputs,
          ...n.routes.map((r) => r.label),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .map((n) => n.id),
  );
}

export function getPreviousNodes(nodeId: string): { edge: WorkflowBusinessEdge; node: WorkflowActivityNode }[] {
  return workflowEdges
    .filter((e) => e.target === nodeId)
    .map((e) => ({ edge: e, node: _nodeById.get(e.source) }))
    .filter((x): x is { edge: WorkflowBusinessEdge; node: WorkflowActivityNode } => Boolean(x.node));
}

export function getNextNodes(nodeId: string): { edge: WorkflowBusinessEdge; node: WorkflowActivityNode }[] {
  return workflowEdges
    .filter((e) => e.source === nodeId)
    .map((e) => ({ edge: e, node: _nodeById.get(e.target) }))
    .filter((x): x is { edge: WorkflowBusinessEdge; node: WorkflowActivityNode } => Boolean(x.node));
}

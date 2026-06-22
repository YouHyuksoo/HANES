---
menuCode: QC_IQC
audience: operator
title: 入库检验(IQC) — 操作指南
summary: IQC界面的DB结构·全部列映射, AQL自动判定逻辑, 不合格时库存转移, 破坏性检验自动出库, 判定取消条件, 多租户范围等运营核心要点
tags: [质量, IQC, 入库检验, 操作, AQL, 不合格仓库]
keywords: [IQC_LOGS, MAT_LOTS, MAT_ARRIVALS, IQC_PART_SPECS, IQC_PART_SPEC_ITEMS, IQC_ITEM_POOL, PENDING, PASSED, FAILED, IQC_IN_PROGRESS, PASS, FAIL, INITIAL, RETEST, AQL判定, 不合格仓库, 破坏性检验, AUTO_ISSUE, DEFECT_TYPE, DEFECT_GRADE, CRITICAL, MAJOR, MINOR, LSL, USL, INSPECT_DATE, SEQ, 多租户, COMPANY, PLANT_CD, 检验成绩单, CERT_FILE_PATH, 取消, CANCELED]
related: [QC_AQL, MST_PART]
---

# 入库检验(IQC) — 操作指南

## 系统目的·角色
检验入货材料LOT的质量并判定合格·不合格的界面。
- 判定结果即时反映到`MAT_LOTS.IQC_STATUS`和`MAT_ARRIVALS.IQC_STATUS`。
- 不合格(FAIL)时该入货件的所有序列号自动转移到**不合格仓库(warehouseType='DEFECT')**(`MAT_STOCKS`数量清零后重新分配到不合格仓库)。
- 合格(PASS)时若物料设置了有效期，则根据入货日期自动计算`MAT_LOTS.EXPIRE_DATE`。
- 设置`IQC_SAMPLE_ISSUE_MODE = 'AUTO_ISSUE'`时，PASS + 有样本数量则自动出库破坏性检验样本(`STOCK_TRANSACTIONS`记录, `refType='IQC_DESTRUCT'`)。
- 判定后AQL供应商检验水平将被更新(入库检验记录累计 → 检验模式切换)。

## 数据结构

```
MAT_LOTS (PK: COMPANY, PLANT_CD, MAT_UID)
   ├─ IQC_STATUS: PENDING / PASS / FAIL  ← IQC判定后更新
   ├─ ARRIVAL_NO ──▶ MAT_ARRIVALS (入货头, IQC_STATUS同步)
   └─ ITEM_CODE ──▶ ITEM_MASTERS (物料信息)
                        └─ IQC_AQL_POLICY_CODE ──▶ IQC_AQL_POLICIES (AQL策略)
                                                        └─ AQL_STANDARDS → LOT判定基准

IQC_PART_SPECS (PK: COMPANY, PLANT_CD, ITEM_CODE) ── 按物料IQC基准头
   └─ IQC_PART_SPEC_ITEMS (PK: ... ITEM_CODE, SEQ) ── 按项目LSL/USL/AQL
         └─ INSP_ITEM_CODE ──▶ IQC_ITEM_POOL (全局检验项目定义)

IQC_LOGS (PK: INSPECT_DATE, SEQ) ── 检验记录1条 (按入货单位, matUid=null)
   ├─ ARRIVAL_NO, ITEM_CODE, VENDOR_CODE
   ├─ RESULT: PASS / FAIL
   ├─ DETAILS (CLOB, JSON) ── 按序列号测量详细
   ├─ ITEM_RESULTS (CLOB, JSON) ── 按检验项目AQL判定结果
   └─ AQL_*列 ── 判定时应用的AQL基准快照

MAT_STOCKS ── 库存数量 (FAIL时转移到不合格仓库)
STOCK_TRANSACTIONS ── 库存转移/出库记录 (refType: IQC_FAIL / IQC_DESTRUCT)
```

---

## ① 检验对象列表 — MAT_LOTS (汇总视图)

界面列表为按`ARRIVAL_NO + ITEM_CODE`对`MAT_LOTS`进行GROUP BY汇总的结果。

| 界面项目 | DB列/来源 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 入货号 | `MAT_LOTS.ARRIVAL_NO` | 入货件标识。GROUP BY键。 |
| 入货日期 | `MIN(MAT_LOTS.RECV_DATE)` | 入货件的最早接收日期。 |
| 供应商 | `MAT_LOTS.VENDOR` (→ 协作公司名JOIN) | 交付客户代码及名称。 |
| 物料代码 | `MAT_LOTS.ITEM_CODE` | GROUP BY键。 |
| 物料名称 | `ITEM_MASTERS.ITEM_NAME` | LEFT JOIN。 |
| 检验区分 | `ITEM_MASTERS.INSPECT_METHOD` | 公共代码`IQC_INSPECT_METHOD`。`FULL`=检验, `SKIP`=免检。与`INSPECT_CLASS`(IQC_LOGS legacy列)不同。 |
| 序列号数 | `COUNT(*)` | 该入货件的序列号数量。 |
| 总数量 | `SUM(MAT_LOTS.INIT_QTY)` | 序列号全部初始数量合计。 |
| 状态 | `MAT_LOTS.IQC_STATUS` | `PENDING`=待检, `PASS`=合格(→前端`PASSED`), `FAIL`=不合格(→`FAILED`)。界面也可显示`IQC_IN_PROGRESS`(LOT部分进行中时)。 |

---

## ② 检验记录 — IQC_LOGS (全部列)

检验结果登记时按入货件生成1条(`MAT_UID=null`, 按入货件检验标记)。

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| (复合PK) | `INSPECT_DATE` | 检验登记日期时间(TIMESTAMP)。PK部分。 |
| (复合PK) | `SEQ` | 同一日期时间内序号(默认1)。PK部分。 |
| 入货号 | `ARRIVAL_NO` | 检验对象入货件。按入货件检验时必填。 |
| 材料UID | `MAT_UID` | 按序列号检验时的序列号标识。按入货件检验(当前方式)为`null`。 |
| 物料代码 | `ITEM_CODE` | 检验对象物料。 |
| 供应商代码 | `VENDOR_CODE` | 交付协作公司代码(AQL检验水平更新基准)。 |
| 检验类型 | `INSPECT_TYPE` | `INITIAL`=首次检验(默认), `RETEST`=复检。与`RETEST_ROUND`一同使用。 |
| 检验结果 | `RESULT` | `PASS` / `FAIL`。前端提交值(`PASSED`/`FAILED`)在服务中转换。 |
| 详细内容 | `DETAILS` (CLOB) | 按序列号·按项目测量值JSON。格式: `{type:"SERIAL_INSPECTION", serials:[...], destructive:[...]}`。 |
| 按项目判定 | `ITEM_RESULTS` (CLOB) | 按检验项目AQL判定结果JSON。AQL服务生成。 |
| 检验员 | `INSPECTOR_NAME` | 检验执行者姓名(自由输入)。 |
| 检验分类 | `INSPECT_CLASS` | legacy列。当前界面不使用于IQC检验区分(FULL/SKIP)记录。 |
| 破坏样本数 | `DESTRUCT_SAMPLE_QTY` | 破坏性检验样本数量。此值>0且PASS时在AUTO_ISSUE模式下自动出库。 |
| 检验成绩单 | `CERT_FILE_PATH` | 上传文件的服务器路径(`/uploads/iqc/...`)。通过文件上传API单独保存。 |
| 样本条码 | `SAMPLE_BARCODE` | 扫描的序列号列表(逗号分隔)。超过500字节时自动压缩(`...(+N more)`后缀)。 |
| LOT数量 | `LOT_QTY` | AQL判定时使用的LOT总数量。 |
| AQL检验水平 | `AQL_INSPECTION_LEVEL` | 应用的AQL检验水平(例如: `II`)。 |
| AQL检验模式 | `AQL_INSPECTION_MODE` | 应用的检验模式(例如: `NORMAL`)。 |
| AQL样本数 | `AQL_SAMPLE_QTY` | 按AQL基准计算的建议样本数。 |
| Major AQL代码 | `AQL_MAJOR_CODE` | 应用的Major AQL基准代码。 |
| Major Ac | `AQL_MAJOR_AC` | Major合格判定个数。 |
| Major Re | `AQL_MAJOR_RE` | Major不合格判定个数。 |
| Minor AQL代码 | `AQL_MINOR_CODE` | 应用的Minor AQL基准代码。 |
| Minor Ac | `AQL_MINOR_AC` | Minor合格判定个数。 |
| Minor Re | `AQL_MINOR_RE` | Minor不合格判定个数。 |
| 致命不良数 | `DEFECT_CRITICAL` | Critical等级不良数量。 |
| 重缺陷不良数 | `DEFECT_MAJOR` | Major等级不良数量。 |
| 轻缺陷不良数 | `DEFECT_MINOR` | Minor等级不良数量。 |
| AQL判定原因 | `AQL_JUDGE_REASON` | AQL自动判定逻辑的结果原因(自动生成)。 |
| 状态 | `STATUS` | `DONE`=判定完成(默认), `CANCELED`=已取消。 |
| 复检次数 | `RETEST_ROUND` | `INSPECT_TYPE=RETEST`专用。复检次数。 |
| 备注 | `REMARK` | 检验备注。取消时取消原因也记录于此。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000` 范围。 |
| 创建/修改 | `CREATED_AT`, `UPDATED_AT`, `CREATED_BY`, `UPDATED_BY` | 审计列。 |

---

## ③ 按物料IQC基准 — IQC_PART_SPECS / IQC_PART_SPEC_ITEMS

检验模态框中查询物料检验项目和基本样本数的基准表。

### IQC_PART_SPECS (按物料头)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| (PK) | `COMPANY`, `PLANT_CD`, `ITEM_CODE` | 复合PK。每物料1行。 |
| 基本样本数 | `SAMPLE_QTY` | 加载为检验模态框的基本样本数初始值。检验员可修改。 |
| 破坏性检验与否 | `IS_DEST` | `Y`则为破坏性检验对象物料。 |
| 使用与否 | `USE_YN` | `N`时从检验项目查询中排除。 |

### IQC_PART_SPEC_ITEMS (按项目详细)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| (PK) | `COMPANY`, `PLANT_CD`, `ITEM_CODE`, `SEQ` | 复合PK。按序号区分项目。 |
| 检验项目代码 | `INSP_ITEM_CODE` | 引用`IQC_ITEM_POOL.INSP_ITEM_CODE`。获取项目名·判定方法·基本LSL/USL。 |
| 下限(LSL) | `LSL` | 计量合格下限(无则NULL)。NULL则作为目视判定处理。 |
| 上限(USL) | `USL` | 计量合格上限(无则NULL)。 |
| 判定基准 | `JUDGE_CRITERIA` | 目视判定基准说明。 |
| 不良等级 | `DEFECT_GRADE` | `CRITICAL`/`MAJOR`/`MINOR`。公共代码`DEFECT_GRADE`。以此等级的不良数对应AQL Ac/Re。 |
| 检验水平 | `INSPECTION_LEVEL` | ISO 2859-1检验水平。公共代码`AQL_INSP_LEVEL`。 |
| AQL值 | `AQL` | 按项目AQL(合格质量界限)。公共代码`AQL_VALUE`。 |
| 检验类型 | `INSPECTION_TYPE` | `AQL`(默认)/`DESTRUCTIVE`(破坏)/`FULL`(全数)。NULL视为AQL。公共代码`IQC_ITEM_INSP_TYPE`。 |
| 样本方式 | `SAMPLE_METHOD` | `AQL`(自动)/`FIXED`(固定)。NULL为AQL。公共代码`IQC_SAMPLE_METHOD`。 |
| 固定样本数 | `SAMPLE_QTY` | `INSPECTION_TYPE=DESTRUCTIVE/FULL`或`SAMPLE_METHOD=FIXED`的项目的每LOT固定样本数。 |
| 使用与否 | `USE_YN` | `N`时检验时不显示。 |

### IQC_ITEM_POOL (全局检验项目定义)

| 列 | 角色 / 含义 · 操作要点 |
|------|------|
| `INSP_ITEM_CODE` | 检验项目唯一代码(PK)。例如: `IQC-001`。 |
| `INSP_ITEM_NAME` | 检验项目名。模态框检验项目列中显示。 |
| `JUDGE_METHOD` | `VISUAL`(目视)/`MEASURE`(计量)。计量时测量值输入栏激活。 |
| `CRITERIA` | 默认判定基准。`IQC_PART_SPEC_ITEMS.JUDGE_CRITERIA`不存在时使用此值。 |
| `LSL`, `USL`, `UNIT` | 默认合格范围。可在项目中重新定义。 |
| `REVISION`, `EFFECTIVE_DATE` | 检验项目修订记录管理。 |

---

## AQL判定逻辑

按入货件检验结果登记(`POST /material/iqc-history/arrival`)时按以下顺序确定最终结果。

```
1. 查询入货件的全部PENDING序列号 → 计算LOT总数量
2. 解析DETAILS JSON → 按序列号按项目汇总FAIL(缺陷数)(itemDefectCounts)
3. 解析破坏性检验(destructive)部分 → 按项目汇总inspectedQty/defectQty
4. 调用AQL服务resolveIqcPolicyByItem:
   a. 物料的IQC_AQL_POLICY_CODE → 查询IQC_AQL_POLICIES
   b. 有致命缺陷(CRITICAL)且criticalMode='IMMEDIATE_FAIL' → 立即FAIL
   c. 设置了defectGrade的项目: 按项目inspectionLevel/AQL查询LOT区间 → 比较Ac/Re
   d. 项目未设置等级时: 回退到整体Major/Minor Ac/Re
   e. Major或Minor不良数 ≥ Re → FAIL / ≤ Ac → PASS
5. 按最终result(PASS/FAIL)批量更新PENDING序列号
6. 创建1条IQC_LOGS (保存AQL基准快照列)
7. FAIL → 自动转移到不合格仓库 (STOCK_TRANSACTIONS refType='IQC_FAIL')
8. PASS + 有效期 → 自动计算EXPIRE_DATE
9. PASS + 样本数 > 0 + AUTO_ISSUE模式 → 自动出库破坏样本 (refType='IQC_DESTRUCT')
10. 更新AQL供应商检验水平
```

> 输入不良代码(`defects[]`)时，若没有FAIL判定项目则返回400错误阻止(`assertDefectCodesHaveFailedInspection`)。

---

## 判定取消条件

调用`DELETE /material/iqc-history/{inspectDate}/{seq}`时检查以下条件。

| 条件 | 操作 |
|------|------|
| 已为`STATUS='CANCELED'` | 400错误 ("已取消的判定") |
| 该入货件已入库(`MAT_RECEIVINGS.STATUS='DONE'`) | 400错误 ("已入库的入货件") |
| PASS且存在破坏样本自动出库(`refType='IQC_DESTRUCT'`) | 400错误 ("请先整理样本出库") |
| FAIL且存在不合格仓库转移记录 | 自动反向转移(`refType='IQC_FAIL_CANCEL'`)后允许取消 |
| 取消成功 | `IQC_LOGS.STATUS='CANCELED'`, 序列号→恢复`IQC_STATUS='PENDING'` |

---

## API路径

| 目的 | 方法 | 路径 |
|------|------|------|
| 待检列表查询 | GET | `/material/iqc-history/pending-arrivals` |
| 待检序列号查询 | GET | `/material/iqc-history/pending-serials` |
| 按入货件检验结果登记 | POST | `/material/iqc-history/arrival` |
| 检验成绩单上传 | POST | `/material/iqc-history/{inspectDate}/{seq}/upload-cert` |
| 判定取消 | DELETE | `/material/iqc-history/{inspectDate}/{seq}` |
| 物料检验项目查询 | GET | `/master/iqc-part-specs/{itemCode}/resolve-items` |
| 物料基准头查询 | GET | `/master/iqc-part-specs/{itemCode}` |
| AQL样本数量查询 | GET | `/quality/aql/resolve-iqc-items` |

---

## 预设条件 (主表·公共代码)

- 公共代码: `IQC_INSPECT_METHOD`(FULL/SKIP), `IQC_STATUS`, `DEFECT_TYPE`(不良代码, `ATTR1`需有等级), `DEFECT_GRADE`(CRITICAL/MAJOR/MINOR), `IQC_ITEM_INSP_TYPE`(AQL/DESTRUCTIVE/FULL), `IQC_SAMPLE_METHOD`(AQL/FIXED), `AQL_INSP_LEVEL`, `AQL_VALUE`
- 需设置`ITEM_MASTERS.IQC_FLAG='Y'` (IQC对象物料)
- `IQC_ITEM_POOL` — 需注册检验项目池
- `IQC_PART_SPECS` + `IQC_PART_SPEC_ITEMS` — 需配置按物料检验项目
- `IQC_AQL_POLICIES` — 需设置AQL策略并关联物料
- 必须登记不合格仓库(`warehouseType='DEFECT'`, `USE_YN='Y'`) — 否则不合格库存无法转移(无错误地跳过)

---

## 权限

| 角色 | 可操作范围 |
|------|------|
| 检验负责人 | 检验结果登记, 序列号扫描, 成绩单上传 |
| 质量管理员 | 以上 + 判定取消 |
| 运营者 | 以上 + 公共代码·基准设置 |

---

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| 检验按钮禁用 | 状态为PASSED/FAILED | 需取消判定(运营者)。需无入库记录才可取消 |
| AQL样本数量不显示 | 物料未关联AQL策略 | 在物料主表中设置`IQC_AQL_POLICY_CODE` |
| 不合格处理后库存未转移到不合格仓库 | 不合格仓库(`warehouseType='DEFECT'`)未登记 | 在仓库主表中登记DEFECT类型仓库 |
| 取消时"已入库的入货件"错误 | 该入货件已入库(MAT_RECEIVINGS DONE) | 取消入库后取消IQC判定 |
| 取消时"请先整理样本出库"错误 | 存在IQC_DESTRUCT自动出库记录 | 取消该STOCK_TRANSACTIONS后重试 |
| 检验项目在模态框中不显示 | `IQC_PART_SPECS`/`IQC_PART_SPEC_ITEMS`未登记或`USE_YN='N'` | 确认IQC检验项目管理设置 |
| 输入不良代码后登记被阻止 | 没有FAIL判定项目却输入了不良代码 | 不良代码只能与FAIL判定项目一同登记 |
| ORA-04068 (首次调用500) | DDL后PL/SQL包INVALID | 执行`ALTER PACKAGE <包名> COMPILE`或重试(callProc硬编码重试1次) |
| 破坏样本自动出库未执行 | `IQC_SAMPLE_ISSUE_MODE != 'AUTO_ISSUE'`或`DESTRUCT_SAMPLE_QTY=0` | 确认系统设置`IQC_SAMPLE_ISSUE_MODE='AUTO_ISSUE'`及输入样本数 |

---

## 数据·关联

- **主要表**: `IQC_LOGS`, `MAT_LOTS`, `MAT_ARRIVALS`, `IQC_PART_SPECS`, `IQC_PART_SPEC_ITEMS`, `IQC_ITEM_POOL`
- **库存表**: `MAT_STOCKS`(库存), `STOCK_TRANSACTIONS`(转移/出库记录)
- **主表**: `ITEM_MASTERS`(物料), `IQC_AQL_POLICIES`, `AQL_STANDARDS`(AQL基准)
- **关联界面**: [AQL基准管理](/quality/aql), [物料主表](/master/part), 材料入库, 入库检验记录
- **多租户范围**: `COMPANY='40'`, `PLANT_CD='1000'`。所有查询·保存包含租户参数。通过`assertSameTenant`阻止交叉访问。

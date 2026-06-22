---
menuCode: PROD_ORDER
audience: operator
title: 工单管理 — 操作指南
summary: 工单(JOB_ORDERS)的全部列·DB映射, 状态迁移逻辑, 编号规则, BOM自动展开, 多租户与故障排除
tags: [生产, 工单, 操作, 状态迁移, BOM, 编号]
keywords: [JOB_ORDERS, 工单, WO, ORDER_NO, 状态迁移, WAITING, RUNNING, HOLD, DONE, CANCELED, 编号, nextJobOrderNo, BOM展开, PARENT_ID, ROOT_ORDER_NO, ROUTING_CODE, PROD_RESULTS, 多租户, 故障排除]
related: [PROD_RESULT, MST_PART]
---

# 工单管理 — 操作指南

## 系统目的·角色
发行·管理成品·半成品生产指令的界面，是**生产实绩·检验·出货·库存的起点**。1条工单以自然键`ORDER_NO`为PK，引用物料(`ITEM_CODE`)·工艺路线(`ROUTING_CODE`)，并通过自引用(`PARENT_ID`)形成成品-半成品层级。状态通过专用API(开始/保留/解除保留/完成/取消)迁移，禁止直接修改。

> API基本路径: `/production/job-orders`。菜单代码`PROD_ORDER`，路径`/production/order`。

## 数据结构
```
ITEM_MASTERS(物料) ──ITEM_CODE──▶ JOB_ORDERS ◀──PARENT_ID── (半成品子工单)
        │                            │  │
        │                            │  └──ROOT_ORDER_NO── 同时创建组最上级
ROUTING_GROUPS ──ROUTING_CODE────────┘  │
PROD_PLANS ──PLAN_NO────────────────────┤
                                        │
                            PROD_RESULTS(实绩) ◀──ORDER_NO── (实绩汇总: GOOD_QTY/DEFECT_QTY)
                            FG_LABELS(成品条码) ◀──ORDER_NO── (PRE_ISSUE预先发行)
```
- BOM展开: 从`BOM_MASTERS`(parentItemCode → childItemCode)中仅选择`SEMI_PRODUCT`递归创建子工单。
- 实绩汇总: 列表·完成时，`PROD_RESULTS`的良品/不良合计(排除CANCELED)反映为`GOOD_QTY`/`DEFECT_QTY`。

> 注意(代码不一致): 界面表格右侧`sqlQuery`预览中标注为`PROD_ORDERS`，但**实际实体/表名为`JOB_ORDERS`**(实体`@Entity({ name: 'JOB_ORDERS' })`)。运营基准为`JOB_ORDERS`。

---

## ① 工单 — JOB_ORDERS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 工单号 | `ORDER_NO` | PK(自然键, varchar2 50)。未输入时服务器自动编号。不可变更。 |
| 上级工单 | `PARENT_ID` | 父工单`ORDER_NO`(self FK)。半成品子项持有成品ORDER_NO。最上级为NULL。 |
| 同时创建根 | `ROOT_ORDER_NO` | BOM自动展开组的最上级ORDER_NO。最上级自身为NULL。 |
| 生产计划号 | `PLAN_NO` | 关联的`PROD_PLANS.PLAN_NO`(可选)。取消时扣减该计划的`ORDER_QTY`。 |
| 物料代码 | `ITEM_CODE` | 引用`PART_MASTERS.ITEM_CODE`(必填)。创建时验证物料存在·租户一致。 |
| 生产线 | `LINE_CODE` | 生产线(可选)。 |
| 工艺路线代码 | `ROUTING_CODE` | 基于物料自动查询(`ROUTING_GROUPS`, useYn='Y')。无直接输入。 |
| 工序 | `PROCESS_CODE` | 代表工序。未指定时从工艺路线首SEQ自动继承。工序变更时设备重置。 |
| 设备 | `EQUIP_CODE` | 作业设备(可选)。创建时通常为NULL，之后分配。 |
| 计划数量 | `PLAN_QTY` | int。必填，1以上。子项(半成品)为`ceil(父数量 × BOM用量)`。 |
| 良品数量 | `GOOD_QTY` | int(默认0)。实绩汇总值(PROD_RESULTS合计)。完成时确认更新。 |
| 不良数量 | `DEFECT_QTY` | int(默认0)。实绩汇总值。 |
| 计划日期 | `PLAN_DATE` | date(nullable)。列表查询默认过滤器。NULL记录始终显示(不受范围过滤影响)。 |
| 开始时间 | `START_TIME` | timestamp。start时首次记录。 |
| 结束时间 | `END_TIME` | timestamp。complete/cancel时记录。 |
| 优先级 | `PRIORITY` | int(默认5)。1(最高)~10(最低)。列表按PRIORITY ASC, PLAN_DATE ASC, CREATED_AT DESC排序。 |
| 状态 | `STATUS` | varchar2 20(默认WAITING)。公共代码`JOB_ORDER_STATUS`。值: WAITING/RUNNING/HOLD/DONE/CANCELED。 |
| 客户PO号 | `CUST_PO_NO` | 对应客户PO(可选)。 |
| 备注 | `REMARK` | varchar2 500。HOLD时注入`[HOLD] 之前状态:{state}`前缀以保存恢复状态。 |
| ERP同步 | `ERP_SYNC_YN` | 'Y'/'N'(默认N)。完成(DONE)记录中'N'作为未同步列表显示。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 公司/工厂范围。标准值`COMPANY='40'`, `PLANT_CD='1000'`。验证与物料·工艺路线租户一致。 |
| 登记/修改人 | `CREATED_BY`, `UPDATED_BY` | 审计列。 |
| 登记/修改时间 | `CREATED_AT`, `UPDATED_AT` | timestamp(DEFAULT SYSTIMESTAMP)。 |

> 子工单(自动创建半成品)的`REMARK`记录为`[自动创建] {父ORDER_NO}的半成品`。

---

## 编号规则
- 编号: `nextJobOrderNo()` → 通道`JOB_ORDER`(基于Oracle SEQUENCE, 事务内共享`QueryRunner`)。
- 格式: `W + YYMMDD + - + 3位每日序列`。例如: `W260519-001`。每日0时重置(DBMS_SCHEDULER)。
- 详细(按部件)代码约定: `完整代码-部件号`(例如: `W260519-001-HNS-A-R1`)。序列号将首字母`W→S`替换。
- 单一来源: `docs/standards/numbering-rules.md`。

## 状态迁移逻辑
仅通过专用API迁移。`PUT /:id/status`(直接修改)一律拒绝(防止状态跳跃绕过)。

| 迁移 | API | 允许前提状态 | 处理 |
|------|------|------|------|
| 开始 | `POST /:id/start` | WAITING → RUNNING | 首次记录START_TIME。`FG_BARCODE_ISSUE_TIMING=PRE_ISSUE`时按计划数量发行FG_LABELS。 |
| 保留 | `POST /:id/hold` | WAITING/RUNNING → HOLD | 在REMARK中注入`[HOLD] 之前状态:{state}`(用于恢复)。阻止实绩登记·出货。 |
| 解除保留 | `POST /:id/hold-release` | HOLD → 之前状态 | 从REMARK解析之前状态恢复，移除前缀。 |
| 完成 | `POST /:id/complete` | RUNNING → DONE | 以PROD_RESULTS合计确认GOOD_QTY/DEFECT_QTY，记录END_TIME(事务)。与余量无关终止。 |
| 取消 | `POST /:id/cancel` | WAITING/HOLD → CANCELED | 有1条实绩即拒绝。关联PLAN_NO时扣减计划ORDER_QTY，记录END_TIME。 |

- **修改(PUT)**: DONE/CANCELED不可修改。`status`字段直接修改也拒绝。变更itemCode时重新查询ROUTING_CODE。
- **删除(DELETE)**: RUNNING不可删除(其余状态为hard delete)。

## BOM自动展开逻辑 (创建时)
1. `autoCreateChildren !== false`(默认ON)则在保存父项后开始递归展开。
2. 从`BOM_MASTERS`(parentItemCode=当前物料, useYn='Y')查询子物料。
3. 仅子项中`PART_MASTERS.ITEM_TYPE='SEMI_PRODUCT'`的创建为工单。
4. 子PLAN_QTY = `ceil(父PLAN_QTY × BOM.QTY_PER)`。PARENT_ID=父, ROOT_ORDER_NO=最上级。
5. 对子项再次执行2~4递归。通过循环引用(跟踪祖先路径)·深度50后备停止防止死循环。

## 预设条件 (主表·公共代码)
- 公共代码: `JOB_ORDER_STATUS`(状态徽标/过滤器), `JOB_ORDER_TYPE`(类型: NORMAL/REWORK/SAMPLE/TRIAL)。
- 主表前置: 物料主表(`PART_MASTERS`), 工艺路线(`ROUTING_GROUPS`/`ROUTING_PROCESS`), BOM(`BOM_MASTERS`), 设备·生产线。
- 系统设置: `FG_BARCODE_ISSUE_TIMING`(`ON_INSPECT`默认 / `PRE_ISSUE`时开始·预先发行批量发行条码)。

## 操作流程
1. 先登记物料·工艺路线·BOM(无工艺路线则工序/设备无法自动继承)。
2. 创建工单(物料·计划数量·计划日期必填)。成品通过BOM自动展开同时创建半成品。
3. 按开始 → (登记生产实绩) → 完成顺序进行。必要时可保留/解除。
4. 已完成记录在ERP未同步列表(`GET /erp/unsynced`)中确认后同步处理(`POST /erp/mark-synced`)。

## 权限
生产管理员(创建/修改/删除·状态迁移)。普通用户仅查询。(仅限多租户范围内查询/操作)

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 开始按钮禁用 | 状态不是WAITING | 仅WAITING可开始。保留的记录需解除保留后开始。 |
| 无法完成(400) | 状态不是RUNNING | 开始(RUNNING)后才能完成。 |
| 取消拒绝(400) | 存在实绩 | 删除实绩后取消，或以完成终止。 |
| 修改拒绝(400) | DONE/CANCELED状态或尝试直接修改status | 完成/取消记录不可修改。状态仅通过专用API。 |
| 删除拒绝(400) | RUNNING状态 | 进行中不可删除(完成/取消后处理)。 |
| 工艺路线/工序未自动填入 | 物料工艺路线未登记(无useYn='Y') | 登记工艺路线组或直接指定工序。 |
| 设备列表为空 | 所选工序未映射设备 | 在设备主表中为该工序注册设备。 |
| 半成品工单未创建 | BOM子项不是SEMI_PRODUCT/BOM未登记/复选框未勾 | 确认BOM·物料类型，开启自动创建复选框。 |
| 重复号(409) | 同一ORDER_NO已存在 | 使用自动编号(避免直接输入)。 |
| 列表中不显示 | 计划日期过滤器范围外 | 扩大过滤器(计划日期为NULL的记录始终显示)。 |

## 数据·关联
- 表: `JOB_ORDERS`(+ 自引用PARENT_ID/ROOT_ORDER_NO)
- 引用: `PART_MASTERS`(ITEM_CODE), `ROUTING_GROUPS`/`ROUTING_PROCESS`(ROUTING_CODE), `BOM_MASTERS`(展开), `PROD_PLANS`(PLAN_NO)
- 关联: `PROD_RESULTS`(实绩汇总 → GOOD_QTY/DEFECT_QTY), `FG_LABELS`(PRE_ISSUE预先发行), 出货/检验(HOLD时阻止), ERP同步
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`

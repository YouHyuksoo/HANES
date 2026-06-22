---
menuCode: PROD_MONTHLY_PLAN
audience: operator
title: 产品生产计划 — 操作指南
summary: PROD_PLANS表全部列·DB映射, 状态迁移/工单发行逻辑, 自动编制(MPS)·Excel上传流程, 编号·权限·故障排除·多租户
tags: [生产, 生产计划, MPS, 工单, 操作, 设置]
keywords: [PROD_PLANS, PLAN_NO, 产品生产计划, 月度生产计划, MPS, 编号, PP-YYYYMM-NNN, ORDER_QTY, PLAN_QTY, 发行率, 工单发行, issue-job-order, DRAFT, CONFIRMED, CLOSED, 确认, 取消确认, 关闭, 自动编制, auto-generate, Excel上传, bulk, autoCreateChildren, BOM展开, COMPANY, PLANT_CD, 故障排除]
related: [MST_PART, PROD_JOB_ORDER]
---

# 产品生产计划 — 操作指南

## 系统目的·角色
管理成品·半成品的**月(YYYY-MM)单位生产计划**的主表-交易边界界面。将计划(`PROD_PLANS`)**确认(CONFIRMED)**后**发行工单(`JOB_ORDERS`)**转入实际生产流程。发行时计划的发行数量(`ORDER_QTY`)累计增加，发行率·余量由此值计算。自动编制(MPS)基于订单(`/shipping/customer-orders`)批量生成DRAFT计划。

> 菜单/标题近期从"月度生产计划"改为"产品生产计划"，但路由(`/production/monthly-plan`)·API(`/production/prod-plans`)·表(`PROD_PLANS`)·i18n命名空间(`monthlyPlan.*`)保持不变。

## 数据结构
```
PROD_PLANS (PK: PLAN_NO = PP-YYYYMM-NNN, STATUS: DRAFT→CONFIRMED→CLOSED)
   │ ITEM_CODE (ManyToOne, nullable)
   ▼
PART_MASTERS (物料名·BOM·工艺路线引用)

工单发行时:
PROD_PLANS.ORDER_QTY += issueQty   (事务内原子增加)
   └─▶ JOB_ORDERS (status=WAITING) [+ autoCreateChildren时BOM下级SEMI_PRODUCT递归创建]
```
- API基础: `@Controller('production/prod-plans')` → `/api/v1/production/prod-plans`
- 列表排序: `priority ASC, createdAt DESC`。界面过滤器将`startDate/endDate`按**月(前7位)**截断后比较`planMonth`范围。

---

## ① 生产计划 — PROD_PLANS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 计划号 | `PLAN_NO` | PK。自然键。格式`PP-YYYYMM-NNN`。编号采用该月前缀的MAX+1(见下方编号逻辑)。不可变更。 |
| 计划月 | `PLAN_MONTH` | `VARCHAR2(7)`, `YYYY-MM`。有索引。无日期列(月单位计划)。DTO中`^\d{4}-\d{2}$`验证。 |
| 物料代码 | `ITEM_CODE` | `VARCHAR2(50)`。`PART_MASTERS.ITEM_CODE` ManyToOne(nullable)。登记时验证物料存在(否则404)。 |
| 物料类型 | `ITEM_TYPE` | `VARCHAR2(10)`。仅允许`FINISHED`/`SEMI_PRODUCT`(`@IsIn`)。 |
| 计划数量 | `PLAN_QTY` | `int`。目标数量。`@Min(1)`。工单发行上限基准。 |
| 发行数量 | `ORDER_QTY` | `int`, default 0。累计发行量。发行时通过SQL `ORDER_QTY + :issueQty`原子增加(非应用内存合计)。 |
| 发行率 | (计算) | 界面计算值`min(round(ORDER_QTY/PLAN_QTY*100),100)`。非DB列。 |
| 客户 | `CUSTOMER` | `VARCHAR2(50)`, nullable。客户(CUSTOMER)代码。参考/订单对应用。 |
| 生产线 | `LINE_CODE` | `VARCHAR2(255)`, nullable。默认生产线。工单发行时作为默认值继承。 |
| 优先级 | `PRIORITY` | `int`, default 5。1~10(`@Min(1)@Max(10)`)。列表排序第1顺序(ASC)。 |
| 状态 | `STATUS` | `VARCHAR2(20)`, default `DRAFT`。有索引。公共代码`PROD_PLAN_STATUS`以徽标显示。迁移: DRAFT→CONFIRMED→CLOSED, CONFIRMED→DRAFT(取消)。 |
| 备注 | `REMARK` | `VARCHAR2(500)`, nullable。 |
| 公司 | `COMPANY` | `VARCHAR2(50)`。多租户范围。包含于所有查询/修改where。 |
| 工厂 | `PLANT_CD` | `VARCHAR2(50)`(实体属性`plant`)。多租户范围。 |
| 登记人/修改人 | `CREATED_BY` / `UPDATED_BY` | `VARCHAR2(50)`, nullable。 |
| 登记日期/修改日期 | `CREATED_AT` / `UPDATED_AT` | `timestamp`。`@CreateDateColumn`/`@UpdateDateColumn`。 |

> 界面表格列中**物料名(partName)**通过`part.itemName`(PART_MASTERS关联)，**物料代码(partCode)**通过`part.itemCode ?? itemCode`显示的派生列。PROD_PLANS中没有物料名列。

---

## ② 登记/修改表单字段 (PlanFormPanel)

| 界面项目 | DB/DTO | 角色 / 含义 · 操作要点 |
|------|------|------|
| 计划月 | `planMonth` | 新增才输入，修改时disabled(编号基准)。 |
| 物料类型 | `itemType` | 新增才选择，修改时disabled。也用作物料搜索模态框过滤器。 |
| 物料代码 | `itemCode` | 仅PartSearchModal选择(readOnly)。修改时disabled。必填。 |
| 计划数量 | `planQty` | QtyInput。`≤0`时保存按钮禁用。 |
| 优先级 | `priority` | number, 默认5。 |
| 客户 | `customer` | 使用`usePartnerOptions('CUSTOMER')`选择。可选。 |
| 生产线 | `lineCode` | `/master/prod-lines`选择。可选。 |
| 备注 | `remark` | text。可选。 |

保存分支: 新增`POST /production/prod-plans`, 修改`PUT /production/prod-plans/:planNo`。修改时服务中**除DRAFT外阻止**(BadRequest)。

---

## ③ 工单发行表单 (IssueJobOrderModal → issue-job-order)

| 界面项目 | DTO字段 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 发行数量 | `issueQty` | `@Min(1)`。**超过余量(planQty−orderQty)时报400**。界面也以maxValue阻止。必填。 |
| 计划日期 | `planDate` | `@IsDateString`。映射到JobOrder.planDate(`parseDateStart`)。可选。 |
| 生产线 | `lineCode` | 未输入时继承plan.lineCode。 |
| 优先级 | `priority` | 未输入时继承plan.priority。 |
| BOM半成品自动生成 | `autoCreateChildren` | `@IsBoolean`。true时递归生成BOM下级SEMI_PRODUCT工单(见下方逻辑)。 |
| 备注 | `remark` | 未输入时为`从(planNo)发行`。 |

---

## 状态迁移 / 发行逻辑

### 状态迁移 (服务守卫)
| 操作 | API | 前提状态 | 结果 | 违反时 |
|------|------|------|------|------|
| 确认 | `POST :planNo/confirm` | DRAFT | CONFIRMED | 400 (仅DRAFT) |
| 取消确认 | `POST :planNo/unconfirm` | CONFIRMED | DRAFT | 400 (仅CONFIRMED) |
| 关闭 | `close()` | CONFIRMED | CLOSED | 400 (仅CONFIRMED) |
| 修改 | `PUT :planNo` | DRAFT | 更新 | 400 (仅DRAFT) |
| 删除 | `DELETE :planNo` | DRAFT | 删除 | 400 (仅DRAFT) |
| 批量确认 | `bulkConfirm` | 仅筛选DRAFT | CONFIRMED | 非DRAFT忽略(count 0) |

> 界面显示: DRAFT行 → 确认按钮 + 左侧修改/删除图标。CONFIRMED行 → 工单发行(余量>0) + 取消确认。CLOSED无操作。**关闭(close)已在服务中实现，但当前表格UI未显示按钮**(直接调用API/未来可能显示)。

### 工单发行逻辑 (`issueJobOrder`, 事务)
1. 查询计划 → 非`STATUS=CONFIRMED`返回400。
2. `remainQty = planQty − orderQty`。`issueQty > remainQty`返回400。
3. 通过`numbering.nextJobOrderNo()`编号工单号。
4. 解析物料的工艺路线(`RoutingGroup.useYn='Y'`) → 首工序(`RoutingProcess` seq ASC)。
5. 创建`JOB_ORDERS`(status=`WAITING`, erpSyncYn=`N`, lineCode/priority由dto→plan继承)。
6. `autoCreateChildren=true`时递归BOM展开生成(见下)。
7. `PROD_PLANS.ORDER_QTY += issueQty`通过SQL update原子增加。

### BOM半成品递归创建 (`createChildOrdersFromPlanRecursive`)
- 父物料的`BOM_MASTERS`(useYn='Y')子项中**仅`PART_MASTERS.ITEM_TYPE='SEMI_PRODUCT'**的项创建子工单。
- 子数量 = `ceil(parent.planQty × qtyPer)`。记录parentOrderNo/rootOrderNo链。
- **循环引用守卫**: 跟踪祖先itemCode路径，再次出现时中止(warn)。深度50后备停止。

---

## 编号 (PLAN_NO)
- 格式: `PP-` + `YYYYMM`(planMonth中去掉`-`) + `-` + 3位补零。
- 算法: 以该前缀LIKE条件`ORDER BY planNo DESC`取最上方1条的seq+1。
- 批量(bulkCreate)·自动编制在同一事务内顺序编号。

> 编号采用**SELECT MAX+1**方式而非Oracle SEQUENCE，高并发并行生成时可能存在PK冲突。当前以单用户/顺序输入为前提。若同时大量输入频繁，考虑转为SEQUENCE。

## 自动编制(MPS)流程
1. `POST /production/prod-plans/auto-generate/preview` { month, startDate?, endDate?, customerId? } → 基于订单返回候选(items: orderNo·dueDate·itemCode·demandQty·planQty), `existingDraftCount`, `warnings`。
2. 在界面中勾选项目。
3. 执行`POST /production/prod-plans/auto-generate` { month, selectedItems[] } → 将所选项目创建为DRAFT。**该月已有DRAFT先删除后重新编制**(确认模态框, 显示`existingDraftCount`)。CONFIRMED/CLOSED保留。

## Excel上传流程
1. 下载模板(`downloadProdPlanTemplate`)。
2. 选择文件 → 前端xlsx解析(头中韩映射) → 行验证(itemCode必填, itemType∈{FINISHED,SEMI_PRODUCT}, planQty>0)。
3. 仅当错误0条时上传按钮激活 → `POST /production/prod-plans/bulk` { planMonth, items[] }。服务器在事务中批量验证物料IN后全部保存(任一物料不存在即整体回滚)。

## 预设条件 (主表·公共代码)
- 公共代码: `PROD_PLAN_STATUS`(状态徽标), `ITEM_TYPE`(过滤器)。
- 主表: `PART_MASTERS`(物料·物料类型), `PROD_LINES`(生产线), `PARTNER_MASTERS`(客户, partnerType='CUSTOMER')。
- 工单发行正常化前提: 物料需有`ROUTING_GROUPS`(useYn='Y') + `ROUTING_PROCESS`登记。未登记时routingCode/processCode将发行null。
- 使用BOM自动生成时: `BOM_MASTERS`(useYn='Y', qtyPer) + 子物料的ITEM_TYPE='SEMI_PRODUCT'。

## 权限
- 生产计划负责人: 登记/修改/确认/发行。普通用户: 查询。
- ERP接口按钮当前仅显示**未实现通知模态框**(准备中)。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 登记时"未找到物料" | itemCode在该COMPANY/PLANT范围的PART_MASTERS中不存在 | 登记物料主表·确认范围 |
| 修改/删除被禁止(400) | 计划为CONFIRMED/CLOSED | 取消确认返回DRAFT后处理 |
| 工单发行按钮禁用 | 余量为0或非CONFIRMED | 确认余量·状态 |
| "发行数量超过余量" | issueQty > planQty−orderQty | 将发行数量设为余量以下 |
| 已发行的工单无工序 | 物料工艺路线(useYn='Y')·工序未登记 | 登记ROUTING_GROUPS/PROCESS后重新发行 |
| BOM自动生成未生效 | 子物料ITEM_TYPE≠SEMI_PRODUCT或BOM useYn='N' | 确认物料类型·BOM使用与否 |
| 自动编制后DRAFT消失 | 同月DRAFT重新编制(设计上正常) | 确认后自动编制则可保留 |
| Excel上传按钮禁用 | 存在验证错误行 | 修改红色错误行(itemCode/itemType/planQty) |

## 数据·关联
- 表: `PROD_PLANS`(主), `PART_MASTERS`(关联), `JOB_ORDERS`(发行结果), `BOM_MASTERS`/`ROUTING_GROUPS`/`ROUTING_PROCESS`(发行辅助)。
- 关联界面: [物料主表](/master/part), [工单](/production/job-order)。自动编制引用订单(`/shipping/customer-orders`)。
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`。所有查询/修改/删除的where包含COMPANY·PLANT。

---
menuCode: QC_REQUEST_INSPECT
audience: operator
title: 委托检验输入 — 操作指南
summary: 自检委托检验(DELEGATE)待处理记录的测量值输入·判定界面。SELF_INSPECT_RESULTS/SELF_INSPECT_ITEMS列·DB映射, 状态迁移, Kiosk阻止关联, 故障排除
tags: [质量, 自检, 委托检验, DELEGATE, 操作]
keywords: [SELF_INSPECT_RESULTS, SELF_INSPECT_ITEMS, DELEGATE, DIRECT, PENDING, PASS, FAIL, INSPECT_METHOD, STATUS, MEASURE_VALUE, LSL_VALUE, USL_VALUE, ITEM_TYPE, MEASURE, VISUAL, TIMING, INSPECTED_AT, Kiosk阻止, 自检]
related: [QC_AQL]
---

# 委托检验输入 — 操作指南

## 系统目的·角色
工序**自检**(SELF_INSPECT)中检验方法为**委托检验(DELEGATE)**的项目，在Kiosk中操作员不直接判定，而是加载结果记录为`STATUS='PENDING'`。本界面由质量负责人查询该待处理记录，**输入测量值并以PASS/FAIL确认**的管理界面。直接检验(DIRECT)在Kiosk中即时确认PASS/FAIL，因此不显示在此界面。

> 核心关联: 特定工单中存在1条以上`INSPECT_METHOD='DELEGATE' AND STATUS='PENDING'`的结果时，该工单的**Kiosk生产实绩输入将被阻止**(根据实体注释)。必须在本界面完成判定才能解除阻止。

## 数据结构
委托检验结果加载到结果表中，检验基准(规格·类型·单位)从项目主表JOIN获取。

```
SELF_INSPECT_ITEMS (检验项目主表)            SELF_INSPECT_RESULTS (检验结果)
  ID (PK) ─────────────────┐                     ID (PK)
  INSPECT_METHOD=DELEGATE   │  INSPECT_ITEM_ID    INSPECT_ITEM_ID ──(LEFT JOIN i.id)
  ITEM_TYPE / LSL / USL /   └─────────────────────  INSPECT_METHOD = 'DELEGATE'
  UNIT / STANDARD                                   STATUS = 'PENDING' → 本界面对象
```

- 待处理列表查询: `SELF_INSPECT_RESULTS r LEFT JOIN SELF_INSPECT_ITEMS i ON i.ID = r.INSPECT_ITEM_ID`, 条件 `r.INSPECT_METHOD='DELEGATE' AND r.STATUS='PENDING' AND r.COMPANY/PLANT_CD范围`, 排序 `r.CREATED_AT ASC`。
- API: 列表 `GET /production/self-inspect/delegates`, 判定 `PATCH /production/self-inspect/results/:id/status`。
- (参考) 界面左侧表格的`sqlQuery`显示用语句指向`INSPECT_REQUESTS`，但实际数据源为上述`SELF_INSPECT_RESULTS`(仅为显示用SQL标签，非查询路径)。

---

## ① 待处理列表 / 结果 — SELF_INSPECT_RESULTS (相关列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| (行标识) | `ID` | PK(UUID, `PrimaryGeneratedColumn('uuid')`)。判定PATCH的`:id`。 |
| 工单 | `ORDER_NO` | 检验发生的工单号。有索引。Kiosk阻止判断键。 |
| 工序 | `PROCESS_CODE` | 检验发生工序代码(nullable)。 |
| (检验项目键) | `INSPECT_ITEM_ID` | 引用`SELF_INSPECT_ITEMS.ID`(nullable)。规格/类型/单位JOIN键。 |
| 项目名 | `ITEM_NAME` | 检验项目名(结果时点快照, 长度200)。 |
| 时机 | `TIMING` | `FIRST`(首件) / `MID`(中件) / `LAST`(末件)。结果为单一时机值。 |
| (检验方法) | `INSPECT_METHOD` | `DIRECT`(直接) / `DELEGATE`(委托)。本界面仅`DELEGATE`对象。默认值`DIRECT`。 |
| (状态) | `STATUS` | `PENDING`(待处理) / `PASS`(合格) / `FAIL`(不合格)。默认值`PENDING`。有索引。仅PENDING显示在列表中。 |
| 测量值 | `MEASURE_VALUE` | NUMBER, nullable。仅MEASURE项目使用，VISUAL为null。判定时一同保存。 |
| 备注 | `REMARK` | varchar2(500), nullable。特殊情况/判定原因。 |
| 样本号 | `SAMPLE_NO` | NUMBER, 默认1。FIRST首件N个样本时为1..N, MID/LAST为1。(包含在列表查询中但表格不显示) |
| 请求日期时间 | `CREATED_AT` | `CreateDateColumn`。委托时间。列表排序(ASC)基准。 |
| (检验完成时间) | `INSPECTED_AT` | timestamp, nullable。**迁移为非PENDING状态时(`status !== 'PENDING'`)以`new Date()`设置**。未判定则为null。 |
| (生产数量) | `PROD_QTY_AT_INSPECT` | NUMBER, nullable。检验时生产数量(Kiosk加载值)。本界面不显示。 |
| (设备) | `EQUIP_CODE` | varchar2(50), nullable。检验设备代码。本界面不显示。 |
| (检验员) | `INSPECTOR_ID` | varchar2(50), nullable。本界面不显示。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `UPDATED_AT` | 创建/修改用户·修改时间。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'` 范围。列表·判定均应用范围过滤。 |

---

## ② 检验基准(JOIN显示) — SELF_INSPECT_ITEMS (从待处理列表获取的列)

待处理列表从项目主表LEFT JOIN以下列构成右侧输入区域的"检验基准"。

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| (项目类型) | `ITEM_TYPE` | `MEASURE`(计量型) / `VISUAL`(判定型)。MEASURE但无规格时显示"未设置规格(LSL/USL)", VISUAL则显示"判定型项目(无规格)"。默认值`VISUAL`。 |
| LSL | `LSL_VALUE` | NUMBER, nullable。规格下限。LSL/USL中任一存在时检验基准框中显示数值。 |
| USL | `USL_VALUE` | NUMBER, nullable。规格上限。 |
| 单位 | `UNIT` | varchar2(20), nullable。测量单位(mm, N等)。仅存在时显示。 |
| 基准/规格 | `STANDARD` | varchar2(500), nullable。文本基准。仅存在时显示。 |

> `INSPECT_ITEM_ID`为null或无匹配项目主表时(LEFT JOIN miss)，LSL/USL/单位/基准为空，显示"无规格"。计量型项目但规格为空时需在项目主表中填写LSL/USL。

---

## 判定逻辑 (PATCH /results/:id/status)
1. 通过`id` + COMPANY/PLANT_CD范围查询结果记录。不存在返回404(`SelfInspectResult {id} not found`)。
2. 将`STATUS`改为请求值(`PASS`/`FAIL`)。
3. 传递`remark`时更新`REMARK`，传递`measureValue`时更新`MEASURE_VALUE`(undefined则保持原有)。
4. `status !== 'PENDING'`时设置`INSPECTED_AT = 当前时间`(= 检验完成时间记录)。
5. 保存。响应消息`状态已变更为{status}`。

> 合格/不合格判定并非LSL/USL自动比较，而是**负责人手动判定**。界面将PASS/FAIL按钮点击值直接反映到STATUS(规格仅供参考显示)。

## 预设条件 (主表)
- 在工序自检项目主表(`SELF_INSPECT_ITEMS`)中设置该项目的`INSPECT_METHOD='DELEGATE'` → Kiosk将生成PENDING结果而非直接判定。
- 计量型项目填写`ITEM_TYPE='MEASURE'` + `LSL_VALUE`/`USL_VALUE`/`UNIT`，本界面将显示规格。
- 项目主表登记·修改通过自检项目管理API(`/production/self-inspect/items`)执行。

## 操作流程
1. 进入界面时自动调用`GET /delegates` → 加载待处理列表(按时间升序)。
2. 选择项目 → 测量 → 输入测量值/备注 → PASS/FAIL。
3. 判定后列表自动重新查询，已处理记录移除。
4. 大量积压时按工单逐条处理，优先解除该工单的Kiosk阻止。

## 权限
需要JWT认证(`JwtAuthGuard`)。质量负责人执行判定。多租户范围(COMPANY/PLANT_CD)从令牌上下文中注入。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| Kiosk实绩输入被阻止 | 该工单存在`DELEGATE`+`PENDING`结果 | 在本界面对目标项目进行PASS/FAIL判定 → 解除待处理 |
| 待处理列表中无项目 | 是直接检验(DIRECT)或已PASS/FAIL处理，或属于其他COMPANY/PLANT范围 | 确认是否为委托检验项目，以及是否当前站点范围 |
| LSL/USL·单位为空 | 项目为VISUAL或`INSPECT_ITEM_ID`匹配项目未设置规格/JOIN miss | 计量型则在项目主表中输入LSL/USL/UNIT |
| 判定时404 | 其他范围的ID或已删除 | 确认是否为当前站点(COMPANY=40/PLANT=1000)数据后重新查询 |
| 测量值未保存 | 空字符串不被发送(undefined) | 输入数字后点击判定按钮 |

## 数据·关联
- 表: `SELF_INSPECT_RESULTS`(结果·状态), `SELF_INSPECT_ITEMS`(检验基准JOIN)。
- API: `GET /production/self-inspect/delegates`, `PATCH /production/self-inspect/results/:id/status`。关联: `GET /pending/:orderNo`(Kiosk阻止判断), `POST /results`(Kiosk委托加载)。
- 关联界面: 生产Kiosk(自检委托·实绩阻止), 自检项目管理(`SELF_INSPECT_ITEMS`)。
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`。

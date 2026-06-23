---
menuCode: INSP_RESULT
audience: operator
title: 导通检查 — 操作指南
summary: 成品导通(Continuity)检查 — 选择检查仪·查询作业指示·PASS/FAIL判定·FG条码发行·电路标签扫描·耗材安装·标签补打/废弃/重检
tags: [质量, 导通检查, 检查, 操作]
keywords: [INSPECT_RESULTS, FG_LABELS, CONTINUITY_DEFECT, FG_BARCODE, CIRCUIT_LABEL, PASS_YN, ERROR_CODE, TESTER, CONSUMABLE, JOB_ORDERS, 导通检查, 连续性检查, FG条码, 电路标签, 检查仪, 耗材, 补打, 废弃, 重检, 合格, 不合格]
related: [QC_INSPECT, SHIP_PACK]
---

# 导通检查 — 操作指南

## 系统目的·角色
执行成品(FG)**导通(Continuity)检查**的界面。选择检查仪(Tester)，按作业指示单位发行·检查FG条码。PASS/FAIL判定的同时生成FG标签，需确认耗材安装状态后方可检查。

```
FG发行 → 检查仪连接 → 导通检查(PASS/FAIL) → FG_LABELS (ISSUED) → 外观检查
```

## 数据结构
```
JOB_ORDERS (PK: ORDER_NO)
   ├─ 生产实绩(PROD_RESULTS) → FG_LABELS (条码发行)
   └─ CONSUMABLES (耗材映射)

FG_LABELS (PK: FG_BARCODE)
   状态转移: ISSUED → VISUAL_PASS/FAIL → PACKED → SHIPPED
   导通检查PASS时以ISSUED状态创建 → 外观检查(VISUAL)转移至VISUAL_PASS

INSPECT_RESULTS (PK: RESULT_NO)
   导通检查结果存储 (INSPECT_TYPE='CONTINUITY')
```

## 界面布局
左侧4 / 右侧8列网格:

### 左侧面板 (4/12)
- **检查仪选择**下拉框: `GET /equipment/equips/type/TESTER` — localStorage中保持选择
- **作业指示列表**: `GET /quality/continuity-inspect/job-orders`
  - 作业指示编号·物料代码·物料名·计划数量/良品/不良
  - 状态徽章(`JOB_ORDER_STATUS`公共代码)
  - 搜索: 作业指示编号·物料代码·物料名 (300ms防抖)
- **耗材面板** (`ConsumablePanel`): 映射到所选作业指示+检查仪的耗材列表
  - 扫描耗材UID条码 → 安装
  - 未安装时检查被阻断

### 右侧面板 (8/12)
- `InspectPanel` — 检查执行界面
- **FG条码发行记录** DataGrid: `GET /quality/continuity-inspect/fg-labels/{orderNo}`
  - FG条码·发行时间·状态·补打次数·inspectPassYn
  - 标签恢复操作: 重检(仅FAIL) / 补打 / 废弃
- **PASS/FAIL按钮** (大型切换)
- **扫描模式** (可配置): 先扫描产品条码 + 电路标签后才能PASS

## 检查流程

### ① 选择检查仪
`GET /equipment/equips/type/TESTER`
- 未选择检查仪时所有检查被阻断
- 选择值在`localStorage` (`hanes:inspection:equip:CONTINUITY`)中保持

### ② 选择作业指示
`GET /quality/continuity-inspect/job-orders?finishedOnly=true`
- 仅显示成品作业指示 (`finishedOnly=true`)
- 选择时确认耗材安装状态

### ③ 安装耗材
`POST /production/job-orders/{orderNo}/consumables/scan { conUid, equipCode }`
- 扫描耗材UID条码 → 自动安装
- 解除安装: `DELETE /production/job-orders/{orderNo}/consumables/{mountedConUid}`
- 耗材未安装时检查被阻断

### ④ PASS/FAIL检查
`POST /quality/continuity-inspect/inspect { orderNo, itemCode, equipCode, passYn, ... }`
- **PASS**: FG条码自动发行 + FG_LABELS以`ISSUED`状态创建
- **FAIL**: `FailModal` → 缺陷代码(`CONTINUITY_DEFECT`) + 详细原因 → 记录在`INSPECT_RESULTS`(不生成FG_LABELS)
- 扫描模式(可选): 需先扫描产品条码 + 电路标签(`CIRCUIT_LABEL`)后才能PASS

### ⑤ 标签后续措施
- **重检**(Re-inspect): `POST /quality/continuity-inspect/re-inspect/{barcode}` — FAIL→PASS转换
- **补打**(Reprint): `POST /quality/continuity-inspect/reprint/{barcode}` — 增加补打次数
- **废弃**(Void): `POST /quality/continuity-inspect/void/{barcode}` — FG_LABELS → `VOIDED`

## 互锁 (检查阻断条件)
所有条件均满足时PASS/FAIL按钮才激活:

| 条件 | 消息 | 解决 |
|------|--------|------|
| 选择检查仪 | 检查前请选择检查仪 | 从检查仪下拉框中选择 |
| 耗材安装完成 | N个耗材未安装 | 扫描耗材UID安装 |
| 条码扫描 (扫描模式) | 请先扫描条码 | 扫描产品条码 |
| 电路标签扫描 (扫描模式·PASS) | 合格请扫描电路标签 | 扫描CIRCUIT_LABEL |

## 全部列 — INSPECT_RESULTS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 检查编号 | `RESULT_NO` | PK。SeqGenerator自动编号(`INSPECT_RESULT`)。 |
| FG条码 | `FG_BARCODE` | 参照`FG_LABELS.FG_BARCODE`。 |
| 检查类型 | `INSPECT_TYPE` | `CONTINUITY`(导通检查)。 |
| 检查范围 | `INSPECT_SCOPE` | `FULL`(全数)。导通检查始终为全数。 |
| 合格与否 | `PASS_YN` | Y/N。 |
| 缺陷代码 | `ERROR_CODE` | 公共代码`CONTINUITY_DEFECT`。不合格时必须。 |
| 详细原因 | `ERROR_DETAIL` | 不合格详细文本。 |
| 电路标签 | `CIRCUIT_LABEL` | 设备输出二维码(扫描模式PASS时映射)。 |
| 检查数据 | `INSPECT_DATA` | CLOB。附加检查数据JSON。 |
| 检查时间 | `INSPECT_TIME` | 检查时点。Default CURRENT_TIMESTAMP。 |
| 检查员 | `INSPECTOR_ID` | 检查执行者。 |
| 设备代码 | `EQUIP_CODE` | 检查仪(TESTER)设备代码。 |
| 生产实绩 | `PROD_RESULT_ID` | 参照`PROD_RESULTS.RESULT_NO`。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000`范围。 |

## 耗材状态

| 显示 | 含义 | 措施 |
|------|------|------|
| 绿色边框 + CheckCircle | 已正常安装 | 可进行检查 |
| 橙色边框 + AlertTriangle | 达到警告次数 | 考虑更换耗材 |
| 红色边框 + AlertCircle | 超过预期寿命 | 立即更换 |
| 红色边框 + AlertCircle (未安装) | 未安装 | 扫描UID安装 |

## 预设条件 (主表·公共代码)
- 公共代码: `CONTINUITY_DEFECT`(导通检查缺陷代码), `JOB_ORDER_STATUS`, `TESTER`(设备类型)
- 设备主表: 需注册`EQUIPMENTS.equipType='TESTER'`的检查仪
- 耗材映射: 需预先映射到作业指示物料+检查仪组合
- FG_LABELS: 需要`SEQ_FG_BARCODE`序列

## 权限
质量检查员(执行导通检查/标签管理)。管理员可修改/删除检查记录。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 检查仪列表为空 | `EQUIPMENTS`中没有TESTER类型设备 | 在设备主表中注册TESTER |
| 作业指示列表为空 | 没有成品作业指示 | 确认生产计划和作业指示 |
| PASS按钮禁用 | 耗材未安装或设备未选择 | 确认互锁条件 |
| 耗材扫描失败 | UID无效或未映射 | 确认UID和映射 |
| FG条码未发行 | `SEQ_FG_BARCODE`序列问题 | 确认序列状态 |
| 补打时未打印 | 打印机连接或bwip-js错误 | 确认打印机和浏览器打印设置 |
| 废弃按钮禁用 | 已是PACKED/SHIPPED/VOIDED状态 | 确认当前状态 |
| 重检按钮禁用 | FG不是FAIL状态 | PASS状态不需要重检 |

## 数据·关联
- 表: `INSPECT_RESULTS`, `FG_LABELS`, `JOB_ORDERS`, `PROD_RESULTS`, `CONSUMABLES`
- 关联: 外观检查(`/quality/inspect`), 产品包装(`/shipping/pack`), 设备管理(检查仪), 耗材管理, 追踪管理(`/quality/trace`)
- FG条码编号: Oracle `SEQ_FG_BARCODE`
- 检查编号生成: `SEQ_RULES`代码`INSPECT_RESULT`
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`

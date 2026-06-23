---
menuCode: QC_INSPECT
audience: operator
title: 外观检查 — 操作指南
summary: 基于FG条码扫描的外观检查 — 合格/不合格判定, 缺陷代码输入, FG_LABELS状态转移(ISSUED→VISUAL_PASS/FAIL), INSPECT_RESULTS自动生成
tags: [质量, 检查, 外观, 操作]
keywords: [INSPECT_RESULTS, FG_LABELS, FG_BARCODE, VISUAL_DEFECT, PASS_YN, ERROR_CODE, VISUAL_PASS, VISUAL_FAIL, INSPECT_TYPE, 外观检查, FG条码, 合格, 不合格, 缺陷代码, 检查实绩]
related: [INSP_RESULT]
---

# 外观检查 — 操作指南

## 系统目的·角色
登记·查询成品(FG)**外观检查**结果的界面。扫描FG条码判定合格/不合格，不合格时记录缺陷代码和详细原因。

| 检查结果 | FG_LABELS状态转移 | 说明 |
|-----------|-------------------|------|
| 合格(PASS) | `ISSUED` → `VISUAL_PASS` | 外观良好，可进入下一工序(包装) |
| 不合格(FAIL) | `ISSUED` → `VISUAL_FAIL` | 发现缺陷，需重新检查或废弃 |

## 数据结构
```
FG_LABELS (PK: FG_BARCODE)
   状态转移: ISSUED → VISUAL_PASS/VISUAL_FAIL → PACKED → SHIPPED
   外观检查通过→VISUAL_PASS, 不合格→VISUAL_FAIL

INSPECT_RESULTS (PK: RESULT_NO, SeqGenerator INSPECT_RESULT)
   ├─ FG_BARCODE ─▶ FG_LABELS (扫描的FG条码)
   ├─ PASS_YN: Y/N (合格/不合格)
   ├─ ERROR_CODE: 缺陷代码 (公共代码 VISUAL_DEFECT)
   └─ INSPECT_TYPE: 'VISUAL'
```

## 界面布局
- **左侧主区域**: DataGrid — 检查记录列表(FG条码·判定·缺陷代码·检查时间·检查员)
  - 统计摘要: 总件数, 检查完成, 未检查, 合格率
  - 搜索: 作业指示编号·物料代码, 状态·判定筛选
  - FG标签选择模态框: `FgLabelSelectModal` — 从ISSUED状态的FG列表中选择
- **右侧滑动面板**: `InspectFormPanel` — 检查登记表单 (扫描条码时自动打开)
  - 产品信息: FG条码·物料代码·作业指示·设备代码·状态 (只读)
  - 合格/不合格按钮 (大型切换)
  - 缺陷检查清单: `VISUAL_DEFECT`公共代码缺陷项目复选框 + 数量
  - 代表缺陷代码: `VISUAL_DEFECT`选择
  - 详细原因: 自由文本输入

## 检查流程

### ① 扫描FG条码
`GET /quality/continuity-inspect/fg-label/{barcode}`
- 在扫描输入框中输入条码 → Enter
- 查询FG_LABELS → 显示产品信息 + 打开右侧面板
- 已检查完成的标签(`status !== ISSUED`): `检查已完成`警告 + 保存按钮禁用

### ② 合格/不合格判定
`POST /quality/continuity-inspect/visual-inspect/{fgBarcode}`
- **合格(PASS)**: 点击大型绿色按钮 → 以`passYn: "Y"`保存
- **不合格(FAIL)**: 点击大型红色按钮 → 输入缺陷代码·详细原因 → 保存
- 事务处理: `InspectResult`创建 + `FgLabel.status`更新 (原子操作)

### ③ 确认结果
- 检查记录DataGrid自动更新
- FG_LABELS状态变为`VISUAL_PASS`或`VISUAL_FAIL`
- `VISUAL_PASS` → 可在包装工序(`/shipping/pack`)中装箱
- `VISUAL_FAIL` → 重新检查或废弃处理

## 全部列 — INSPECT_RESULTS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 检查编号 | `RESULT_NO` | PK。SeqGenerator自动编号(`INSPECT_RESULT`)。 |
| FG条码 | `FG_BARCODE` | 参照`FG_LABELS.FG_BARCODE`。扫描输入值。 |
| 检查类型 | `INSPECT_TYPE` | `VISUAL`(外观检查)。本画面生成的记录均为VISUAL。 |
| 检查范围 | `INSPECT_SCOPE` | `FULL`(全数)。外观检查始终为全数检查。 |
| 合格与否 | `PASS_YN` | Y/N。 |
| 缺陷代码 | `ERROR_CODE` | 公共代码`VISUAL_DEFECT`。不合格时必须。 |
| 详细原因 | `ERROR_DETAIL` | 不合格详细文本。 |
| 检查数据 | `INSPECT_DATA` | CLOB。缺陷检查清单JSON等附加数据。 |
| 检查时间 | `INSPECT_TIME` | 检查时点。Default CURRENT_TIMESTAMP。 |
| 检查员 | `INSPECTOR_ID` | 检查执行者。 |
| 设备代码 | `EQUIP_CODE` | 检查设备代码 (外观检查可选)。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000`范围。 |

## FG_LABELS状态转移

| 状态 | 含义 | 下一状态 |
|------|------|-----------|
| `ISSUED` | 标签已发行，未检查 | `VISUAL_PASS`或`VISUAL_FAIL` |
| `VISUAL_PASS` | 外观检查合格 | `PACKED` (包装) |
| `VISUAL_FAIL` | 外观检查不合格 | 重新检查(返回ISSUED)或废弃 |
| `PACKED` | 包装完成 | `SHIPPED` (出货) |
| `SHIPPED` | 已出货 | 终端状态 |
| `VOIDED` | 已废弃 | 终端状态 |

## 预设条件 (主表·公共代码)
- 公共代码: `VISUAL_DEFECT`(外观缺陷代码) — 用于缺陷代码选择和检查清单
- FG_LABELS: 需先在连续性检查(`/inspection/result`)或FG发行画面中以`ISSUED`状态创建
- INSPECT_RESULTS: SeqGenerator `INSPECT_RESULT`需在SEQ_RULES中注册

## 权限
质量检查员(外观检查登记/查询)。管理员可修改/删除(仅当关联生产实绩为CANCELED状态时才可删除)。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 条码扫描无查询结果 | 条码不在FG_LABELS中 | 确认FG条码已发行或使用标签选择模态框 |
| 检查保存被阻止 — 已检查 | `FG_LABELS.status`不是ISSUED | 不允许重复检查 |
| 不合格时无法选择缺陷代码 | `VISUAL_DEFECT`公共代码未注册 | 在公共代码中注册外观缺陷代码 |
| 最近检查不在列表中 | 自动刷新前 | DataGrid保存后自动更新，也可手动刷新 |
| FG选择模态框中无标签 | 所有FG均非ISSUED状态 | 确认目标FG为ISSUED状态 |
| 检查实绩无法删除 | 生产实绩不是CANCELED状态 | 仅在取消生产实绩后可删除 |

## 数据·关联
- 表: `INSPECT_RESULTS`, `FG_LABELS`
- 关联: 连续性检查(`/inspection/result`), 产品包装(`/shipping/pack`), 缺陷代码管理(`/quality/defect-code`), 追踪管理(`/quality/trace`)
- 检查编号生成: `SEQ_RULES`代码`INSPECT_RESULT`
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`

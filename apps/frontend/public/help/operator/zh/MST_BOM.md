---
menuCode: MST_BOM
audience: operator
title: BOM管理 — 操作指南
summary: BOM_MASTERS全部列·复合键, 递归展开, Excel上传, 物料/工艺路线关联, 故障排除
tags: [标准信息, BOM, 物料清单, 操作]
keywords: [BOM_MASTERS, PARENT_ITEM_CODE, CHILD_ITEM_CODE, REVISION, QTY_PER, OPER, 递归展开, Excel上传, ECO_NO, 多租户]
related: [MST_PART]
---

# BOM管理 — 操作指南

## 系统目的·角色
定义父-子物料组成的**`BOM_MASTERS`**管理界面。是生产时材料需求量展开(需求计算)·投入的基准，通过自引用(子物料再次成为父)结构表达多级BOM。

## 数据结构
```
BOM_MASTERS (复合PK: PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION)
   ├─ PARENT_ITEM_CODE ─▶ ITEM_MASTERS (父物料)
   └─ CHILD_ITEM_CODE  ─▶ ITEM_MASTERS (子物料) ─▶ (子物料作为父递归) BOM_MASTERS
```
- **复合PK**: `PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION` (无UUID id)。
- 树查询API: `GET /master/boms/hierarchy/:parentPartId` (递归展开)。

## 全部列 — BOM_MASTERS

| 界面项目 | DB列 | 含义 · 操作要点 |
|------|------|------|
| 父物料 | `PARENT_ITEM_CODE` | PK。引用`ITEM_MASTERS.ITEM_CODE`。 |
| 子物料代码 | `CHILD_ITEM_CODE` | PK。引用`ITEM_MASTERS.ITEM_CODE`。 |
| 修订号 | `REVISION` | PK。默认`A`。区分配置版本。 |
| 用量 | `QTY_PER` | NUMBER(10,4)。每个父物料所需子物料数量。 |
| 序号 | `SEQ` | 显示/处理顺序(默认0)。 |
| BOM组 | `BOM_GRP` | 组分类(有索引)。 |
| 工序 | `OPER` | 投入工序代码(实体字段名processCode)。 |
| 面 | `SIDE` | 适用面(TOP/BOT等)。 |
| ECO号 | `ECO_NO` | 设计变更跟踪号。 |
| 有效起始 | `VALID_FROM` | DATE。适用开始日期。 |
| 有效终止 | `VALID_TO` | DATE。适用结束日期(期外不适用)。 |
| 备注 | `REMARK` | 备注。 |
| 使用与否 | `USE_YN` | 仅Y为有效配置。 |
| 子物料名称/类型 | (关联) | `ITEM_MASTERS.ITEM_NAME / ITEM_TYPE` — 显示·展开判断用(BOM_MASTERS中不存在)。 |
| 层级(Lv) | (计算) | 树深度。非存储值。 |
| 审计 | `CREATED_BY/UPDATED_BY/CREATED_AT/UPDATED_AT` | 记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000` 范围。 |

## Excel上传
- 通过Excel模板批量登记多条BOM(上传模态框)。父/子物料代码需存在于`ITEM_MASTERS`，键(父+子+修订号)重复时遵循拒绝/更新策略。

## 递归展开 / 工艺路线关联
- 子物料为半成品时，以该子物料为父继续展开下级BOM(多级)。生产需求展开沿递归累积计算。
- 通过各BOM行的`OPER`(工序)关联材料在哪个工序投入，与工艺路线一同查看。

## 预设条件
- `ITEM_MASTERS`中父/子物料需先注册。
- 工序代码(OPER)基于工序主表。

## 权限
标准信息管理员(登记/修改/上传)。普通用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 添加子物料时代码错误 | 子物料不在ITEM_MASTERS中 | 先在物料主表中登记 |
| 同一子物料添加被拒绝 | 父+子物料+修订号键重复 | 使用不同修订号或修改已有行 |
| 树中子物料未展开 | 子物料自身的BOM未登记 | 以子物料为父登记下级BOM |
| 生产展开数量不符 | QTY_PER输入错误/有效期外 | 确认用量·VALID_FROM/TO |
| 配置未生效 | USE_YN='N'或有效期已过 | 检查USE_YN·有效期 |

## 数据·关联
- 表: `BOM_MASTERS`
- 关联: 物料主表(`ITEM_MASTERS`), 工序/工艺路线(OPER), 生产需求量展开
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`

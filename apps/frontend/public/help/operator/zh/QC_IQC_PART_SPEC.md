---
menuCode: QC_IQC_PART_SPEC
audience: operator
title: 按物料IQC项目管理 — 操作指南
summary: 按物料IQC检验基准(头/检验项目)的全部列·DB映射, 检验类型·样本方式逻辑, 检验项目池·AQL关联与故障排除
tags: [质量, IQC, 入库检验, 操作, 标准信息]
keywords: [IQC_PART_SPECS, IQC_PART_SPEC_ITEMS, IQC_ITEM_POOL, 检验项目, 检验类型, 样本方式, INSPECTION_TYPE, SAMPLE_METHOD, DESTRUCTIVE, FULL, AQL, FIXED, LSL, USL, 不良等级, 检验水平, 多租户, 故障排除]
related: [QC_IQC_ITEM, QC_AQL, MST_PART, QC_IQC]
---

# 按物料IQC项目管理 — 操作指南

## 系统目的·角色
按原材料物料定义**入库检验(IQC)检验基准书**。一次性保存头(样本数·破坏性检验与否)和N条检验项目(引用检验项目池 + 规格·不良等级·样本方式)，该基准成为入库检验界面的检验表和AQL判定的输入。检验项目自身的定义在检验项目池(`IQC_ITEM_POOL`)中，样本数·合格/不合格阈值(Ac/Re)由AQL策略/基准提供。

## 数据结构
```
IQC_PART_SPECS (头: COMPANY+PLANT_CD+ITEM_CODE)
        │ 1:N (CASCADE)
        ▼
IQC_PART_SPEC_ITEMS (检验项目: +SEQ)
        │ (引用INSP_ITEM_CODE, eager)
        ▼
IQC_ITEM_POOL (检验项目池: 名称·判定方法·单位)

ITEM_MASTERS.IQC_AQL_POLICY_CODE ──▶ AQL策略/基准 (摘要卡·自动样本数计算)
```

---

## ① 检验基准头 — IQC_PART_SPECS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 物料代码 | `ITEM_CODE` | PK部分。从左侧列表选择的原材料物料。通过`/master/parts?itemType=RAW_MATERIAL`查询。 |
| 基本样本数 | `SAMPLE_QTY` | 按项目无固定样本数时的默认样本个数。默认值1。 |
| 破坏性检验与否 | `IS_DEST` | `Y`=破坏性检验 / `N`=非破坏性。表示样本消耗与否。 |
| 使用与否 | `USE_YN` | 仅`Y`为检验对象。默认`Y`。 |
| 审计列 | `CREATED_BY`/`UPDATED_BY`/`CREATED_AT`/`UPDATED_AT` | 创建·修改记录。`CREATED_AT`/`UPDATED_AT`为DB DEFAULT SYSTIMESTAMP。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK部分。`COMPANY='40'`, `PLANT_CD='1000'` 范围。 |

> 保存为**头+项目整体一次性POST**(`/master/iqc-part-specs`)的upsert方式。项目每次保存重新构建，`INSP_ITEM_CODE`为空的行被排除。

---

## ② 检验项目 — IQC_PART_SPEC_ITEMS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 顺序 | `SEQ` | PK部分。保存时从1重新赋予。 |
| 检验项目 | `INSP_ITEM_CODE` | 引用`IQC_ITEM_POOL.INSP_ITEM_CODE`(eager)。种类·单位从池中获取。 |
| 种类 | (池的`judgeMethod`) | `MEASURE`(计量型)=LSL/USL比较 / `VISUAL`(判定型)=判定基准。本表不存储，由池决定。 |
| 检验类型 | `INSPECTION_TYPE` | 公共代码`IQC_ITEM_INSP_TYPE`。`AQL`/`DESTRUCTIVE`/`FULL`。**NULL视为AQL**。 |
| 样本方式 | `SAMPLE_METHOD` | 公共代码`IQC_SAMPLE_METHOD`。`AQL`(自动)/`FIXED`(固定)。检验类型为AQL时设为`AQL`，其他自动设为`FIXED`。**NULL=AQL**。 |
| 样本数 | `SAMPLE_QTY` | FIXED/DESTRUCTIVE/FULL的固定样本个数(每LOT)。AQL则为NULL(自动计算)。 |
| 不良等级 | `DEFECT_GRADE` | 公共代码`DEFECT_GRADE`。`CRITICAL`/`MAJOR`/`MINOR`。AQL判定时按等级别应用Ac/Re。 |
| 检验水平 | `INSPECTION_LEVEL` | 公共代码`AQL_INSP_LEVEL`(II, S4等)。决定样本大小。 |
| AQL | `AQL` | 公共代码`AQL_VALUE`(0.65/1.0/2.5等)。合格质量界限。越小越严格。 |
| 下限(LSL) | `LSL` | 计量型允许最小值。低于此值为不良。NUMBER(12,4)。 |
| 上限(USL) | `USL` | 计量型允许最大值。超过此值为不良。NUMBER(12,4)。 |
| 判定基准 | `JUDGE_CRITERIA` | 判定型合格·不合格基准文本(最大500字)。 |
| 使用与否 | `USE_YN` | 仅`Y`适用。 |
| 单位 | (池的`unit`) | 仅显示。从池中获取。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK部分。`40` / `1000` 范围。 |

---

## 检验类型·样本方式逻辑
- **变更检验类型(INSPECTION_TYPE)时样本方式联动**。选择`AQL`时`SAMPLE_METHOD='AQL'` + `SAMPLE_QTY=NULL`(自动计算)，其他(`DESTRUCTIVE`/`FULL`)选择时切换为`SAMPLE_METHOD='FIXED'`，**直接输入样本数**。
- **种类(judgeMethod)由检验项目池决定**。仅`MEASURE`时LSL/USL输入栏打开，`VISUAL`通过判定基准管理。
- AQL摘要卡的样本数·Ac/Re并非来自此表，而是来自**物料的AQL策略**(`/quality/aql/resolve-iqc-items`)按LOT数量计算的参考值。

## 预设条件 (主表·公共代码)
- 公共代码: `DEFECT_GRADE`(不良等级), `AQL_INSP_LEVEL`(检验水平), `AQL_VALUE`(AQL值), `IQC_ITEM_INSP_TYPE`(检验类型), `IQC_SAMPLE_METHOD`(样本方式)
- 主表: 检验项目池(`IQC_ITEM_POOL`, `USE_YN='Y'`), 原材料物料(`ITEM_MASTERS` itemType=RAW_MATERIAL), 物料的AQL策略关联(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)

## 操作流程
1. 先在[检验项目池]中登记项目(名称·判定方法·单位)。
2. 选择物料 → 设置头(样本数·破坏性检验与否) → 添加检验项目(或应用模板)。
3. 输入按项目的检验类型·不良等级·检验水平·AQL·规格(LSL/USL或判定基准)后保存。
4. 在[物料主表]中关联AQL策略后，摘要卡和入库检验自动样本数将填充。

## 权限
质量管理员(基准登记/修改)。普通用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 检验项目选择列表为空 | 检验项目池未登记或`USE_YN='N'` | 在[检验项目池]中登记·激活项目 |
| 保存后项目消失 | `INSP_ITEM_CODE`未选择的行被排除保存 | 每行都选择检验项目后保存 |
| LSL/USL输入栏未打开 | 项目种类为`VISUAL`(判定型) | 通过判定基准输入，或在池中更换为`MEASURE`项目 |
| 样本数仅显示`自动` | 检验类型为`AQL` | 如需固定样本请改为`DESTRUCTIVE`/`FULL` |
| AQL摘要卡全部为`-` | 物料未关联AQL策略 | 在[物料主表]中指定AQL策略 |
| 看到/看不到其他工厂数据 | `COMPANY`/`PLANT_CD`范围 | 确认`40`/`1000`范围 |

## 数据·关联
- 表: `IQC_PART_SPECS`(头), `IQC_PART_SPEC_ITEMS`(项目, CASCADE)
- 引用: `IQC_ITEM_POOL`(检验项目池), `ITEM_MASTERS`(物料·AQL策略)
- 关联: 检验项目池, AQL基准管理(摘要·样本数计算), 入库检验(IQC)检验执行
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`

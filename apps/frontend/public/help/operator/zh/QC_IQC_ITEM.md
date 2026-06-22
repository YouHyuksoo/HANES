---
menuCode: QC_IQC_ITEM
audience: operator
title: 检验项目主表
summary: 管理IQC全局检验项目池(IQC_ITEM_POOL)的界面操作指南。说明界面项目↔DB列映射, 判定方法值, 关联界面。
tags: [质量, IQC, 入库检验, 检验项目, 标准信息, 操作指南]
keywords: [IQC_ITEM_POOL, 检验项目池, INSP_ITEM_CODE, INSP_ITEM_NAME, JUDGE_METHOD, LSL, USL, CRITERIA, USE_YN, 判定方法, 目视, 计量, 单位, UNIT_TYPE, 多租户]
related: [QC_IQC_PART_SPEC, QC_IQC, QC_AQL]
---

# 检验项目主表 — 操作指南

## 系统目的·角色
入库检验(IQC)体系的**公用检验项目池**。在此界面登记的项目被[按物料IQC项目管理](/master/iqc-part-spec)引用，为各物料配置检验哪些项目及规格。即**项目的定义(此处) ↔ 按物料适用·规格(按物料IQC项目管理)** 的责任分离。

## 数据结构
```
IQC_ITEM_POOL (检验项目池 · 本界面)
   └─ 以INSP_ITEM_CODE引用 ─▶ IQC_PART_SPEC_ITEMS (按物料检验项目明细)
                                 └─ IQC_PART_SPECS (按物料IQC基准头)
```
- 本界面API: `GET/POST/PUT/DELETE /master/iqc-item-pool`
- 键: `INSP_ITEM_CODE` (+ 多租户`COMPANY`/`PLANT_CD`)

## ① 检验项目 — IQC_ITEM_POOL (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|---|---|---|
| **项目代码** | `INSP_ITEM_CODE` | 检验项目标识键(NOT NULL)。仅在界面新增时输入，修改时锁定。按物料明细以此代码引用，使用中的代码删除需谨慎。 |
| **检验项目** | `INSP_ITEM_NAME` | 检验项目名(NOT NULL)。 |
| **判定方法** | `JUDGE_METHOD` | NOT NULL。界面选择值 **VISUAL=目视 / MEASURE=计量**。(DB列注释中残留NUMERIC/VISUAL/GONOGG标记，但本界面使用的值为VISUAL·MEASURE。) |
| **单位** | `UNIT` | 计量单位(NULL允许)。从公共代码`UNIT_TYPE`选择。用于计量项目。 |
| (界面不编辑) | `CRITERIA` | 判定基准文本。本界面不输入 — 按物料规格在IQC_PART_SPEC_ITEMS中管理。 |
| (界面不编辑) | `LSL` / `USL` | 下/上限规格值(NUMBER)。本界面不编辑(按物料规格在按物料IQC项目管理)。 |
| (界面不编辑) | `REVISION` | 修订号(NOT NULL)。 |
| (界面不编辑) | `EFFECTIVE_DATE` | 有效日期。 |
| (界面不编辑) | `USE_YN` | 使用与否(NOT NULL, 默认Y)。本界面无切换UI，通过删除管理。 |
| (界面不编辑) | `REMARK` | 备注。 |
| 范围 | `COMPANY` / `PLANT_CD` | 多租户范围(NOT NULL)。默认`40` / `1000`。 |
| 审计 | `CREATED_BY` `UPDATED_BY` `CREATED_AT` `UPDATED_AT` | 登记/修改跟踪。CREATED_AT/UPDATED_AT为NOT NULL(SYSTIMESTAMP默认)。 |

> 本界面表单仅直接编辑`INSP_ITEM_CODE / INSP_ITEM_NAME / JUDGE_METHOD / UNIT` 4项。其余(CRITERIA·LSL·USL·USE_YN等)以默认值创建，按物料规格在按物料IQC项目管理中设置。

## 判定方法(JUDGE_METHOD)值
| 值 | 界面标签 | 含义 |
|---|---|---|
| `VISUAL` | 目视 | 用目视判定合格/不合格(外观等)。无需单位。 |
| `MEASURE` | 计量 | 用计量仪器值比较规格(LSL/USL)。建议使用单位。 |

## 预设条件 (主表·公共代码)
- 公共代码`UNIT_TYPE` — 单位下拉框来源。缺少所需单位(mm, g, ㎏等)时先在[公共代码管理]中添加。

## 操作流程
1. `添加检验项目` → 输入项目代码·检验项目·判定方法(·单位) → 保存(`POST /master/iqc-item-pool`)。
2. 修改点击行✎ → 修改除代码外的字段(`PUT /master/iqc-item-pool/{code}`)。
3. 删除点击🗑 → 确认(`DELETE /master/iqc-item-pool/{code}`)。**按物料明细中正在使用时，删除前确认影响。**

## 权限
- 拥有标准信息主表登记权限者(质量/标准信息管理员)管理。

## 故障排除
| 症状 | 原因 | 措施 |
|---|---|---|
| 单位下拉框为空 | 公共代码`UNIT_TYPE`未登记 | 在公共代码管理中添加单位代码 |
| 保存按钮禁用 | 项目代码或检验项目未输入 | 输入必填的2项 |
| 项目代码不可修改 | 代码是键(修改锁定) | 删除后重新登记(需重新建立关联) |
| 删除后物料检验中项目消失 | 按物料明细引用该代码 | 删除前在按物料IQC项目管理中确认使用处 |

## 数据·关联
- 表: `IQC_ITEM_POOL`
- 关联界面: [按物料IQC项目管理](/master/iqc-part-spec)(引用此池), [入库检验(IQC)](/material/iqc)
- 多租户范围: `COMPANY='40'`, `PLANT_CD='1000'`

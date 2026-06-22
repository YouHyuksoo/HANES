---
menuCode: QC_DEFECT_CODE
audience: operator
title: 不良代码管理 — 操作指南
summary: 不良3级分类(检验阶段/型号区分/不良类型)与不良代码主表的全部列·DB映射, 型号区分公共代码关联, 等级/适用范围代码值, 操作流程与故障排除
tags: [质量, 不良代码, 操作, 主表, 设置]
keywords: [DEFECT_CODE_MASTERS, DEFECT_CATEGORY_MASTERS, DEFECT_CODE_PRODUCT_TYPES, DEFECT_MODEL_GROUP, DEFECT_LOGS, 不良等级, defectGrade, CRITICAL, MAJOR, MINOR, 适用范围, defectScope, RAW_MATERIAL, PRODUCT, PROCESS, COMMON, 检验阶段, IQC, LQC, OQC, 型号区分, LV, HV, 低压, 高压, 不良类型, 3级, 层级, COMPANY, PLANT_CD, 故障排除]
related: [QC_DEFECT, QC_AQL, MST_PART]
---

# 不良代码管理 — 操作指南

## 系统目的·角色
不良代码主表是检验(入库/工序/出货)和生产实绩不良登记中选择的**不良代码的唯一来源**。不良代码关联在**3级分类体系**(1级检验阶段 → 2级型号区分 → 3级不良类型)下的第3级，各代码具有**不良等级**、**适用范围**和**型号区分适用列表**。不良记录(`DEFECT_LOGS.DEFECT_CODE`)引用此代码。

## 数据结构 (3层 + 型号映射)
```
DEFECT_CATEGORY_MASTERS (自引用树, LEVEL_NO 1→2→3)
  1级检验阶段: IQC / LQC / OQC
    2级型号区分: {阶段}_LV / {阶段}_HV         (例如: IQC_LV)
      3级不良类型: {2级}_FUNCTION / _APPEARANCE / _ETC   (例如: IQC_LV_FUNCTION)
                              │ (CATEGORY_CODE, 仅3级关联)
                              ▼
DEFECT_CODE_MASTERS ──(DEFECT_CODE)──▶ DEFECT_CODE_PRODUCT_TYPES (按型号区分适用, 1:N)
                                              │ PRODUCT_TYPE = DEFECT_MODEL_GROUP代码(LV/HV)
DEFECT_LOGS.DEFECT_CODE ──(引用)──▶ DEFECT_CODE_MASTERS.DEFECT_CODE
```
- 2级代码按`{1级}_{型号区分}`规则命名(例如: `IQC_LV`)。界面从2级代码中去除前缀(`IQC_`)计算出型号区分(`LV`)，保存时将值记录到`DEFECT_CODE_PRODUCT_TYPES.PRODUCT_TYPE`中1条。

---

## ① 不良分类 — DEFECT_CATEGORY_MASTERS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 分类代码 | `CATEGORY_CODE` | PK。自引用树的节点键。命名规则: 1级`IQC`, 2级`IQC_LV`, 3级`IQC_LV_FUNCTION`。大写。 |
| 分类名称 | `CATEGORY_NAME` | 显示用名称(例如: `IQC`, `低压`, `功能`)。 |
| 分类级别 | `LEVEL_NO` | `1`=检验阶段, `2`=型号区分, `3`=不良类型。不良代码仅可关联3级。 |
| 上级分类 | `PARENT_CATEGORY_CODE` | 父节点(self FK `FK_DEFECT_CATEGORY_PARENT`)。1级为NULL。父级别必须为`当前-1`(服务器验证)。 |
| 排序顺序 | `SORT_ORDER` | 树显示顺序。 |
| 使用与否 | `USE_YN` | 仅`Y`在选项中显示·可关联。废弃分类设为`N`(软禁用)。 |
| 说明 | `DESCRIPTION` | 备注。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK部分。标准范围`COMPANY='40'`, `PLANT_CD='1000'`。 |
| (审计) | `CREATED_BY` / `UPDATED_BY` / `CREATED_AT` / `UPDATED_AT` | 登记·修改人/时间。 |

查询API `GET /quality/defect-codes/categories` 将平面行组装为树后返回。

---

## ② 不良代码 — DEFECT_CODE_MASTERS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 不良代码 | `DEFECT_CODE` | PK。`DEFECT_LOGS`引用的键。登记后不可变更(界面锁定)。大写归一化。 |
| 不良名称 | `DEFECT_NAME` | 显示用名称。必填。 |
| (3级)分类 | `CATEGORY_CODE` | 关联的3级分类代码。服务器验证为**`LEVEL_NO=3`且`USE_YN='Y'`**(`assertLeafCategory`)。界面列表的1·2·3级通过此代码追溯父级计算。 |
| 等级 | `DEFECT_GRADE` | `CRITICAL`=致命(安全·核心功能), `MAJOR`=重缺陷, `MINOR`=轻缺陷。默认`MAJOR`。检验合格·不合格·统计基准。 |
| 适用范围 | `DEFECT_SCOPE` | `COMMON`=通用, `RAW_MATERIAL`=原材料, `PRODUCT`=产品, `PROCESS`=工序。默认`COMMON`。`findOptions`中`defectScope`过滤时同时显示该范围+`COMMON`。 |
| 使用与否 | `USE_YN` | 仅`Y`在选项/检验中显示。停用(`DELETE` API)为`USE_YN='N'`软禁用。 |
| 说明 | `DESCRIPTION` | 备注(最大500字)。 |
| 排序顺序 | `SORT_ORDER` | 列表/选项排序键(ASC, 后按代码)。 |
| (型号区分适用) | — (单独表) | 从界面2级选择值计算出的型号区分(LV/HV)存入`DEFECT_CODE_PRODUCT_TYPES`。本表中无列。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK部分。`40` / `1000` 范围。 |
| (审计) | `CREATED_BY` / `UPDATED_BY` / `CREATED_AT` / `UPDATED_AT` | 登记·修改人/时间。 |

---

## ③ 型号区分适用映射 — DEFECT_CODE_PRODUCT_TYPES (全部列)

将1条不良代码映射N条适用型号区分(当前界面从2级计算出1条保存)。

| DB列 | 角色 / 含义 · 操作要点 |
|------|------|
| `COMPANY`, `PLANT_CD`, `DEFECT_CODE`, `PRODUCT_TYPE` | 复合PK。`PRODUCT_TYPE`为公共代码`DEFECT_MODEL_GROUP`的DETAIL_CODE(`LV`=低压, `HV`=高压)。 |
| `CREATED_BY`, `CREATED_AT` | 登记人/时间。 |

保存逻辑(`replaceProductTypes`): 删除该不良代码的现有映射后重新全部INSERT(全量替换)。界面从2级代码计算1条型号区分存入。

---

## 代码值整理 (选项·公共代码)

| 区分 | 值 | 含义 |
|------|------|------|
| 等级`DEFECT_GRADE` | CRITICAL / MAJOR / MINOR | 致命 / 重 / 轻 |
| 适用范围`DEFECT_SCOPE` | COMMON / RAW_MATERIAL / PRODUCT / PROCESS | 通用 / 原材料 / 产品 / 工序 |
| 型号区分`DEFECT_MODEL_GROUP`(公共代码) | LV / HV | 低压 / 高压 |
| 检验阶段(1级分类) | IQC / LQC / OQC | 入库检验 / 工序检验 / 出货检验 |
| 不良类型(3级分类) | FUNCTION / APPEARANCE / ETC | 功能 / 外观 / 其他 |

> 等级·适用范围通过界面枚举(服务器DTO `IsIn`)固定。仅型号区分通过公共代码(`DEFECT_MODEL_GROUP`)可扩展。

## 预设条件 (主表·公共代码)
- 公共代码`DEFECT_MODEL_GROUP`(LV/HV)登记 — 2级分类·型号区分映射的基准。
- 分类树: 先构建1级(IQC/LQC/OQC) → 2级(`{阶段}_LV`/`{阶段}_HV`) → 3级(`{2级}_FUNCTION`/`_APPEARANCE`/`_ETC`)。
- 使用与否`USE_YN`公共代码(界面使用与否选择)。

## 操作流程
1. 确认·登记`DEFECT_MODEL_GROUP`公共代码(LV/HV)。
2. 通过分类快速添加构建1→2→3级分类树(级别必须逐级一致才能保存)。
3. 登记不良代码: 选择1·2·3级 + 输入不良代码·不良名·等级·适用范围。2级选择值将作为型号区分映射保存。
4. 在[不良管理]·检验·生产实绩Kiosk中确认代码是否显示。
5. 废弃代码切换为停用(`USE_YN='N'`)(禁止删除)。

## 权限
质量管理员(分类·代码登记/修改/停用)。普通用户在检验·实绩中仅可查询·选择。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 保存时"请输入3级分类" | 1·2·3级未选全 | 按1→2→3顺序全部选择 |
| "不良代码仅可关联3级分类" | 将1·2级代码指定为分类 | 选择3级(不良类型)分类 |
| "仅可使用中的不良分类可关联" | 目标3级分类`USE_YN='N'` | 将分类设为`Y`激活 |
| 2级选择项不显示 | 未选1级或下级无2级/未激活 | 先选1级，登记并激活2级分类 |
| 检验/实绩中不良代码不显示 | 代码`USE_YN='N'`或适用范围·型号不匹配 | 激活代码，确认`DEFECT_SCOPE`·型号区分 |
| "已存在的不良代码" | 同一代码重复登记 | 使用其他代码(代码在租户内唯一) |
| 型号区分映射为空 | 2级不符合`{阶段}_{型号}`规则 | 将2级代码调整为`IQC_LV`格式 |

## 数据·关联
- 表: `DEFECT_CATEGORY_MASTERS`(分类树), `DEFECT_CODE_MASTERS`(代码), `DEFECT_CODE_PRODUCT_TYPES`(型号区分映射)。
- API: `GET/POST /quality/defect-codes/categories`, `PUT .../categories/:categoryCode`, `GET /quality/defect-codes`, `GET /quality/defect-codes/options`, `POST /quality/defect-codes`, `PUT/DELETE /quality/defect-codes/:defectCode`。
- 关联: 不良记录(`DEFECT_LOGS.DEFECT_CODE`), 不良管理(`/quality/defect`), 综合检验(`/inspection/integrated`), 生产实绩Kiosk不良输入。
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`(包含于所有表PK中)。

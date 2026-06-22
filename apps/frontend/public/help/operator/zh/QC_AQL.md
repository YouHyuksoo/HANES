---
menuCode: QC_AQL
audience: operator
title: AQL基准管理 — 操作指南
summary: AQL策略/基准/判定基准的全部列含义, DB映射, 判定逻辑, 物料关联与故障排除
tags: [质量, IQC, AQL, 操作, 设置]
keywords: [IQC_AQL_POLICIES, AQL_STANDARDS, 物料关联, 检验水平, 致命缺陷, IMMEDIATE_FAIL, Ac, Re, 样本数, 故障排除, ITEM_MASTERS]
related: [MST_PART]
---

# AQL基准管理 — 操作指南

## 系统目的·角色
定义按物料入库检验(IQC)判定基准的**AQL策略 / AQL基准 / LOT数量别判定基准**。物料主表的AQL策略字段(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)引用此策略，入库LOT检验时按策略 → 基准 → LOT区间顺序计算样本数·Ac·Re，自动判定合格·不合格。

## 数据结构 (3层)
```
ITEM_MASTERS.IQC_AQL_POLICY_CODE
        │ (引用)
        ▼
IQC_AQL_POLICIES  ──(MAJOR_AQL_CODE / MINOR_AQL_CODE)──▶  AQL_STANDARDS  ──(1:N)──▶  LOT数量别判定基准(rules)
```

---

## ① AQL策略 — IQC_AQL_POLICIES (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 策略代码 | `POLICY_CODE` | PK。物料主表引用的键。不可变更(防止连接断裂)。建议命名规则: `AQLP-{检验水平}-{Major}-{Minor}`。 |
| 策略名称 | `POLICY_NAME` | 显示用名称。 |
| 检验水平 | `INSPECTION_LEVEL` | 公共代码`AQL_INSP_LEVEL`。LOT大小 → 样本字符(code letter)决定基准。标准为II。 |
| Major AQL | `MAJOR_AQL_CODE` | 重缺陷用`AQL_STANDARDS.AQL_CODE`引用(FK性质)。未设置时重缺陷无法自动判定。 |
| Minor AQL | `MINOR_AQL_CODE` | 轻缺陷用`AQL_STANDARDS.AQL_CODE`引用。 |
| 致命缺陷处理 | `CRITICAL_MODE` | `IMMEDIATE_FAIL` = 出现1件致命缺陷时立即LOT不合格(与样本数/Ac无关)。 |
| 使用与否 | `USE_YN` | 仅`Y`可连接物料·为检验对象。策略"停用"为软禁用(`N`)。 |
| 备注 | `REMARK` | 备注。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 策略以`COMPANY='40'`, `PLANT_CD='1000'`范围管理。 |

---

## ② AQL基准 — AQL_STANDARDS (全部列)

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| AQL代码 | `AQL_CODE` | PK。策略的Major/Minor引用。不可变更。例如: `AQL-1.0`。 |
| AQL名称 | `AQL_NAME` | 显示用。 |
| 检验水平 | `INSPECTION_LEVEL` | 公共代码`AQL_INSP_LEVEL`。与策略检验水平一致运营。 |
| AQL值 | `AQL_VALUE` | 公共代码`AQL_VALUE`(0.65/1.0/2.5等)。合格质量界限数值。**越小越严格**。与样本数结合计算Ac/Re。 |
| 使用与否 | `USE_YN` | 仅`Y`可在策略中选择。 |
| 备注 | `REMARK` | 备注。 |
| 多租户 | `COMPANY`, `PLANT_CD` | `40` / `1000` 范围。 |

---

## ③ LOT数量别判定基准 — rules (全部列)

每1条AQL基准包含N个LOT区间行。按LOT大小区间定义样本数·Ac·Re(基于KS Q ISO 2859-1表)。

| 界面项目 | 列 | 角色 / 含义 |
|------|------|------|
| LOT From | `lotQtyFrom` | 适用LOT数量区间下限。 |
| LOT To | `lotQtyTo` | 适用LOT数量区间上限。 |
| 样本数(n) | `sampleSize` | 检验样本个数。 |
| Ac | `acceptQty` | 合格判定个数。不良数 ≤ Ac → 合格。 |
| Re | `rejectQty` | 不合格判定个数。不良数 ≥ Re → 不合格。通常Re=Ac+1。 |
| 排序顺序 | `sortOrder` | 保存时按LOT数量重新排序。 |

**输入验证(保存时阻止)**: From ≤ To, Re > Ac, 区间不重叠(前To < 后From)。

---

## 判定逻辑 (入库LOT检验时)
1. 通过物料的`IQC_AQL_POLICY_CODE`查询策略。不存在时不应用自动判定。
2. 有致命缺陷且`CRITICAL_MODE='IMMEDIATE_FAIL'`时立即不合格。
3. Major/Minor各自: 策略的对应AQL基准 → 按LOT大小选择区间行 → 应用该行的n·Ac·Re。
4. 将缺陷等级别不良数与Ac/Re比较判定合格·不合格。任一不合格则LOT不合格。

## 预设条件 (主表·公共代码)
- 公共代码: `AQL_INSP_LEVEL`(检验水平), `AQL_VALUE`(AQL值)
- 按AQL基准 → LOT判定基准 → 策略顺序登记后，在物料主表中为物料关联策略。

## 操作流程
1. 定义`AQL_STANDARDS`(按AQL值的基准) + 为各基准登记LOT区间判定基准
2. 在`IQC_AQL_POLICIES`中为Major/Minor关联基准，设置检验水平·致命缺陷处理
3. 在[物料主表]中为物料关联策略(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`)
4. 在入库LOT入库检验中确认自动判定

## 权限
质量管理员(基准登记/修改)。普通用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 检验中AQL自动判定不生效 | 物料未关联策略 | 在物料主表中指定AQL策略 |
| 策略中基准不可选 | 该AQL基准`USE_YN='N'` | 将基准设为`Y`激活 |
| 特定LOT大小判定缺失 | 无包含该数量的区间行 | 添加LOT区间行(消除空白区间) |
| 致命缺陷却判定合格 | `CRITICAL_MODE`未设置 | 在策略中设置`IMMEDIATE_FAIL` |
| 保存拒绝(区间重叠/Re≤Ac) | 违反输入验证 | 修正为From≤To, Re>Ac, 区间不重叠 |

## 数据·关联
- 表: `IQC_AQL_POLICIES`, `AQL_STANDARDS`(+ LOT判定基准 rules)
- 关联: 物料主表(`ITEM_MASTERS.IQC_AQL_POLICY_CODE`), 入库检验(IQC)判定引擎
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`

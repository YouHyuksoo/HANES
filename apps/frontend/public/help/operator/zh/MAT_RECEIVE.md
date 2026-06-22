---
menuCode: MAT_RECEIVE
audience: operator
title: 材料入库管理 — 操作指南
summary: IQC合格LOT的扫描入库处理逻辑, 入库待处理计算条件, 条码映射/成绩单阻止, 库存反映与故障排除
tags: [材料, 入库, 收发, 操作]
keywords: [入库待处理, IQC合格, matUid, vendor-barcode, 制造商条码映射, MatStock, 库存反映, 成绩单, certRequired, 余量, 编号, PROD, MRO]
related: [MST_PART, QC_AQL]
---

# 材料入库管理 — 操作指南

## 系统目的·角色
将经过入货·入库检验的材料**确认为仓库库存**的处理界面。仅IQC合格LOT可成为入库对象，入库确认时反映到库存(`MatStock`)并创建入库交易记录。

## 处理流程
```
入货(PO入库) → IQC检验 → [合格 + 余量>0] = 入库待处理
   → 扫描入库(客户条码 + 材料序列号映射) → 库存(MatStock)反映 + 入库记录编号
```

## 数据 / API
- 入库待处理查询: `GET /material/receiving/receivable` — 仅返回**IQC合格 + 未入库(余量>0)** LOT。
- 入库确认: 按扫描映射(`{ vendorBarcode, matUid }`)单位处理。仅映射过的确认。
- 库存基准: 当前库存数量在`MatStock`中管理(入库时增加)。

## 入库待处理计算条件 (操作员确认要点)
LOT要显示在入库待处理需**全部满足**:
- 入库检验结果 `iqcStatus = 合格`
- 余量(`remainingQty = initQty − receivedQty`) > 0
- (需成绩单物料) 无入库阻止原因

## 主要字段含义 · 操作要点

| 界面项目 | 含义 / 计算 · 关联 |
|------|------|
| 材料序列号(matUid) | 入货时编号的LOT标识值。扫描自行贴附的条码。 |
| 入货数量 / 已入库 / 余量 | `initQty` / `receivedQty`(部分入库累计) / `remainingQty`(可入库)。支持部分入库累计。 |
| 检验状态(iqcStatus) | IQC判定。仅合格件包含在入库待处理中。 |
| 入货仓库(arrivalWarehouse) | 入货放置仓库。入库时移动到入库仓库。 |
| 成绩单(certRequired/certUploaded) | 需要但未上传则设置`receivingBlockedReason` → 阻止入库。 |
| 入库阻止原因(receivingBlockedReason) | 不可入库原因。解决后可入库。 |
| 客户条码(vendorBarcode) | 通过[制造商条码映射](vendor-barcode主表)与MES品号/序列号关联。未注册映射则扫描失败。 |
| 区分(materialClass) | PROD(量产) / MRO(耗材)。入库记录分类。 |
| 入库号/交易号(receiveNo/transNo) | 入库处理编号值。 |

## 扫描入库逻辑
1. 开始入库处理 → 扫描客户条码 → 通过vendor-barcode主表解析品号/序列号。
2. 扫描材料序列号(matUid) → 与入库待处理LOT映射。
3. 仅映射成功的确认入库 → `MatStock`增加 + 创建入库记录。
4. 映射失败(未注册条码/非对象)不确认。

## 预设条件
- 物料主表(IQC与否·需成绩单与否), AQL策略(入库检验), 制造商条码映射(vendor-barcode), 仓库主表。

## 权限
材料负责人(入库处理)。普通用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 入库待处理中无LOT | IQC不合格或余量为0 | 确认检验完成/合格与否, 已入库与否 |
| 入库处理被阻止 | 需要成绩单但未上传 | 上传成绩单后解决阻止原因 |
| 客户条码扫描失败 | vendor-barcode映射未注册 | 在[制造商条码映射]中注册条码↔品号 |
| 材料序列号扫描不匹配 | 非入库待处理对象(不同LOT/已全部入库) | 确认目标LOT·余量 |
| 未反映到库存 | 入库未确认(仅映射未确认) | 确认扫描映射后已确认处理 |

## 数据·关联
- 库存: `MatStock`(入库时增加)
- 关联: 入货/PO, 入库检验(IQC)·AQL, 制造商条码映射(vendor-barcode), 仓库, 物料主表
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`

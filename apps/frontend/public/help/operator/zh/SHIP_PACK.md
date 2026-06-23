---
menuCode: SHIP_PACK
audience: operator
title: 产品包装管理 — 操作指南
summary: 按箱(Box)单位包装管理 — 创建箱·添加/移除序列号·关闭·重新打开·打印标签, BOX_MASTERS全部列, FG_LABELS状态转移, OQC自动生成
tags: [出货, 包装, 箱, 操作]
keywords: [BOX_MASTERS, FG_LABELS, BOX_NO, ITEM_CODE, SERIAL_LIST, PALLET_NO, BOX_STATUS, OQC_STATUS, BOX_QTY, OPEN, CLOSED, SHIPPED, VISUAL_PASS, PACKED, OQC_REQUEST, 箱包装, 序列号, 箱标签, 箱容量, 托盘, 多租户]
related: [SHIP_PALLET, SHIP_ORDER, SHIP_CONFIRM, SHIP_HISTORY]
---

# 产品包装管理 — 操作指南

## 系统目的·角色
将检验合格成品(FG)按**箱(Box)**单位包装以便出货的界面。由创建箱→添加序列号→关闭(→自动OQC委托)3步骤工作流组成。

| 步骤 | 操作 | 结果 |
|------|------|------|
| 1 | 创建箱(选择物料) | `BOX_MASTERS`中创建OPEN状态的箱, boxNo自动编号 |
| 2 | 添加序列号(条码扫描) | FG序列号放入箱, serialList JSON更新, qty增加 |
| 3 | 关闭箱 | status→CLOSED, OQC自动委托生成, FG_LABELS→PACKED |

包装后的箱依次进行托盘装载(`/shipping/pallet`) → 出货检查(OQC, `/quality/oqc`) → 出货确定(`/shipping/confirm`)。

## 数据结构
```
BOX_MASTERS (PK: COMPANY + PLANT_CD + BOX_NO)
   ├─ ITEM_CODE ─▶ ITEM_MASTERS (物料, boxQty=箱容量)
   ├─ PALLET_NO ─▶ PALLET_MASTERS (托盘)
   └─ SERIAL_LIST (CLOB) ─▶ FG_LABELS (序列号JSON数组, 如: ["SN001","SN002"])

FG_LABELS (PK: FG_BARCODE)
   状态转移: ISSUED → VISUAL_PASS → PACKED → SHIPPED
   箱关闭时: PACKED + boxNo设置

OQC_REQUESTS (箱关闭时自动生成)
   remark = "AUTO_CREATED_FROM_BOX:{boxNo}"
```

## 箱状态 (BOX_STATUS) 代码值

| 代码 | 显示 | 说明 |
|------|------|------|
| `OPEN` | 开放 | 可添加/移除序列号 |
| `CLOSED` | 关闭 | 序列号确定, OQC待机, 可重新打开(未分配托盘时) |
| `SHIPPED` | 已出货 | 出货完成, 不可再变更 |

## 箱编号规则
- 格式: `BX` + `YYMMDD` + `NNNN` (每日序列4位, 按日重置)
- 例: `BX2606230001`
- 编号: `NumberingService.nextBoxNo()` → Oracle `SEQ_BOX_NO_DAILY`

## 全部列 — BOX_MASTERS

| 界面项目 | DB列 | 角色 / 含义 · 操作要点 |
|------|------|------|
| 箱号 | `BOX_NO` | PK。BX+日期+序列号自动编号。标签·条码标识符。 |
| 物料代码 | `ITEM_CODE` | 参照`ITEM_MASTERS.ITEM_CODE`。一箱只能装单一物料。 |
| 包装数量 | `QTY` | 内置序列号数量(= serialList JSON数组长度)。不能超过boxQty。 |
| 序列号列表 | `SERIAL_LIST` | CLOB。FG条码JSON数组。一箱可容纳数千件，但需考虑OQC·查询性能。 |
| 托盘号 | `PALLET_NO` | 参照`PALLET_MASTERS.PALLET_NO`。托盘装载时赋予。关闭后可分配托盘。 |
| 状态 | `STATUS` | `OPEN`/`CLOSED`/`SHIPPED`。默认OPEN。 |
| OQC状态 | `OQC_STATUS` | `PENDING`/`PASS`/`FAIL`/`null`。关闭时设为PENDING。 |
| 出货指示号 | `SHIP_ORDER_NO` | 连接出货指示时赋予。出货确定阶段设置。 |
| 出货日期 | `SHIPPED_AT` | 出货确定时间戳。 |
| 关闭日期 | `CLOSE_TIME` | 箱关闭时间戳(closeAt)。 |
| 审计 | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | 创建/修改记录。 |
| 多租户 | `COMPANY`, `PLANT_CD` | PK的一部分。`40` / `1000`范围。 |

索引: `ITEM_CODE`, `PALLET_NO`, `STATUS`, `SHIP_ORDER_NO` — 根据搜索条件利用索引。

## 详细工作流

### ① 创建箱
`POST /shipping/boxes { itemCode }`
- 物料选择模态框 → 仅可选成品(`FINISHED`)(`PartSelect partType="FINISHED"`)
- BoxNo自动编号, `qty=0`, `serialList=null`
- 物料主表的`BOX_QTY`(箱容量)作为序列号添加上限

### ② 添加序列号
`POST /shipping/boxes/:boxNo/serials { serials: ["FG_BARCODE"] }`
- 条件: 箱`OPEN`状态, FG_LABELS `VISUAL_PASS` + `inspectPassYn='Y'`, 物料代码一致, 未超过boxQty
- **跨箱重复禁止**: 同一序列号已放入其他箱时拒绝

### ③ 关闭箱 (手动/自动)
`POST /shipping/boxes/:boxNo/close`
- **手动关闭**: 箱信息面板的锁定图标或序列号模态框的`包装完成 · 标签打印`按钮
- **自动关闭**: 序列号数量达到`boxQty`时自动关闭 + 标签自动打印
- 关闭时的副作用:
  1. `BOX_MASTERS.status` → `CLOSED`, `closeAt` → 当前时间
  2. `FG_LABELS`的相应序列号: `status` → `PACKED`, `boxNo`设置
  3. `OQC_REQUESTS`自动生成 (`status=PENDING`, `remark=AUTO_CREATED_FROM_BOX:{boxNo}`)
  4. `OQC_REQUEST_BOXES`自动生成 (该箱信息)

### ④ 重新打开箱
`POST /shipping/boxes/:boxNo/reopen`
- 条件: 未分配托盘(`palletNo IS NULL`)
- 恢复操作: 序列号 → `VISUAL_PASS`, 自动生成的OQC委托删除

### ⑤ 删除空箱
- 条件: `OPEN`状态, 未分配托盘, `qty=0`, 无serialList, 无OQC记录

## 界面布局
- **左侧主区**(2/3): DataGrid — 箱列表(箱号·物料代码·物料名·包装数量·状态·关闭日期)
  - 点击行时右侧显示箱构成明细
  - 4个操作按钮: 装箱(Plus) / 关闭-重新打开(Lock-LockOpen) / 补打标签(Printer) / 删除空箱(Trash2)
  - 搜索: 箱号·物料代码, 状态筛选(BOX_STATUS公共代码)
- **右侧面板**(1/3): 所选箱的构成明细
  - 物料·容量(当前/最大), 序列号列表(BoxItem API), 状态·托盘信息

### 序列号添加模态框
- 序列号条码输入 → Enter键添加(FG条码或序列号)
- 达到`boxQty`时自动关闭 + 标签自动打印
- 刚添加的序列号可取消(移除)
- 容量超出时显示警告

## 预设条件 (主表·公共代码)
- 公共代码: `BOX_STATUS`, `OQC_STATUS`
- 物料主表(`ITEM_MASTERS`): 需设置`BOX_QTY`(箱容量)(未设置时无限制)
- FG_LABELS: 需要外观检查合格(`VISUAL_PASS`)的序列号才可包装
- 关联菜单: 托盘管理(`/shipping/pallet`), OQC(`/quality/oqc`), 出货确定(`/shipping/confirm`)

## 权限
出货管理员(创建箱/添加序列号/关闭/重新打开)。一般用户仅查询。

## 故障排除
| 症状 | 原因 | 措施 |
|------|------|------|
| 序列号添加失败(物料不一致) | 扫描的FG与箱的物料不同 | 只有相同物料的FG才能放入该箱 |
| 序列号添加失败(状态不一致) | FG不是`VISUAL_PASS`状态 | 先处理外观检查合格 |
| 序列号添加失败(重复) | 序列号已在其他箱中 | 在该箱中确认 |
| 箱关闭失败 | 已是CLOSED或SHIPPED状态 | 确认状态 |
| 箱重新打开不可 | 已分配托盘 | 先解除托盘 |
| 空箱删除不可 | qty>0或serialList存在或有OQC记录 | 先清空箱内容 |
| 创建箱时无物料可选 | 未注册FINISHED类型的物料主表 | 在物料主表中注册FINISHED类型 |
| OQC未自动生成 | 关闭流程错误 | 重新打开后重新关闭箱 |

## 数据·关联
- 表: `BOX_MASTERS`, `FG_LABELS`, `OQC_REQUESTS`, `OQC_REQUEST_BOXES`, `PALLET_MASTERS`
- 关联: 成品检查(`FG_LABELS.status: VISUAL_PASS`), 托盘装载(`/shipping/pallet`), 出货检查(OQC, `/quality/oqc`), 出货确定(`/shipping/confirm`), 出货记录(`/shipping/history`)
- 序列号编号: `SEQ_BOX_NO_DAILY` (BX + YYMMDD + 4位)
- 图片存储: 无(标签通过bwip-js Code128条码实时渲染)
- 范围: `COMPANY='40'`, `PLANT_CD='1000'`

---
menuCode: QC_INSPECT
audience: operator
title: 外观检查 — 运营指南
summary: INSPECT_RESULTS(VISUAL)表结构、FG_LABELS状态迁移、合格/不合格处理事务及故障排除
tags: [质量, 外观检查, 运营, VISUAL, FG_LABELS, INSPECT_RESULTS]
keywords: [QC_INSPECT, INSPECT_RESULTS, VISUAL, FG_LABELS, PASS_YN, VISUAL_DEFECT, FG_BARCODE, 外观检查, VISUAL_PASS, VISUAL_FAIL, ISSUED]
related: [QC_DEFECT_CODE, QC_DEFECT]
---

# 外观检查 — 运营指南

## 系统目的与作用
对已完工并已发放(`ISSUED`)FG标签的产品进行目视外观检查，将结果以`INSPECT_TYPE='VISUAL'`存入`INSPECT_RESULTS`表。根据合格/不合格结果，`FG_LABELS.STATUS`迁移至`VISUAL_PASS`或`VISUAL_FAIL`。

## 数据结构
```
FG_LABELS (FG_BARCODE PK)
    │   STATUS: ISSUED → VISUAL_PASS / VISUAL_FAIL → PACKED → SHIPPED
    │   INSPECT_RESULT_ID → INSPECT_RESULTS.RESULT_NO
    │   ORDER_NO → JOB_ORDERS
    │
    └──▶ INSPECT_RESULTS (RESULT_NO PK)
            │   INSPECT_TYPE = 'VISUAL'（固定）
            │   INSPECT_SCOPE = 'FULL'（固定）
            │   PASS_YN = 'Y'(合格) / 'N'(不合格)
            │   ERROR_CODE → COM_CODES.VISUAL_DEFECT
            │   ERROR_DETAIL (VARCHAR2 500)
            │   FG_BARCODE → FG_LABELS
            │   INSPECTOR_ID → WORKER_MASTERS
```

---

## ① 检验结果 — INSPECT_RESULTS（外观检查相关列）

| 画面项目 | DB列 | 作用 / 含义 · 运营要点 |
|------|------|------|
| 结果编号 | `RESULT_NO` | **PK**。序列自动编号。 |
| 生产实绩ID | `PROD_RESULT_ID` | → `PROD_RESULTS` FK（外观检查可省略）。 |
| 检验类型 | `INSPECT_TYPE` | 固定为`'VISUAL'`。 |
| 检验范围 | `INSPECT_SCOPE` | 固定为`'FULL'`。 |
| 合格与否 | `PASS_YN` | `'Y'`(合格) / `'N'`(不合格)。默认值`'Y'`。 |
| 不良代码 | `ERROR_CODE` | 引用公共代码`VISUAL_DEFECT`组值。 |
| 详细原因 | `ERROR_DETAIL` | 不合格的详细原因。最多500字符。 |
| 检验数据 | `INSPECT_DATA` | CLOB — 附加检验数据(JSON)。 |
| FG条码 | `FG_BARCODE` | → `FG_LABELS.FG_BARCODE`。 |
| 检验时间 | `INSPECT_TIME` | 检验执行时间戳。 |
| 检验员ID | `INSPECTOR_ID` | → `WORKER_MASTERS`。 |
| 多租户 | `COMPANY`, `PLANT_CD` | 公司代码(`40`) / 工厂代码(`1000`)。 |

---

## ② FG标签 — FG_LABELS（状态迁移相关）

| DB列 | 作用 / 含义 |
|---------|------|
| `FG_BARCODE` | **PK**。FG条码(序列号)。 |
| `STATUS` | `ISSUED`(发放) → `VISUAL_PASS`(外观合格) / `VISUAL_FAIL`(外观不合格) → `PACKED`(包装) → `SHIPPED`(出货)。 |
| `INSPECT_RESULT_ID` | 检验完成后设置引用`INSPECT_RESULTS.RESULT_NO`。 |
| `INSPECT_PASS_YN` | 最终检验合格/不合格结果。 |

---

## 合格/不合格处理事务详情

调用`POST /quality/continuity-inspect/visual-inspect/{fgBarcode}`时执行`visualInspect()`：

1. **验证阶段**：
   - 检查`VISUAL_INSP_BYPASS`系统设置（启用时返回400错误）
   - 确认FG标签存在且`STATUS`为`ISSUED`
   - `PACKED`、`SHIPPED`、`VOIDED`状态不可检验

2. **事务内执行**：
   - 序列编号`RESULT_NO`
   - INSERT到`INSPECT_RESULTS`（`INSPECT_TYPE='VISUAL'`、`INSPECT_SCOPE='FULL'`、`PASS_YN`、`ERROR_CODE`、`ERROR_DETAIL`）
   - `FG_LABELS.UPDATE`：设置`STATUS='VISUAL_PASS'`或`STATUS='VISUAL_FAIL'`，设置`INSPECT_RESULT_ID`

---

## 公共代码

| 组代码 | 用途 | 示例 |
|---------|------|------|
| `VISUAL_DEFECT` | 外观检查不良代码 | 划痕、异物、变色、印刷不良、其他 |

---

## 验证规则

| 条件 | 处理 |
|------|------|
| FG条码不存在 | `BadRequestException` |
| FG标签状态不是`ISSUED` | 提示无法检验（已完成检验/包装/出货/废弃） |
| 条码不属于所选作业指令 | 显示警告消息 |
| `VISUAL_INSP_BYPASS`开启 | 400 BadRequest |
| FAIL时未选不良代码 | 在`FailModal`中强制输入 |

## 故障排除

| 症状 | 原因 | 措施 |
|------|------|------|
| FG条码查询失败 | 条码输入错误或不存在 | 重新确认条码 |
| "已完成检验"消息 | FG标签已为`VISUAL_PASS`/`VISUAL_FAIL`状态 | 不可重新检验，在不合格管理画面确认 |
| "其他作业指令标签"错误 | 扫描的条码与当前所选作业指令不一致 | 选择正确的作业指令或重新确认条码 |
| FAIL保存失败 | 未选不良代码或未输入详细原因 | 确认必填项目 |
| 系统设置错误(400) | `VISUAL_INSP_BYPASS`已启用 | 联系管理员确认设置 |
| 检验后状态无变化 | 事务失败(DB错误) | 查看日志后重试 |

## 数据与关联
- **表**：`INSPECT_RESULTS`（检验结果）、`FG_LABELS`（标签/状态）、`COM_CODES`（不良代码）
- **关联**：生产实绩（`PROD_RESULTS`）、作业者（`WORKER_MASTERS`）
- **范围**：`COMPANY='40'`、`PLANT_CD='1000'`

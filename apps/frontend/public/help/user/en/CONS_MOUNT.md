---
menuCode: CONS_MOUNT
audience: user
title: Consumable Mount Management
summary: A screen for mounting and unmounting consumables such as molds, jigs, and tools on production equipment, switching them to and from repair status, and viewing mount history.
tags: [Consumables, Mount, Unmount, Repair, Equipment, Mold, Jig, Tool]
keywords: [consumable mount, equipment mount, mold mount, jig mount, tool mount, mount unmount, repair switch, repair complete, mount history, MOUNTED, WAREHOUSE, REPAIR, CONSUMABLE_MOUNT_LOGS]
related: [CONS_MASTER, CONS_STOCK, CONS_LIFE]
---

# Consumable Mount Management

## Purpose
This screen is used to **mount** or **unmount** consumables (molds, jigs, tools, etc.) on production equipment, switch them to **repair status** when necessary, and return them to the warehouse after repair is complete. You can also view the mount/unmount history of individual consumables.

> This screen manages the **physical location and operating status** of consumables. Receiving, issuing, and life-cycle management are handled separately on the [Consumable Master](/consumables/master), [Consumable Receiving](/consumables/receiving), [Consumable Issue](/consumables/issuing), and [Life Status](/consumables/life) screens.

## Screen Layout
- **Top header**: Screen title and refresh button.
- **Main grid**: List of consumables. Each row displays action buttons appropriate to its current status.
- **Action modal**: Popup used to execute mount, unmount, repair switch, or repair complete actions.
- **History modal**: Displays the mount/unmount history of the selected consumable in a table.

## ① Main Grid Columns

| Column | Role / Meaning |
|------|------|
| **Actions** | Row-level action buttons. Depending on the current status, the buttons shown are **Mount**, **Unmount**, **Switch to Repair**, **Repair Complete**, and **History**. |
| **Operating Status (operStatus)** | Current location/operating status of the consumable. One of `WAREHOUSE` / `MOUNTED` / `REPAIR`. |
| **Consumable Code (consumableCode)** | Unique code that identifies the consumable. |
| **Consumable Name (consumableName)** | Name of the consumable. |
| **Category (category)** | Consumable category. One of the common code `CONSUMABLE_CATEGORY` values such as `MOLD`, `JIG`, or `TOOL`. |
| **Mounted Equipment (mountedEquip)** | Code of the equipment on which the consumable is currently mounted. Shown as `-` when not mounted. |
| **Life Status (status)** | Life status of the consumable. One of `NORMAL` / `WARNING` / `REPLACE`. |
| **Life (lifeProgress)** | Bar chart showing the ratio of current usage count to expected life. Highlighted in yellow at 80% or above and in red at 100% or above. |
| **Storage Location (location)** | Default storage location of the consumable. |

## ② Available Actions by Status

| Current Status | Available Actions | Description |
|------|------|------|
| **WAREHOUSE** | Mount, Switch to Repair | Select equipment to mount the consumable, or switch it to repair status. |
| **MOUNTED** | Unmount, Switch to Repair | Unmount from the currently mounted equipment, or automatically unmount and switch to repair status. |
| **REPAIR** | Repair Complete | Return the repaired consumable to `WAREHOUSE` status. |

## ③ Action Modal Input Fields

| Field | Description |
|------|------|
| **Target Equipment** | Required when mounting. Select the equipment to mount from the equipment selector. |
| **Remarks** | Optional. Record the reason for mount/unmount/repair, etc. Maximum 500 characters. |

## Usage Steps
1. Find the target consumable using the top search bar or the **Category / Operating Status filters**.
2. Click the action button that matches the row status.
   - Mount: Click `Mount` → select target equipment → save.
   - Unmount: Click `Unmount` → enter remarks (optional) → save.
   - Repair: Click `Switch to Repair` → enter remarks (optional) → save.
   - Repair Complete: Click `Repair Complete` → save.
3. The list automatically refreshes after the change.
4. To view past history for a specific consumable, click the `History` button.

## Input Rules / Validation
- **Mount** requires a target equipment to be selected. The save button is disabled if no equipment is selected.
- A consumable that is already mounted cannot be mounted again.
- A consumable that is not mounted cannot be unmounted.
- A consumable that is not in repair status cannot be processed as repair complete.
- When switching to repair while mounted, an automatic unmount record is created first, and then the status switches to `REPAIR`.

## Frequently Asked Questions
- **Q.** The Mount button is not visible.  
  **A.** The Mount button is displayed only for consumables whose operating status is `WAREHOUSE`. Check the filter.
- **Q.** How do I return a consumable to the warehouse after sending it to repair?  
  **A.** Click the `Repair Complete` button. The operating status will return to `WAREHOUSE`.
- **Q.** After unmounting from equipment, it says the life has been exceeded.  
  **A.** Unmounting itself is still possible. Check the expected life and warning threshold in [Consumable Master](/consumables/master), then replace or reset the consumable.
- **Q.** The operator is not shown in the history.  
  **A.** There is no operator input field on this screen; the logged-in user information is recorded at the time of the API call. Check the backend logic if needed.

## Related Screens
- [Consumable Master](/consumables/master) — Register basic consumable information.
- [Consumable Receiving](/consumables/receiving) — Consumable receiving and return.
- [Consumable Issue](/consumables/issuing) — Consumable issue.
- [Life Status](/consumables/life) — View consumable life status.

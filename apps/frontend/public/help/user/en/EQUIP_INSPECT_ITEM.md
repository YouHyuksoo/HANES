---
menuCode: EQUIP_INSPECT_ITEM
audience: user
title: Equipment Inspection Items
summary: Screen for managing inspection items per equipment by connecting (mapping) inspection items to individual equipment and issuing QR labels
tags: [equipment, inspection, mapping, items, assignment, QR]
keywords: [EQUIP_INSPECT_ITEM_POOL, equipment inspection items, inspection item mapping, per-equipment inspection, batch registration, QR label, DAILY, PERIODIC, PM, WORKER]
related: [EQUIP_INSPECT_ITEM_MASTER]
---

# Equipment Inspection Items

## Screen Purpose
Connect (map) inspection items registered in [Inspection Item Master] to individual equipment to configure inspection items to be performed per equipment. Tabs are separated by inspection type (Daily/Periodic/PM/Worker), and QR labels can be issued for on-site use.

## Screen Layout
- **Left — Equipment List**: Displays all equipment grouped by equipment type. Use the search filter to find desired equipment.
- **Right — Inspection Item Panel**: Displays the inspection item list for the selected equipment, organized by inspection type tabs (DAILY/PERIODIC/PM/WORKER).
- **Drawer — Add Inspection Items**: Select items from the inspection item master in the panel opened by the top-right button and register them in batch.
- **Modal — Issue QR Labels**: Prints QR code labels for each inspection item.

---

## ① Inspection Item List Columns

| Column | Role / Meaning |
|------|------|
| **Photo (imageUrl)** | Reference image of the inspection item. |
| **Item Code (itemCode)** | Item code from the inspection item master. |
| **Item Name (itemName)** | Name of the inspection item. |
| **Criteria (criteria)** | OK/NG judgment criteria or measurement range for inspection. |
| **Cycle (cycle)** | Inspection performance cycle (DAILY/WEEKLY/MONTHLY, etc.). |
| **Sort Order (sortSeq)** | Display order of inspection items within the equipment. |
| **Active (useYn)** | `Y` (green) = active, `N` (red) = inactive. |

## Usage Sequence
1. Select the desired equipment from the left equipment list.
2. Select the inspection type tab (DAILY/PERIODIC/PM/WORKER) at the top right.
3. Click the **Add Inspection Items** button to open the drawer panel.
4. Check the items to add and click the **Batch Register** button to connect them to the equipment.
5. Registered items can be verified in the list and deleted if necessary.
6. Use the **Issue QR Label** button to print QR code labels for individual items and attach them on-site.

## Inspection Type Tabs
| Tab | Description |
|------|------|
| **DAILY** | Daily inspection items performed before work each day |
| **PERIODIC** | Monthly/quarterly/semi-annual/annual periodic inspection items |
| **PM** | Preventive Maintenance related inspection items |
| **WORKER** | Inspection items performed by workers themselves |

## Related Screens
- [Inspection Item Master](/master/equip-inspect-item) — Standard information screen for registering and editing inspection items

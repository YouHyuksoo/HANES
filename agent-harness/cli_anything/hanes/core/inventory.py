"""
@file inventory.py
@description Inventory management CLI commands (stocks, transactions, warehouses).
"""

import click
import json

from cli_anything.hanes.core.session import Session


@click.group("inventory")
def inventory_group():
    """Inventory management (stocks, transactions, warehouses)."""
    pass


def _output(ctx: click.Context, data, headers=None, rows_fn=None):
    """Output helper: JSON mode or table."""
    if ctx.obj.get("json_mode"):
        click.echo(json.dumps(data, indent=2, ensure_ascii=False, default=str))
        return
    if headers and rows_fn and isinstance(data, dict):
        items = data.get("data", data)
        if isinstance(items, list):
            from cli_anything.hanes.utils.repl_skin import ReplSkin
            skin = ReplSkin("hanes")
            rows = [rows_fn(item) for item in items]
            skin.table(headers, rows)
            total = data.get("total", len(items))
            skin.info(f"Total: {total}")
        else:
            click.echo(json.dumps(data, indent=2, ensure_ascii=False, default=str))
    else:
        click.echo(json.dumps(data, indent=2, ensure_ascii=False, default=str))


@inventory_group.command("product-stocks")
@click.option("--search", "-s", default=None)
@click.option("--warehouse", default=None, help="Warehouse code filter")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_product_stocks(ctx, search, warehouse, page, limit):
    """List product stock levels (WIP/FG)."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_product_stocks(
        search=search, warehouseCode=warehouse, page=page, limit=limit
    )
    _output(ctx, result,
            headers=["Warehouse", "Item", "PrdUID", "Qty", "Status"],
            rows_fn=lambda r: [
                r.get("warehouseCode", ""),
                r.get("itemCode", ""),
                r.get("prdUid", ""),
                str(r.get("qty", "")),
                r.get("status", ""),
            ])


@inventory_group.command("transactions")
@click.option("--type", "trans_type", default=None, help="MAT_IN|MAT_OUT|MAT_ADJ")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_transactions(ctx, trans_type, page, limit):
    """List stock transactions (ledger)."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_transactions(
        transType=trans_type, page=page, limit=limit
    )
    _output(ctx, result,
            headers=["TransNo", "Type", "Item", "Qty", "Warehouse", "Date"],
            rows_fn=lambda r: [
                r.get("transNo", ""),
                r.get("transType", ""),
                r.get("itemCode", ""),
                str(r.get("qty", "")),
                r.get("warehouseCode", ""),
                r.get("createdAt", "")[:10] if r.get("createdAt") else "",
            ])


@inventory_group.command("warehouses")
@click.option("--search", "-s", default=None)
@click.pass_context
def list_warehouses(ctx, search):
    """List warehouses."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_warehouses(search=search)
    _output(ctx, result,
            headers=["Code", "Name", "Type", "UseYN"],
            rows_fn=lambda r: [
                r.get("warehouseCode", ""),
                r.get("warehouseName", ""),
                r.get("warehouseType", ""),
                r.get("useYn", ""),
            ])

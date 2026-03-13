"""
@file material.py
@description Material management CLI commands (arrivals, lots, stocks, receiving).
"""

import click
import json

from cli_anything.hanes.core.session import Session


@click.group("material")
def material_group():
    """Material management (arrivals, lots, stocks, receiving)."""
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


@material_group.command("arrivals")
@click.option("--search", "-s", default=None)
@click.option("--status", default=None, help="Status filter")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_arrivals(ctx, search, status, page, limit):
    """List material arrivals."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_arrivals(
        search=search, status=status, page=page, limit=limit
    )
    _output(ctx, result,
            headers=["ID", "Item", "Vendor", "Qty", "Date", "Status"],
            rows_fn=lambda r: [
                str(r.get("id", "")),
                r.get("itemCode", ""),
                r.get("vendorCode", ""),
                str(r.get("arrivalQty", "")),
                r.get("arrivalDate", "")[:10] if r.get("arrivalDate") else "",
                r.get("status", ""),
            ])


@material_group.command("lots")
@click.option("--search", "-s", default=None)
@click.option("--item-code", default=None, help="Item code filter")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_lots(ctx, search, item_code, page, limit):
    """List material lots (serial tracking)."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_mat_lots(
        search=search, itemCode=item_code, page=page, limit=limit
    )
    _output(ctx, result,
            headers=["MatUID", "Item", "LotNo", "Qty", "Status", "IQC"],
            rows_fn=lambda r: [
                r.get("matUid", ""),
                r.get("itemCode", ""),
                r.get("lotNo", ""),
                str(r.get("qty", "")),
                r.get("status", ""),
                r.get("iqcStatus", ""),
            ])


@material_group.command("stocks")
@click.option("--search", "-s", default=None)
@click.option("--warehouse", default=None, help="Warehouse code filter")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_stocks(ctx, search, warehouse, page, limit):
    """List material stock levels."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_mat_stocks(
        search=search, warehouseCode=warehouse, page=page, limit=limit
    )
    _output(ctx, result,
            headers=["Warehouse", "Item", "MatUID", "Qty", "Unit"],
            rows_fn=lambda r: [
                r.get("warehouseCode", ""),
                r.get("itemCode", ""),
                r.get("matUid", ""),
                str(r.get("qty", "")),
                r.get("unit", ""),
            ])


@material_group.command("receivable")
@click.pass_context
def list_receivable(ctx):
    """List IQC-passed lots ready for receiving."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_receivable()
    _output(ctx, result,
            headers=["MatUID", "Item", "Qty", "IQC Status"],
            rows_fn=lambda r: [
                r.get("matUid", ""),
                r.get("itemCode", ""),
                str(r.get("qty", "")),
                r.get("iqcStatus", ""),
            ])

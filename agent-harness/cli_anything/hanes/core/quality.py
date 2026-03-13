"""
@file quality.py
@description Quality management CLI commands (inspections, reworks, defects).
"""

import click
import json

from cli_anything.hanes.core.session import Session


@click.group("quality")
def quality_group():
    """Quality management (inspections, reworks, defects)."""
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


@quality_group.command("reworks")
@click.option("--status", default=None, help="Status filter")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_reworks(ctx, status, page, limit):
    """List rework orders."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_reworks(status=status, page=page, limit=limit)
    _output(ctx, result,
            headers=["ID", "ReworkNo", "Item", "Qty", "Status", "Date"],
            rows_fn=lambda r: [
                str(r.get("id", "")),
                r.get("reworkNo", ""),
                r.get("itemCode", ""),
                str(r.get("defectQty", "")),
                r.get("status", ""),
                r.get("createdAt", "")[:10] if r.get("createdAt") else "",
            ])


@quality_group.command("defects")
@click.option("--search", "-s", default=None)
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_defects(ctx, search, page, limit):
    """List defect logs."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_defect_logs(search=search, page=page, limit=limit)
    _output(ctx, result,
            headers=["ID", "Item", "DefectType", "Qty", "Process", "Date"],
            rows_fn=lambda r: [
                str(r.get("id", "")),
                r.get("itemCode", ""),
                r.get("defectType", ""),
                str(r.get("defectQty", "")),
                r.get("processCode", ""),
                r.get("createdAt", "")[:10] if r.get("createdAt") else "",
            ])


@quality_group.command("inspections")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_inspections(ctx, page, limit):
    """List inspection results."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_inspect_results(page=page, limit=limit)
    _output(ctx, result,
            headers=["ID", "OrderNo", "Result", "Inspector", "Date"],
            rows_fn=lambda r: [
                str(r.get("id", "")),
                r.get("orderNo", ""),
                r.get("result", ""),
                r.get("inspectorCode", ""),
                r.get("createdAt", "")[:10] if r.get("createdAt") else "",
            ])

"""
@file master.py
@description Master data CLI commands (parts, processes, BOM, routing, com-codes).
"""

import click
import json

from cli_anything.hanes.core.session import Session


@click.group("master")
def master_group():
    """Master data management (parts, processes, BOM, routing)."""
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


# ── Parts ────────────────────────────────────────────────────────

@master_group.command("parts")
@click.option("--search", "-s", default=None, help="Search keyword")
@click.option("--type", "item_type", default=None, help="Item type filter")
@click.option("--page", default=1, type=int, help="Page number")
@click.option("--limit", default=20, type=int, help="Items per page")
@click.pass_context
def list_parts(ctx, search, item_type, page, limit):
    """List parts (items) from master data."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_parts(
        search=search, itemType=item_type, page=page, limit=limit
    )
    _output(ctx, result,
            headers=["Code", "Name", "Type", "Unit", "UseYN"],
            rows_fn=lambda r: [
                r.get("itemCode", ""),
                r.get("itemName", ""),
                r.get("itemType", ""),
                r.get("unit", ""),
                r.get("useYn", ""),
            ])


@master_group.command("part")
@click.argument("item_code")
@click.pass_context
def get_part(ctx, item_code):
    """Get details for a specific part."""
    session: Session = ctx.obj["session"]
    result = session.backend.get_part(item_code)
    _output(ctx, result)


# ── Processes ────────────────────────────────────────────────────

@master_group.command("processes")
@click.option("--search", "-s", default=None, help="Search keyword")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_processes(ctx, search, page, limit):
    """List manufacturing processes."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_processes(search=search, page=page, limit=limit)
    _output(ctx, result,
            headers=["Code", "Name", "Type", "UseYN"],
            rows_fn=lambda r: [
                r.get("processCode", ""),
                r.get("processName", ""),
                r.get("processType", ""),
                r.get("useYn", ""),
            ])


# ── BOM ──────────────────────────────────────────────────────────

@master_group.command("boms")
@click.option("--search", "-s", default=None)
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_boms(ctx, search, page, limit):
    """List BOM (Bill of Materials) records."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_boms(search=search, page=page, limit=limit)
    _output(ctx, result,
            headers=["Parent", "Child", "Qty", "Unit", "Rev"],
            rows_fn=lambda r: [
                r.get("parentItemCode", ""),
                r.get("childItemCode", ""),
                str(r.get("qty", "")),
                r.get("unit", ""),
                r.get("revision", ""),
            ])


@master_group.command("bom-tree")
@click.argument("parent_code")
@click.option("--depth", "-d", default=10, type=int, help="Max depth")
@click.pass_context
def bom_tree(ctx, parent_code, depth):
    """Show BOM hierarchy tree for a parent item."""
    session: Session = ctx.obj["session"]
    result = session.backend.get_bom_hierarchy(parent_code, depth)
    _output(ctx, result)


# ── Routing ──────────────────────────────────────────────────────

@master_group.command("routings")
@click.option("--search", "-s", default=None)
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_routings(ctx, search, page, limit):
    """List routing (process maps)."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_routings(search=search, page=page, limit=limit)
    _output(ctx, result,
            headers=["ItemCode", "Seq", "Process", "EquipType", "CycleTime"],
            rows_fn=lambda r: [
                r.get("itemCode", ""),
                str(r.get("seq", "")),
                r.get("processCode", ""),
                r.get("equipType", ""),
                str(r.get("cycleTime", "")),
            ])


# ── Common Codes ─────────────────────────────────────────────────

@master_group.command("com-codes")
@click.option("--group", "group_code", default=None, help="Group code filter")
@click.option("--search", "-s", default=None)
@click.pass_context
def list_com_codes(ctx, group_code, search):
    """List common codes (system code table)."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_com_codes(groupCode=group_code, search=search)
    _output(ctx, result,
            headers=["Group", "Detail", "Name", "UseYN"],
            rows_fn=lambda r: [
                r.get("groupCode", ""),
                r.get("detailCode", ""),
                r.get("detailName", ""),
                r.get("useYn", ""),
            ])

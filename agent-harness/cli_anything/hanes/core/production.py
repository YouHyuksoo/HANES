"""
@file production.py
@description Production management CLI commands (job orders, results, plans).
"""

import click
import json

from cli_anything.hanes.core.session import Session


@click.group("production")
def production_group():
    """Production management (job orders, results, plans)."""
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


@production_group.command("orders")
@click.option("--search", "-s", default=None)
@click.option("--status", default=None, help="WAITING|RUNNING|PAUSED|DONE|CANCELED")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_job_orders(ctx, search, status, page, limit):
    """List job orders (work orders)."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_job_orders(
        search=search, status=status, page=page, limit=limit
    )
    _output(ctx, result,
            headers=["OrderNo", "Item", "Line", "PlanQty", "Status", "Date"],
            rows_fn=lambda r: [
                r.get("orderNo", ""),
                r.get("itemCode", ""),
                r.get("lineCode", ""),
                str(r.get("planQty", "")),
                r.get("status", ""),
                r.get("orderDate", "")[:10] if r.get("orderDate") else "",
            ])


@production_group.command("order")
@click.argument("order_no")
@click.pass_context
def get_job_order(ctx, order_no):
    """Get job order details by order number."""
    session: Session = ctx.obj["session"]
    result = session.backend.get_job_order(order_no)
    _output(ctx, result)


@production_group.command("start")
@click.argument("order_id", type=int)
@click.pass_context
def start_order(ctx, order_id):
    """Start a job order (WAITING -> RUNNING)."""
    session: Session = ctx.obj["session"]
    result = session.backend.start_job_order(order_id)
    if not ctx.obj.get("json_mode"):
        from cli_anything.hanes.utils.repl_skin import ReplSkin
        ReplSkin("hanes").success(f"Job order {order_id} started")
    else:
        click.echo(json.dumps(result, indent=2, ensure_ascii=False, default=str))


@production_group.command("complete")
@click.argument("order_id", type=int)
@click.pass_context
def complete_order(ctx, order_id):
    """Complete a job order (RUNNING -> DONE)."""
    session: Session = ctx.obj["session"]
    result = session.backend.complete_job_order(order_id)
    if not ctx.obj.get("json_mode"):
        from cli_anything.hanes.utils.repl_skin import ReplSkin
        ReplSkin("hanes").success(f"Job order {order_id} completed")
    else:
        click.echo(json.dumps(result, indent=2, ensure_ascii=False, default=str))


@production_group.command("results")
@click.option("--order-no", default=None, help="Filter by order number")
@click.option("--page", default=1, type=int)
@click.option("--limit", default=20, type=int)
@click.pass_context
def list_results(ctx, order_no, page, limit):
    """List production results."""
    session: Session = ctx.obj["session"]
    result = session.backend.list_prod_results(
        orderNo=order_no, page=page, limit=limit
    )
    _output(ctx, result,
            headers=["ID", "OrderNo", "Good", "Defect", "Worker", "Date"],
            rows_fn=lambda r: [
                str(r.get("id", "")),
                r.get("orderNo", ""),
                str(r.get("goodQty", "")),
                str(r.get("defectQty", 0)),
                r.get("workerCode", ""),
                r.get("createdAt", "")[:10] if r.get("createdAt") else "",
            ])

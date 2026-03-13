"""
@file hanes_cli.py
@description Main CLI entry point for HANES MES CLI harness.
    Supports both one-shot subcommands and interactive REPL mode.

    Usage:
        cli-anything-hanes --help
        cli-anything-hanes auth login
        cli-anything-hanes --json master parts
        cli-anything-hanes  # enters REPL mode
"""

import json
import shlex
import sys

import click

from cli_anything.hanes import __version__
from cli_anything.hanes.core.session import Session
from cli_anything.hanes.core.master import master_group
from cli_anything.hanes.core.material import material_group
from cli_anything.hanes.core.production import production_group
from cli_anything.hanes.core.quality import quality_group
from cli_anything.hanes.core.inventory import inventory_group


@click.group(invoke_without_command=True)
@click.option("--json", "json_mode", is_flag=True, default=False,
              help="Output in JSON format for agent consumption")
@click.option("--base-url", default=None,
              help="API base URL (default: http://localhost:3003/api/v1)")
@click.option("--session-file", default=None, help="Path to session file")
@click.version_option(version=__version__, prog_name="cli-anything-hanes")
@click.pass_context
def cli(ctx, json_mode, base_url, session_file):
    """HANES MES CLI — Command-line interface to the HANES Manufacturing Execution System.

    Wraps the HANES MES REST API so AI agents and power users can operate
    the MES without a browser. Requires the backend to be running.
    """
    ctx.ensure_object(dict)

    session = Session(session_file=session_file)
    if base_url:
        session.base_url = base_url
        session.save()

    ctx.obj["session"] = session
    ctx.obj["json_mode"] = json_mode

    if ctx.invoked_subcommand is None:
        ctx.invoke(repl)


# ── Auth commands ────────────────────────────────────────────────

@cli.group("auth")
def auth_group():
    """Authentication and session management."""
    pass


@auth_group.command("login")
@click.option("--email", "-e", prompt="Email", help="User email")
@click.option("--password", "-p", prompt="Password", hide_input=True,
              help="User password")
@click.pass_context
def auth_login(ctx, email, password):
    """Login to HANES MES backend."""
    session: Session = ctx.obj["session"]
    try:
        result = session.login(email, password)
        if ctx.obj.get("json_mode"):
            click.echo(json.dumps(result, indent=2, ensure_ascii=False, default=str))
        else:
            from cli_anything.hanes.utils.repl_skin import ReplSkin
            skin = ReplSkin("hanes")
            skin.success(f"Logged in as {email}")
            if session.company:
                skin.status("Company", session.company)
            if session.plant:
                skin.status("Plant", session.plant)
    except Exception as e:
        if ctx.obj.get("json_mode"):
            click.echo(json.dumps({"error": str(e)}, indent=2))
        else:
            from cli_anything.hanes.utils.repl_skin import ReplSkin
            ReplSkin("hanes").error(str(e))
        ctx.exit(1)


@auth_group.command("me")
@click.pass_context
def auth_me(ctx):
    """Show current user info."""
    session: Session = ctx.obj["session"]
    if not session.is_authenticated:
        click.echo(json.dumps({"error": "Not logged in"}) if ctx.obj.get("json_mode")
                    else "Not logged in. Use: auth login")
        ctx.exit(1)
        return
    try:
        result = session.backend.me()
        if ctx.obj.get("json_mode"):
            click.echo(json.dumps(result, indent=2, ensure_ascii=False, default=str))
        else:
            from cli_anything.hanes.utils.repl_skin import ReplSkin
            skin = ReplSkin("hanes")
            data = result.get("data", result)
            skin.status_block({
                "Email": str(data.get("email", "")),
                "Role": str(data.get("role", "")),
                "Company": str(data.get("company", "")),
                "Plant": str(data.get("plant", "")),
            }, title="Current User")
    except Exception as e:
        click.echo(json.dumps({"error": str(e)}) if ctx.obj.get("json_mode")
                    else f"Error: {e}")
        ctx.exit(1)


@auth_group.command("logout")
@click.pass_context
def auth_logout(ctx):
    """Clear session and logout."""
    session: Session = ctx.obj["session"]
    session.clear()
    if ctx.obj.get("json_mode"):
        click.echo(json.dumps({"message": "Logged out"}))
    else:
        from cli_anything.hanes.utils.repl_skin import ReplSkin
        ReplSkin("hanes").success("Logged out")


@auth_group.command("status")
@click.pass_context
def auth_status(ctx):
    """Show session status."""
    session: Session = ctx.obj["session"]
    data = session.to_dict()
    if ctx.obj.get("json_mode"):
        click.echo(json.dumps(data, indent=2, ensure_ascii=False, default=str))
    else:
        from cli_anything.hanes.utils.repl_skin import ReplSkin
        skin = ReplSkin("hanes")
        skin.status_block({
            "Authenticated": "Yes" if data["authenticated"] else "No",
            "Email": data.get("user_email") or "-",
            "Company": data.get("company") or "-",
            "Plant": data.get("plant") or "-",
            "API URL": data.get("base_url", "-"),
            "Last Login": data.get("last_login") or "-",
        }, title="Session Status")


@auth_group.command("set-context")
@click.option("--company", "-c", default=None, help="Company code")
@click.option("--plant", "-p", default=None, help="Plant code")
@click.pass_context
def auth_set_context(ctx, company, plant):
    """Set company/plant context for multi-tenant queries."""
    session: Session = ctx.obj["session"]
    session.set_context(company=company, plant=plant)
    if ctx.obj.get("json_mode"):
        click.echo(json.dumps(session.to_dict(), indent=2, ensure_ascii=False))
    else:
        from cli_anything.hanes.utils.repl_skin import ReplSkin
        skin = ReplSkin("hanes")
        if company:
            skin.success(f"Company set to: {company}")
        if plant:
            skin.success(f"Plant set to: {plant}")


# ── Dashboard ────────────────────────────────────────────────────

@cli.group("dashboard")
def dashboard_group():
    """Dashboard and KPI queries."""
    pass


@dashboard_group.command("kpi")
@click.pass_context
def dashboard_kpi(ctx):
    """Show dashboard KPI summary."""
    session: Session = ctx.obj["session"]
    result = session.backend.get_dashboard_kpi()
    if ctx.obj.get("json_mode"):
        click.echo(json.dumps(result, indent=2, ensure_ascii=False, default=str))
    else:
        from cli_anything.hanes.utils.repl_skin import ReplSkin
        skin = ReplSkin("hanes")
        data = result.get("data", result)
        if isinstance(data, dict):
            skin.status_block(
                {k: str(v) for k, v in data.items()}, title="Dashboard KPI"
            )
        else:
            click.echo(json.dumps(result, indent=2, ensure_ascii=False, default=str))


# ── Register subcommand groups ───────────────────────────────────

cli.add_command(master_group)
cli.add_command(material_group)
cli.add_command(production_group)
cli.add_command(quality_group)
cli.add_command(inventory_group)


# ── REPL ─────────────────────────────────────────────────────────

@cli.command("repl", hidden=True)
@click.pass_context
def repl(ctx):
    """Interactive REPL mode."""
    from cli_anything.hanes.utils.repl_skin import ReplSkin

    skin = ReplSkin("hanes", version=__version__)
    skin.print_banner()

    session: Session = ctx.obj["session"]
    if session.is_authenticated:
        skin.info(f"Session active: {session.user_email}")
    else:
        skin.warning("Not logged in. Use: auth login")

    pt_session = skin.create_prompt_session()

    commands_help = {
        "auth login": "Login to the backend",
        "auth me": "Show current user",
        "auth status": "Show session status",
        "auth set-context": "Set company/plant",
        "master parts": "List parts",
        "master processes": "List processes",
        "master boms": "List BOMs",
        "master routings": "List routings",
        "material arrivals": "List arrivals",
        "material lots": "List material lots",
        "material stocks": "List material stocks",
        "production orders": "List job orders",
        "production results": "List production results",
        "quality reworks": "List rework orders",
        "quality defects": "List defect logs",
        "inventory product-stocks": "List product stocks",
        "inventory warehouses": "List warehouses",
        "dashboard kpi": "Show KPI summary",
        "help": "Show this help",
        "quit / exit": "Exit the REPL",
    }

    while True:
        try:
            context = session.user_email or ""
            line = skin.get_input(pt_session, context=context)
        except (EOFError, KeyboardInterrupt):
            skin.print_goodbye()
            break

        if not line:
            continue

        cmd = line.strip().lower()
        if cmd in ("quit", "exit", "q"):
            skin.print_goodbye()
            break

        if cmd == "help":
            skin.help(commands_help)
            continue

        try:
            args = shlex.split(line)
        except ValueError as e:
            skin.error(f"Parse error: {e}")
            continue

        try:
            cli.main(args=args, standalone_mode=False,
                     parent=ctx.parent, **{"obj": ctx.obj})
        except click.UsageError as e:
            skin.error(str(e))
        except click.Abort:
            skin.warning("Command aborted")
        except SystemExit:
            pass
        except Exception as e:
            skin.error(str(e))


# ── Entry point ──────────────────────────────────────────────────

def main():
    """CLI entry point for console_scripts."""
    cli(obj={})


if __name__ == "__main__":
    main()

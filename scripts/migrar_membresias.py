# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Crea las membresías persona-squad a partir de ``Persona.squads`` (ADR-0010, fase 1).

La lógica vive en ``app.services.membresias_backfill`` (la misma que corre sola al
arrancar la API y de forma perezosa en ``GET /membresias/persona/{id}``). Este script
queda para ejecutarla a mano, p. ej. en seco con ``--dry-run``.

Para cada persona y cada nombre en ``squads``: el nombre se resuelve a
``Aplicacion.nombre`` (su ``codigo`` es ``aplicacion_id`` y ``squad_id``); los nombres que
no resuelven se INFORMAN y no se crean. ``desde`` queda vacío («desde el inicio del
proyecto»). Idempotente: si la persona ya tiene una membresía en ese squad no crea otra.
No modifica ``Persona.squads``.

Uso:
    cd api
    python ../scripts/migrar_membresias.py [--dry-run]
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from app.db import cerrar_db, init_db  # noqa: E402
from app.services.membresias_backfill import backfill_todas  # noqa: E402


async def migrar(dry_run: bool = False) -> dict:
    """Ejecuta la migración y devuelve el informe (creadas, existentes, sin resolver...)."""
    return await backfill_todas(dry_run)


async def main(dry_run: bool) -> None:
    await init_db()
    informe = await migrar(dry_run)
    prefijo = "[dry-run] " if dry_run else ""
    print(f"{prefijo}Membresías creadas: {informe['creadas']}")
    print(f"{prefijo}Ya existían (omitidas): {informe['ya_existian']}")
    print(f"{prefijo}Inactivos con fecha de efecto completada: {informe['efecto_completado']}")
    sin_fecha = len(informe["efecto_respaldo"])
    print(f"{prefijo}Inactivos SIN fecha alguna (efecto de respaldo): {sin_fecha}")
    for persona, fecha in informe["efecto_respaldo"]:
        print(f"  - {persona}: efecto {fecha}")
    print(f"{prefijo}Nombres de squad sin Aplicacion (NO creados): {len(informe['sin_resolver'])}")
    for persona, nombre in informe["sin_resolver"]:
        print(f"  - {persona}: '{nombre}'")
    await cerrar_db()


if __name__ == "__main__":
    asyncio.run(main(dry_run="--dry-run" in sys.argv))

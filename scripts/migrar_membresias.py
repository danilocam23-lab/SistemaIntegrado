# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Crea las membresías persona-squad a partir de ``Persona.squads`` (ADR-0010, fase 1).

Para cada persona y cada nombre en ``squads``:
  * el nombre se resuelve a ``Aplicacion.nombre``; su ``codigo`` es ``aplicacion_id`` y
    ``squad_id``. Los nombres que no resuelven se INFORMAN y no se crean;
  * ``desde`` = mínimo entre la creación de la persona y el primer mes con registros de
    Control de Horas o Capacidad de esa persona (primer día del mes);
  * persona inactiva: ``Persona.fecha_efecto_desactivacion`` se rellena con la fecha de
    registro (``fecha_desactivacion``) si falta, y la membresía queda cerrada por cascada
    con ``hasta`` = esa fecha de efecto.

Idempotente: si la persona ya tiene alguna membresía en ese squad, no se crea otra.
No modifica ``Persona.squads``.

Uso:
    cd api
    python ../scripts/migrar_membresias.py [--dry-run]
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from app.db import cerrar_db, init_db  # noqa: E402
from app.documents.aplicacion import Aplicacion  # noqa: E402
from app.documents.capacidad import Capacidad  # noqa: E402
from app.documents.control_horas import ControlHoras  # noqa: E402
from app.documents.membresia import Membresia  # noqa: E402
from app.documents.persona import Persona  # noqa: E402
from app.services.vigencia import (  # noqa: E402
    a_datetime,
    a_fecha_instante,
    a_fecha_logica,
    hoy_bogota,
)


async def _primer_mes_con_datos() -> dict[str, date]:
    """Primer día del primer mes con Control de Horas o Capacidad, por persona."""
    primeros: dict[str, date] = {}

    def anotar(persona_id: str | None, dia: date) -> None:
        if persona_id and (persona_id not in primeros or dia < primeros[persona_id]):
            primeros[persona_id] = dia

    horas = await ControlHoras.get_pymongo_collection().aggregate([
        {"$match": {"anio": {"$gt": 0}, "mes": {"$gt": 0}}},
        {"$group": {
            "_id": "$persona_id",
            "p": {"$min": {"$add": [{"$multiply": ["$anio", 100]}, "$mes"]}},
        }},
    ])
    async for fila in horas:
        anotar(fila["_id"], date(fila["p"] // 100, fila["p"] % 100, 1))

    caps = await Capacidad.get_pymongo_collection().aggregate([
        {"$match": {"scope": "persona", "persona_id": {"$ne": None}}},
        {"$group": {"_id": "$persona_id", "p": {"$min": "$mes"}}},
    ])
    async for fila in caps:
        try:
            anio, mes = str(fila["p"]).split("-")
            anotar(fila["_id"], date(int(anio), int(mes), 1))
        except ValueError:
            continue
    return primeros


async def migrar(dry_run: bool = False) -> dict:
    """Ejecuta la migración y devuelve el informe (creadas, existentes, sin resolver...)."""
    apps = {a.nombre: a.codigo for a in await Aplicacion.find({}).to_list()}
    primeros = await _primer_mes_con_datos()
    informe: dict = {
        "creadas": 0, "ya_existian": 0, "efecto_completado": 0,
        "efecto_respaldo": [],  # (persona, fecha) inactivos sin ninguna fecha
        "sin_resolver": [],  # (persona, nombre de squad)
    }

    async for persona in Persona.find({}):
        pid = str(persona.id)
        efecto: date | None = None
        if not persona.activo:
            if persona.fecha_efecto_desactivacion is not None:
                efecto = a_fecha_logica(persona.fecha_efecto_desactivacion)
            else:
                # El registro es un instante (UTC): se convierte a la fecha de Bogotá.
                if persona.fecha_desactivacion is not None:
                    efecto = a_fecha_instante(persona.fecha_desactivacion)
                    informe["efecto_completado"] += 1
                else:
                    # Inactivo sin ninguna fecha: respaldo con la última actualización.
                    efecto = (
                        a_fecha_instante(persona.actualizado_en)
                        if persona.actualizado_en
                        else hoy_bogota()
                    )
                    informe["efecto_respaldo"].append((persona.nombre, efecto.isoformat()))
                if not dry_run:
                    persona.fecha_efecto_desactivacion = a_datetime(efecto)
                    await persona.save()

        for nombre in persona.squads or []:
            codigo = apps.get(nombre)
            if codigo is None:
                informe["sin_resolver"].append((persona.nombre, nombre))
                continue
            if await Membresia.find({"persona_id": pid, "squad_id": codigo}).count():
                informe["ya_existian"] += 1
                continue
            desde = a_fecha_instante(persona.creado_en)
            if pid in primeros:
                desde = min(desde, primeros[pid])
            if efecto is not None and efecto <= desde:
                desde = efecto - timedelta(days=1)
            m = Membresia(
                aplicacion_id=codigo,
                persona_id=pid,
                squad_id=codigo,
                desde=a_datetime(desde),
                activo=persona.activo,
            )
            if efecto is not None:
                m.hasta = a_datetime(efecto)
                m.fecha_efecto_desactivacion = m.hasta
                m.fecha_desactivacion = persona.fecha_desactivacion
                m.cerrada_por_cascada = True
            if not dry_run:
                await m.insert()
            informe["creadas"] += 1
    return informe


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

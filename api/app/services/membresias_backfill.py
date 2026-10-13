# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Backfill de membresías a partir de ``Persona.squads`` (ADR-0010).

Para cada persona y cada nombre en ``squads``:
  * el nombre se resuelve a ``Aplicacion.nombre``; su ``codigo`` es ``aplicacion_id`` y
    ``squad_id``. Los nombres que no resuelven se INFORMAN y no se crean (tampoco se
    quitan de ``Persona.squads``);
  * ``desde = None`` («desde el inicio del proyecto»);
  * persona inactiva: ``Persona.fecha_efecto_desactivacion`` se rellena con la fecha de
    registro (``fecha_desactivacion``) si falta, y la membresía queda cerrada por cascada
    con ``hasta`` = esa fecha de efecto.

Idempotente: si la persona ya tiene alguna membresía en ese squad no se crea otra.
NUNCA modifica ni reordena ``Persona.squads``. Lo usan el arranque de la API, el respaldo
perezoso de ``GET /membresias/persona/{id}`` y el script ``scripts/migrar_membresias.py``.
"""
import asyncio
import logging
from datetime import date
from typing import Any

from pymongo.errors import DuplicateKeyError

from app.documents.aplicacion import Aplicacion
from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.services.vigencia import a_datetime, a_fecha_instante, a_fecha_logica, hoy_bogota

_log = logging.getLogger("membresias_backfill")


def informe_vacio() -> dict[str, Any]:
    return {
        "creadas": 0,
        "ya_existian": 0,
        "efecto_completado": 0,
        "efecto_respaldo": [],  # (persona, fecha) inactivos sin ninguna fecha
        "sin_resolver": [],  # (persona, nombre de squad)
    }


async def codigos_por_nombre() -> dict[str, str]:
    """``{Aplicacion.nombre: Aplicacion.codigo}``."""
    return {a.nombre: a.codigo for a in await Aplicacion.find({}).to_list()}


async def _efecto_persona(persona: Persona, informe: dict, dry_run: bool) -> date | None:
    """Fecha de efecto de la persona inactiva (completándola si falta); ``None`` si activa."""
    if persona.activo:
        return None
    if persona.fecha_efecto_desactivacion is not None:
        return a_fecha_logica(persona.fecha_efecto_desactivacion)
    # El registro es un instante (UTC): se convierte a la fecha de Bogotá.
    if persona.fecha_desactivacion is not None:
        efecto = a_fecha_instante(persona.fecha_desactivacion)
        informe["efecto_completado"] += 1
    else:
        # Inactivo sin ninguna fecha: respaldo con la última actualización.
        efecto = (
            a_fecha_instante(persona.actualizado_en) if persona.actualizado_en else hoy_bogota()
        )
        informe["efecto_respaldo"].append((persona.nombre, efecto.isoformat()))
    if not dry_run:
        persona.fecha_efecto_desactivacion = a_datetime(efecto)
        # Update parcial: no se reescribe el documento completo (evita pisar cambios ajenos).
        await Persona.get_pymongo_collection().update_one(
            {"_id": persona.id},
            {"$set": {"fecha_efecto_desactivacion": persona.fecha_efecto_desactivacion}},
        )
    return efecto


async def backfill_persona(
    persona: Persona,
    apps: dict[str, str] | None = None,
    dry_run: bool = False,
    informe: dict[str, Any] | None = None,
    existentes: set[str] | None = None,
) -> int:
    """Crea las membresías que le faltan a la persona según ``Persona.squads``.

    ``existentes`` son los ``squad_id`` que la persona ya tiene cubiertos (el backfill
    masivo los trae de una sola consulta); si no se pasa se consulta aquí.
    Devuelve cuántas creó (o crearía en ``dry_run``). Acumula en ``informe`` si se pasa."""
    informe = informe if informe is not None else informe_vacio()
    if not persona.squads:
        return 0
    apps = apps if apps is not None else await codigos_por_nombre()
    pid = str(persona.id)
    if existentes is None:
        existentes = {m.squad_id for m in await Membresia.find({"persona_id": pid}).to_list()}
    creadas = 0
    efecto: date | None = None
    efecto_calculado = False
    for nombre in persona.squads:
        codigo = apps.get(nombre)
        if codigo is None:
            informe["sin_resolver"].append((persona.nombre, nombre))
            _log.debug("Persona '%s': squad '%s' sin Aplicacion", persona.nombre, nombre)
            continue
        if codigo in existentes:
            informe["ya_existian"] += 1
            continue
        if not efecto_calculado:
            efecto = await _efecto_persona(persona, informe, dry_run)
            efecto_calculado = True
        m = Membresia(
            aplicacion_id=codigo,
            persona_id=pid,
            squad_id=codigo,
            desde=None,
            activo=persona.activo,
        )
        if efecto is not None:
            m.hasta = a_datetime(efecto)
            m.fecha_efecto_desactivacion = m.hasta
            m.fecha_desactivacion = persona.fecha_desactivacion
            m.cerrada_por_cascada = True
        if not dry_run:
            try:
                await m.insert()
            except DuplicateKeyError:
                # Carrera con otro backfill (arranque + GET perezoso): ya existe.
                existentes.add(codigo)
                informe["ya_existian"] += 1
                continue
        existentes.add(codigo)
        informe["creadas"] += 1
        creadas += 1
    return creadas


async def backfill_todas(dry_run: bool = False) -> dict[str, Any]:
    """Backfill de todas las personas; devuelve el informe acumulado."""
    informe = informe_vacio()
    apps = await codigos_por_nombre()
    # Una sola lectura de lo ya cubierto (persona_id, squad_id); se compara en memoria.
    cubiertos: dict[str, set[str]] = {}
    cursor = Membresia.get_pymongo_collection().find({}, {"persona_id": 1, "squad_id": 1})
    async for doc in cursor:
        cubiertos.setdefault(doc["persona_id"], set()).add(doc["squad_id"])
    async for persona in Persona.find({"squads.0": {"$exists": True}}):
        previos = cubiertos.get(str(persona.id), set())
        await backfill_persona(persona, apps, dry_run, informe, set(previos))
    return informe


async def backfill_al_arrancar() -> int:
    """Backfill idempotente del arranque. Nunca interrumpe el arranque. Devuelve cuántas
    membresías creó."""
    try:
        informe = await backfill_todas()
    except Exception:
        _log.exception("Falló el backfill de membresías (se ignora)")
        return 0
    if informe["creadas"]:
        _log.info(
            "Backfill de membresías: %d creada(s); %d squad(s) sin Aplicacion (conservados)",
            informe["creadas"],
            len(informe["sin_resolver"]),
        )
    else:
        _log.debug("Backfill de membresías: nada que crear")
    return int(informe["creadas"])


_tarea_backfill: asyncio.Task | None = None


def lanzar_backfill_en_segundo_plano() -> asyncio.Task:
    """Lanza el backfill como tarea de fondo (no retrasa el arranque de la API)."""
    global _tarea_backfill
    _tarea_backfill = asyncio.create_task(backfill_al_arrancar(), name="backfill-membresias")
    return _tarea_backfill


async def detener_backfill() -> None:
    """Cancela la tarea de fondo si sigue corriendo (apagado de la API)."""
    tarea = _tarea_backfill
    if tarea is not None and not tarea.done():
        tarea.cancel()
        try:
            await tarea
        except (asyncio.CancelledError, Exception):
            pass

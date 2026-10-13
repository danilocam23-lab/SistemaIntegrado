# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Operaciones de escritura sobre ``Membresia`` (ADR-0010).

Las comparten el router de membresías y el de personas (cascada al desactivar a la
persona). El control de acceso a la aplicación de cada membresía lo hace el router.
"""
from datetime import date
from typing import Any

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.documents.base import ahora
from app.documents.bitacora import Bitacora
from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.services.vigencia import a_datetime, a_fecha_logica, hoy_bogota


async def hay_vigentes_desde(persona_id: str, fecha: date) -> bool:
    """¿Le queda a la persona alguna membresía vigente a partir de ``fecha``?

    Cuenta las abiertas y las cerradas con ``hasta`` posterior a ``fecha``. Se llama
    DESPUÉS de cerrar la membresía en cuestión (con ``hasta == fecha`` ya no cuenta)."""
    return (
        await Membresia.get_pymongo_collection().count_documents(
            {
                "persona_id": persona_id,
                "$or": [
                    {"hasta": None},
                    {"hasta": {"$gt": a_datetime(fecha)}, "$expr": {"$gt": ["$hasta", "$desde"]}},
                ],
            },
            limit=1,
        )
        > 0
    )


async def abrir(
    persona: Persona, squad_id: str, aplicacion_id: str, desde: date, autor: str | None
) -> Membresia:
    """Crea una membresía nueva (también es la forma de «reabrir» un squad).

    409 si se solapa con otra de la misma persona y squad (incluida una abierta) o si ya
    existe una con el mismo ``desde`` (índice único).
    """
    previas = await Membresia.find({"persona_id": str(persona.id), "squad_id": squad_id}).to_list()
    for previa in previas:
        if previa.hasta is None or a_fecha_logica(previa.hasta) > desde:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "La persona ya tiene una membresía vigente o solapada en ese squad.",
            )
    m = Membresia(
        aplicacion_id=aplicacion_id,
        persona_id=str(persona.id),
        squad_id=squad_id,
        desde=a_datetime(desde),
    )
    try:
        await m.insert()
    except DuplicateKeyError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ya existe una membresía de la persona en ese squad y fecha."
        ) from exc
    await Bitacora(
        aplicacion_id=aplicacion_id,
        entidad_tipo="membresia",
        entidad_id=str(m.id),
        accion="abrir",
        descripcion=f"Membresía de '{persona.nombre}' en {squad_id} desde {desde.isoformat()}",
        autor=autor,
    ).insert()
    return m


async def cerrar(
    m: Membresia, efecto: date, autor: str | None, cascada: bool = False
) -> Membresia:
    """Cierra una membresía con ``hasta = efecto`` (primer día sin pertenecer).

    ``efecto == desde`` es válido (0 días: nunca solapa, conserva el registro). Un efecto
    anterior a ``desde``: 422 en el cierre manual; en cascada se acota a ``desde`` y se
    deja constancia en la bitácora. ``fecha_desactivacion`` es el registro (``ahora()``).
    """
    desde = a_fecha_logica(m.desde)
    solicitado = efecto
    if efecto < desde:
        if not cascada:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "La fecha de efecto no puede ser anterior al inicio de la membresía.",
            )
        efecto = desde
    m.activo = False
    m.hasta = a_datetime(efecto)
    m.fecha_efecto_desactivacion = m.hasta
    m.fecha_desactivacion = ahora()
    m.cerrada_por_cascada = cascada
    m.marcar_actualizado()
    await m.save()
    nota = f" (acotada: se pidió {solicitado.isoformat()})" if solicitado != efecto else ""
    await Bitacora(
        aplicacion_id=m.aplicacion_id,
        entidad_tipo="membresia",
        entidad_id=str(m.id),
        accion="cerrar_cascada" if cascada else "cerrar",
        descripcion=f"Membresía en {m.squad_id} cerrada con efecto {efecto.isoformat()}{nota}",
        autor=autor,
    ).insert()
    return m


async def cerrar_en_cascada(persona: Persona, efecto: date, autor: str | None) -> int:
    """Aplica la desactivación general de la persona a TODAS sus membresías.

    Escritura entre aplicaciones INTENCIONAL: la desactivación general alcanza todos los
    squads de la persona, también los de aplicaciones a las que quien edita no tiene
    acceso (se consulta por ``persona_id``, id global único; nada se devuelve al cliente).

    * abiertas: se cierran con ``hasta = efecto`` (``cerrada_por_cascada``);
    * ya cerradas con ``hasta > efecto``: se acotan a ``efecto`` (``min(hasta, efecto)``);
    * una que aún no había empezado hoy (``desde`` futuro) y no rige antes del efecto
      se elimina; el resto nunca pierde historia (se acota a ``desde``, 0 días).
    """
    hoy = hoy_bogota()
    afectadas = 0
    for m in await Membresia.find({"persona_id": str(persona.id)}).to_list():
        desde = a_fecha_logica(m.desde)
        if m.hasta is not None and a_fecha_logica(m.hasta) <= efecto:
            continue  # ya terminaba antes (o el mismo día) del efecto
        if desde > hoy and desde >= efecto:
            await m.delete()  # nunca rigió
        else:
            await cerrar(m, efecto, autor, cascada=True)
        afectadas += 1
    return afectadas


async def liberar_cascada(persona: Persona) -> None:
    """Al reactivar a la persona las membresías dejan de estar «cerradas por cascada»:
    editar después su fecha de efecto no debe moverlas."""
    await Membresia.get_pymongo_collection().update_many(
        {"persona_id": str(persona.id), "cerrada_por_cascada": True},
        {"$set": {"cerrada_por_cascada": False}},
    )


async def propagar_fecha_efecto(persona: Persona, efecto: date) -> int:
    """Propaga una nueva fecha de efecto a las membresías cerradas por cascada.

    No toca las cerradas por separado. Si ``efecto`` queda antes de ``desde`` se acota
    a ``desde`` (0 días) en vez de perder la historia.
    """
    cascada = await Membresia.find(
        {"persona_id": str(persona.id), "cerrada_por_cascada": True}
    ).to_list()
    for m in cascada:
        m.hasta = a_datetime(max(efecto, a_fecha_logica(m.desde)))
        m.fecha_efecto_desactivacion = m.hasta
        m.marcar_actualizado()
        await m.save()
    return len(cascada)


async def fusionar_membresias(perdedor_id: str, ganador_id: str, session: Any = None) -> int:
    """Pasa las membresías de la persona perdedora a la ganadora (deduplicación).

    Si ambas tienen membresía del mismo squad con intervalos que se solapan (o el mismo
    ``desde``, por el índice único) se conserva una sola con el intervalo más amplio.
    Devuelve cuántas membresías del perdedor se procesaron.
    """
    ganadoras = await Membresia.find({"persona_id": ganador_id}, session=session).to_list()
    perdedoras = await Membresia.find({"persona_id": perdedor_id}, session=session).to_list()
    infinito = date.max
    for mp in perdedoras:
        dp = a_fecha_logica(mp.desde)
        hp = a_fecha_logica(mp.hasta) if mp.hasta else infinito
        coincide = None
        for mg in ganadoras:
            if mg.squad_id != mp.squad_id:
                continue
            dg = a_fecha_logica(mg.desde)
            hg = a_fecha_logica(mg.hasta) if mg.hasta else infinito
            if dg == dp or (dg < hp and dp < hg):
                coincide = (mg, hg)
                break
        if coincide is None:
            mp.persona_id = ganador_id
            mp.marcar_actualizado()
            await mp.save(session=session)
            ganadoras.append(mp)
            continue
        mg, hg = coincide
        mg.desde = a_datetime(min(a_fecha_logica(mg.desde), dp))
        if hp == infinito or hg == infinito:
            mg.hasta = None
            mg.activo = True
            mg.fecha_desactivacion = None
            mg.fecha_efecto_desactivacion = None
            mg.cerrada_por_cascada = False
        elif hp > hg:
            mg.hasta = mp.hasta
            mg.fecha_desactivacion = mp.fecha_desactivacion
            mg.fecha_efecto_desactivacion = mp.fecha_efecto_desactivacion
            mg.cerrada_por_cascada = mp.cerrada_por_cascada
        mg.marcar_actualizado()
        await mg.save(session=session)
        await mp.delete(session=session)
    return len(perdedoras)

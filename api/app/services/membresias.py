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

from app.documents.aplicacion import Aplicacion
from app.documents.base import ahora
from app.documents.bitacora import Bitacora
from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.services.vigencia import a_datetime, a_fecha_logica, desde_logica, hoy_bogota


async def hay_vigentes_desde(persona_id: str, fecha: date) -> bool:
    """¿Le queda a la persona alguna membresía vigente algún día desde ``fecha`` (incluida)?

    Cuenta las abiertas y las cerradas con ``hasta >= fecha`` (``hasta`` es el último día
    activo). Para saber si un cierre con efecto ``E`` dejó a la persona sin squads se
    consulta con ``E + 1 día``."""
    return (
        await Membresia.get_pymongo_collection().count_documents(
            {
                "persona_id": persona_id,
                "$or": [{"hasta": None}, {"hasta": {"$gte": a_datetime(fecha)}}],
            },
            limit=1,
        )
        > 0
    )


async def abrir(
    persona: Persona, squad_id: str, aplicacion_id: str, desde: date | None, autor: str | None
) -> Membresia:
    """Crea una membresía nueva (también es la forma de «reabrir» un squad).

    ``desde = None`` significa «desde el inicio del proyecto».

    409 si se solapa con otra de la misma persona y squad (incluida una abierta) o si ya
    existe una con el mismo ``desde`` (índice único).
    """
    previas = await Membresia.find({"persona_id": str(persona.id), "squad_id": squad_id}).to_list()
    for previa in previas:
        if previa.hasta is None or a_fecha_logica(previa.hasta) >= (desde or date.min):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "La persona ya tiene una membresía vigente o solapada en ese squad.",
            )
    m = Membresia(
        aplicacion_id=aplicacion_id,
        persona_id=str(persona.id),
        squad_id=squad_id,
        desde=a_datetime(desde) if desde else None,
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
        descripcion=(
            f"Membresía de '{persona.nombre}' en {squad_id} desde "
            f"{desde.isoformat() if desde else 'el inicio'}"
        ),
        autor=autor,
    ).insert()
    return m


async def cerrar(
    m: Membresia, efecto: date, autor: str | None, cascada: bool = False
) -> Membresia:
    """Cierra una membresía con ``hasta = efecto`` (ÚLTIMO día activo, incluido).

    ``efecto == desde`` es válido (dura 1 día). Un efecto anterior a ``desde``: 422 en el
    cierre manual; en cascada se acota a ``desde`` (1 día) y se deja constancia en la
    bitácora. ``fecha_desactivacion`` es el registro (``ahora()``).
    """
    desde = desde_logica(m.desde)
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


async def eliminar(m: Membresia, persona: Persona, autor: str | None) -> bool:
    """Borra físicamente una membresía (p. ej. squad asignado por error).

    Nada la referencia salvo la bitácora, que se conserva como rastro del borrado.
    Quita de ``persona.squads`` (en memoria; el llamador guarda) el nombre del squad si ya
    ninguna otra membresía lo cubre: ``recalcular_squads_persona`` lo trataría como dato
    legado y lo conservaría. Devuelve ``True`` si la persona se queda sin membresías.
    """
    await m.delete()
    if not await Membresia.find({"persona_id": str(persona.id), "squad_id": m.squad_id}).count():
        app = await Aplicacion.find_one(Aplicacion.codigo == m.squad_id)
        quitar = {m.squad_id, app.nombre if app else m.squad_id}
        persona.squads = [s for s in persona.squads or [] if s not in quitar]
    await Bitacora(
        aplicacion_id=m.aplicacion_id,
        entidad_tipo="membresia",
        entidad_id=str(m.id),
        accion="eliminar",
        descripcion=f"Membresía de '{persona.nombre}' en {m.squad_id} eliminada",
        autor=autor,
    ).insert()
    return (
        await Membresia.get_pymongo_collection().count_documents(
            {"persona_id": str(persona.id)}, limit=1
        )
        == 0
    )


async def cerrar_en_cascada(persona: Persona, efecto: date, autor: str | None) -> int:
    """Aplica la desactivación general de la persona a TODAS sus membresías.

    Escritura entre aplicaciones INTENCIONAL: la desactivación general alcanza todos los
    squads de la persona, también los de aplicaciones a las que quien edita no tiene
    acceso (se consulta por ``persona_id``, id global único; nada se devuelve al cliente).

    * abiertas: se cierran con ``hasta = efecto`` (último día activo, ``cerrada_por_cascada``);
    * ya cerradas con ``hasta > efecto``: se acotan a ``efecto`` (``min(hasta, efecto)``);
    * una que aún no había empezado hoy (``desde`` futuro) y empieza después del efecto
      se elimina; el resto nunca pierde historia (se acota a ``desde``, 1 día).
    """
    hoy = hoy_bogota()
    afectadas = 0
    for m in await Membresia.find({"persona_id": str(persona.id)}).to_list():
        desde = desde_logica(m.desde)
        if m.hasta is not None and a_fecha_logica(m.hasta) <= efecto:
            continue  # ya terminaba antes (o el mismo día) del efecto
        if desde > hoy and desde > efecto:
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
    a ``desde`` (1 día) en vez de perder la historia.
    """
    cascada = await Membresia.find(
        {"persona_id": str(persona.id), "cerrada_por_cascada": True}
    ).to_list()
    for m in cascada:
        m.hasta = a_datetime(max(efecto, desde_logica(m.desde)))
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
        dp = desde_logica(mp.desde)
        hp = a_fecha_logica(mp.hasta) if mp.hasta else infinito
        coincide = None
        for mg in ganadoras:
            if mg.squad_id != mp.squad_id:
                continue
            dg = desde_logica(mg.desde)
            hg = a_fecha_logica(mg.hasta) if mg.hasta else infinito
            if dg <= hp and dp <= hg:  # intervalos cerrados [d, h]
                coincide = (mg, hg)
                break
        if coincide is None:
            mp.persona_id = ganador_id
            mp.marcar_actualizado()
            await mp.save(session=session)
            ganadoras.append(mp)
            continue
        mg, hg = coincide
        if mg.desde is not None:
            mg.desde = None if mp.desde is None else a_datetime(min(desde_logica(mg.desde), dp))
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


async def editar(
    m: Membresia,
    persona: Persona,
    campos: dict[str, date | None],
    autor: str | None,
) -> Membresia:
    """Edita ``desde`` y/o ``hasta`` de una membresía (solo las claves presentes en ``campos``).

    * ``desde = None``: desde el inicio del proyecto; ``hasta = None``: reabre la membresía
      (``activo=True``, limpia efecto/registro de cierre/cascada); exige persona activa.
    * ``hasta`` con fecha (último día activo, incluido): ``activo=False`` y
      ``fecha_efecto_desactivacion = hasta``; se conserva ``fecha_desactivacion`` si existía.
    * 422 si ``hasta < desde`` (``hasta == desde`` = 1 día); 409 si el intervalo resultante
      se solapa con otra membresía de la misma persona y squad o duplica ``desde``.
    """
    nuevo_desde = desde_logica(m.desde)
    desde_valor = a_fecha_logica(m.desde) if m.desde is not None else None
    hasta_valor = a_fecha_logica(m.hasta) if m.hasta is not None else None
    if "desde" in campos:
        desde_valor = campos["desde"]
        nuevo_desde = date.min if desde_valor is None else desde_valor
    if "hasta" in campos:
        hasta_valor = campos["hasta"]
    if hasta_valor is not None and hasta_valor < nuevo_desde:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "'hasta' no puede ser anterior a 'desde'."
        )
    reabre = "hasta" in campos and hasta_valor is None and not m.activo
    if reabre and not persona.activo:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "La persona está inactiva; reactívela antes de reabrir."
        )
    fin = hasta_valor or date.max
    otras = await Membresia.find(
        {"persona_id": m.persona_id, "squad_id": m.squad_id, "_id": {"$ne": m.id}}
    ).to_list()
    for otra in otras:
        d2 = desde_logica(otra.desde)
        h2 = a_fecha_logica(otra.hasta) if otra.hasta else date.max
        if nuevo_desde <= h2 and d2 <= fin:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "El intervalo se solapa con otra membresía de la persona en ese squad.",
            )

    anterior = (m.desde, m.hasta)
    if "desde" in campos:
        m.desde = None if desde_valor is None else a_datetime(desde_valor)
    if "hasta" in campos:
        if hasta_valor is None:
            m.hasta = None
            m.activo = True
            m.fecha_efecto_desactivacion = None
            m.fecha_desactivacion = None
            m.cerrada_por_cascada = False
        else:
            m.hasta = a_datetime(hasta_valor)
            m.activo = False
            m.fecha_efecto_desactivacion = m.hasta
            if m.fecha_desactivacion is None:
                m.fecha_desactivacion = ahora()
            m.cerrada_por_cascada = False  # edición manual: ya no la mueve la persona
    m.marcar_actualizado()
    try:
        await m.save()
    except DuplicateKeyError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ya existe una membresía de la persona en ese squad y fecha."
        ) from exc
    await Bitacora(
        aplicacion_id=m.aplicacion_id,
        entidad_tipo="membresia",
        entidad_id=str(m.id),
        accion="editar",
        descripcion=(
            f"Membresía en {m.squad_id} editada: desde {_txt(anterior[0])} -> {_txt(m.desde)}, "
            f"hasta {_txt(anterior[1])} -> {_txt(m.hasta)}"
        ),
        autor=autor,
    ).insert()
    return m


def _txt(valor: Any) -> str:
    return "-" if valor is None else a_fecha_logica(valor).isoformat()

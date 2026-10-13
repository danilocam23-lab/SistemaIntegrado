# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Vigencia de la pertenencia persona-squad (ADR-0010).

Fuente única de la regla: un squad cuenta a la persona en un mes si estuvo
vigente AL MENOS UN DÍA de ese mes. Con el intervalo ``[desde, hasta)``:
``desde < inicio_mes_siguiente`` y (``hasta`` es ``None`` o ``hasta > inicio_mes``).
Todas las fechas son de calendario de Bogotá (UTC-5, sin horario de verano).
"""
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any

from app.documents.aplicacion import Aplicacion
from app.documents.base import ahora
from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.middleware.aplicacion import ContextoAplicacion

ZONA_BOGOTA = timezone(timedelta(hours=-5))


def hoy_bogota() -> date:
    """Fecha de calendario actual en Bogotá."""
    return ahora().astimezone(ZONA_BOGOTA).date()


def a_fecha_logica(valor: datetime | date) -> date:
    """Fecha de calendario guardada a medianoche (``desde``/``hasta``/efecto).

    Se guarda como medianoche UTC que *etiqueta* la fecha de Bogotá, así que NO se
    convierte de zona: un datetime con zona se pasa a UTC y se toma su fecha."""
    if isinstance(valor, datetime):
        if valor.tzinfo is not None:
            return valor.astimezone(UTC).date()
        return valor.date()
    return valor


def a_fecha_instante(valor: datetime | date) -> date:
    """Fecha de Bogotá de un INSTANTE real (``fecha_desactivacion``, ``creado_en``).

    Mongo devuelve datetimes sin zona que son UTC: se interpretan como UTC y se
    convierten a Bogotá (un registro a las 20:00 del 15 llega como 01:00 UTC del 16)."""
    if isinstance(valor, datetime):
        if valor.tzinfo is None:
            valor = valor.replace(tzinfo=UTC)
        return valor.astimezone(ZONA_BOGOTA).date()
    return valor


def a_datetime(fecha: date) -> datetime:
    """Fecha lógica de Bogotá como datetime a medianoche, sin zona (así la devuelve Mongo)."""
    return datetime(fecha.year, fecha.month, fecha.day)


def _parsear_mes(periodo: str) -> date:
    try:
        anio, mes = periodo.split("-")
        return date(int(anio), int(mes), 1)
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"Periodo inválido '{periodo}', se espera YYYY-MM") from exc


def _mes_siguiente(inicio: date) -> date:
    return date(inicio.year + (inicio.month == 12), inicio.month % 12 + 1, 1)


def rango_periodo(periodo: str | tuple[date, date]) -> tuple[date, date]:
    """Devuelve ``(inicio, fin_exclusivo)`` de un ``'YYYY-MM'`` o de un rango de
    fechas ``(primer_dia, ultimo_dia_incluido)``."""
    if isinstance(periodo, str):
        inicio = _parsear_mes(periodo)
        return inicio, _mes_siguiente(inicio)
    return periodo[0], periodo[1] + timedelta(days=1)


def meses_entre(desde: str, hasta: str) -> list[str]:
    """Lista de meses ``YYYY-MM`` entre ambos extremos, inclusive."""
    actual, ultimo = _parsear_mes(desde), _parsear_mes(hasta)
    meses: list[str] = []
    while actual <= ultimo:
        meses.append(f"{actual.year:04d}-{actual.month:02d}")
        actual = _mes_siguiente(actual)
    return meses


def solapa(m: Membresia, inicio: date, fin: date) -> bool:
    """¿La membresía estuvo vigente algún día de ``[inicio, fin)``? Una de 0 días
    (``hasta == desde``) nunca solapa."""
    desde = a_fecha_logica(m.desde)
    if desde >= fin:
        return False
    if m.hasta is None:
        return True
    hasta = a_fecha_logica(m.hasta)
    return hasta > desde and hasta > inicio


def _filtro_solape(inicio: date, fin: date) -> dict:
    return {
        "desde": {"$lt": a_datetime(fin)},
        "$or": [
            {"hasta": None},
            {"hasta": {"$gt": a_datetime(inicio)}, "$expr": {"$gt": ["$hasta", "$desde"]}},
        ],
    }


async def vigente(
    ctx: ContextoAplicacion, persona_id: str, squad_id: str, periodo: str | tuple[date, date]
) -> bool:
    """¿La persona perteneció al squad algún día del periodo? Consulta con ``ctx.filtro()``."""
    inicio, fin = rango_periodo(periodo)
    consulta = {
        **ctx.filtro(),
        "persona_id": persona_id,
        "squad_id": squad_id,
        **_filtro_solape(inicio, fin),
    }
    return await Membresia.get_pymongo_collection().count_documents(consulta, limit=1) > 0


async def squads_vigentes(
    ctx: ContextoAplicacion, desde: str, hasta: str
) -> dict[str, dict[str, list[str]]]:
    """Versión por lote: ``{persona_id: {mes: [squad_id]}}`` para los meses
    ``desde``..``hasta`` (``YYYY-MM``). Una sola consulta, acotada por ``ctx.filtro()``
    y por el solape con el rango; solo aparecen meses con algún squad vigente."""
    meses = meses_entre(desde, hasta)
    if not meses:
        return {}
    inicio, _ = rango_periodo(meses[0])
    _, fin = rango_periodo(meses[-1])
    cursor = Membresia.get_pymongo_collection().find(
        {**ctx.filtro(), **_filtro_solape(inicio, fin)},
        {"persona_id": 1, "squad_id": 1, "desde": 1, "hasta": 1},
    )
    rangos = {mes: rango_periodo(mes) for mes in meses}
    resultado: dict[str, dict[str, list[str]]] = {}
    async for doc in cursor:
        d = a_fecha_logica(doc["desde"])
        h = a_fecha_logica(doc["hasta"]) if doc.get("hasta") else None
        if h is not None and h <= d:
            continue  # membresía de 0 días: nunca rigió
        for mes, (ini_mes, fin_mes) in rangos.items():
            if d < fin_mes and (h is None or h > ini_mes):
                lista = resultado.setdefault(doc["persona_id"], {}).setdefault(mes, [])
                if doc["squad_id"] not in lista:
                    lista.append(doc["squad_id"])
    return resultado


async def recalcular_squads_persona(persona: Persona, session: Any = None) -> bool:
    """Recalcula ``persona.squads`` (derivado) con las membresías vigentes hoy.

    Conserva los nombres de ``squads`` que ninguna membresía de la persona cubre
    (datos legados aún no migrados o subequipos que no son una ``Aplicacion``).
    Solo toca el campo en memoria; el llamador guarda. Devuelve si cambió.

    Consulta por ``persona_id`` (id único global) sin ``aplicacion_id``: es un cálculo
    interno del dominio y no devuelve datos al cliente.
    """
    todas = await Membresia.find({"persona_id": str(persona.id)}, session=session).to_list()
    if not todas:
        return False
    hoy = hoy_bogota()
    codigos = {m.squad_id for m in todas}
    apps = await Aplicacion.find({"codigo": {"$in": list(codigos)}}, session=session).to_list()
    nombre_de = {a.codigo: a.nombre for a in apps}
    cubiertos = set(nombre_de.values()) | codigos
    vigentes_hoy: list[str] = []
    for m in todas:
        if solapa(m, hoy, hoy + timedelta(days=1)):
            nombre = nombre_de.get(m.squad_id, m.squad_id)
            if nombre not in vigentes_hoy:
                vigentes_hoy.append(nombre)
    extras = [s for s in (persona.squads or []) if s not in cubiertos]
    nuevos = vigentes_hoy + [s for s in extras if s not in vigentes_hoy]
    if nuevos == list(persona.squads or []):
        return False
    persona.squads = nuevos
    return True


async def recalcular_squads_todas() -> int:
    """Recalcula ``Persona.squads`` de todas las personas con membresías (job diario:
    una membresía con ``hasta`` futuro caduca sin que nadie escriba). Devuelve cuántas
    personas cambiaron."""
    ids = await Membresia.get_pymongo_collection().distinct("persona_id")
    cambiadas = 0
    for pid in ids:
        try:
            persona = await Persona.get(pid)
        except Exception:  # id mal formado
            persona = None
        if persona is not None and await recalcular_squads_persona(persona):
            persona.marcar_actualizado()
            await persona.save()
            cambiadas += 1
    return cambiadas

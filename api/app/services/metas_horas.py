# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Meta de horas (devengo) por persona y squad en un mes (ADR-0010).

Replica ``calcularHorasMeta`` de ``web/src/pages/ControlHorasFacturable.tsx``: lunes a
jueves 8,5 h, viernes 8 h, sábado/domingo y festivos 0 h. El rango de cada membresía se
recorta al mes con la regla de vigencia (``hasta`` = último día activo, incluido); los
squads en paralelo cuentan la meta COMPLETA en cada uno (sin dividir).
"""
from datetime import date, datetime, timedelta

from app.documents.aplicacion import Aplicacion
from app.documents.festivo import Festivo
from app.documents.membresia import Membresia
from app.middleware.aplicacion import ContextoAplicacion
from app.services.vigencia import _filtro_solape, a_fecha_logica, desde_logica, rango_periodo

HORAS_LUN_JUE = 8.5
HORAS_VIERNES = 8.0
_APP_GLOBAL = "global"  # los festivos son globales (ver api/festivos.py)


def horas_dia(dia: date) -> float:
    """Horas meta de un día de calendario sin considerar festivos."""
    semana = dia.weekday()  # 0=lunes ... 6=domingo
    if semana >= 5:
        return 0.0
    return HORAS_VIERNES if semana == 4 else HORAS_LUN_JUE


def meta_rango(desde: date, hasta: date, festivos: set[date]) -> tuple[int, float]:
    """``(días hábiles, horas meta)`` del rango ``[desde, hasta]`` (ambos incluidos)."""
    dias = 0
    horas = 0.0
    dia = desde
    while dia <= hasta:
        h = horas_dia(dia)
        if h and dia not in festivos:
            dias += 1
            horas += h
        dia += timedelta(days=1)
    return dias, horas


async def _festivos_del_mes(ctx: ContextoAplicacion, inicio: date, fin: date) -> set[date]:
    cursor = Festivo.get_pymongo_collection().find(
        {
            "aplicacion_id": {"$in": [*ctx.codigos, _APP_GLOBAL]},
            "fecha": {
                "$gte": _medianoche(inicio - timedelta(days=1)),
                "$lt": _medianoche(fin + timedelta(days=1)),
            },
        },
        {"fecha": 1},
    )
    fechas: set[date] = set()
    async for doc in cursor:
        fecha = a_fecha_logica(doc["fecha"])
        if inicio <= fecha < fin:
            fechas.add(fecha)
    return fechas


def _medianoche(dia: date) -> datetime:
    return datetime(dia.year, dia.month, dia.day)


async def metas_del_mes(ctx: ContextoAplicacion, anio: int, mes: int) -> list[dict]:
    """Una fila por membresía vigente al menos un día del mes: persona, squad (nombre de
    ``Aplicacion``), rango efectivo dentro del mes, días hábiles y horas meta."""
    inicio, fin = rango_periodo(f"{anio:04d}-{mes:02d}")
    ultimo = fin - timedelta(days=1)
    cursor = Membresia.get_pymongo_collection().find(
        {**ctx.filtro(), **_filtro_solape(inicio, fin)},
        {"persona_id": 1, "squad_id": 1, "desde": 1, "hasta": 1},
    )
    membresias = [doc async for doc in cursor]
    if not membresias:
        return []
    festivos = await _festivos_del_mes(ctx, inicio, fin)
    codigos = {m["squad_id"] for m in membresias}
    apps = await Aplicacion.find({"codigo": {"$in": list(codigos)}}).to_list()
    nombre_de = {a.codigo: a.nombre for a in apps}
    filas: list[dict] = []
    for m in membresias:
        desde = max(desde_logica(m.get("desde")), inicio)
        hasta = min(a_fecha_logica(m["hasta"]), ultimo) if m.get("hasta") else ultimo
        if hasta < desde:
            continue
        dias, horas = meta_rango(desde, hasta, festivos)
        filas.append({
            "persona_id": m["persona_id"],
            "squad": nombre_de.get(m["squad_id"], m["squad_id"]),
            "squad_id": m["squad_id"],
            "desde_efectivo": desde.isoformat(),
            "hasta_efectivo": hasta.isoformat(),
            "dias_habiles": dias,
            "horas_meta": horas,
        })
    filas.sort(key=lambda f: (f["persona_id"], f["squad"], f["desde_efectivo"]))
    return filas

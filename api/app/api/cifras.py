"""Router de cifras agregadas: tableros por estado, squad y cumplimiento de ANS.

ADR-0008 F3.1 (P2): los cuatro endpoints traían la colección `requerimientos`
completa y agregaban en Python. Se reescriben como pipelines `aggregate` de
Mongo (`$group`/`$facet`): un solo viaje por endpoint, sin traer documentos.
Solo se traen a Python los catálogos pequeños (`aplicaciones`, `squads`) que
hacen falta para resolver nombres.
"""
from bson import Decimal128
from fastapi import APIRouter, Depends

from app.documents.aplicacion import Aplicacion
from app.documents.requerimiento import Requerimiento
from app.documents.squad import Squad
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion

router = APIRouter(prefix="/cifras", tags=["cifras"])


def _resolver_nombre_squad(squad_id: str | None, squads_por_id: dict[str, str], apps_por_codigo: dict[str, str]) -> str:
    if not squad_id:
        return "Sin squad"
    valor = str(squad_id)
    return squads_por_id.get(valor) or apps_por_codigo.get(valor) or valor


def _a_float(valor: Decimal128 | int | float | None) -> float:
    """Convierte el resultado numérico de un `$sum` (puede venir en Decimal128) a float."""
    if isinstance(valor, Decimal128):
        return float(valor.to_decimal())
    return float(valor or 0)


async def _mapas_squad(ctx: ContextoAplicacion) -> tuple[dict[str, str], dict[str, str]]:
    apps = await Aplicacion.find_all().to_list()
    squads = await Squad.find(ctx.filtro()).to_list()
    app_map = {a.codigo: a.nombre for a in apps}
    squad_map = {str(s.id): s.nombre for s in squads}
    return squad_map, app_map


@router.get("/estado")
async def por_estado(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Cantidad de requerimientos y horas estimadas, agrupadas por estado."""
    pipeline = [
        {"$match": ctx.filtro()},
        {
            "$group": {
                "_id": "$estado",
                "cantidad": {"$sum": 1},
                "horas": {"$sum": "$total_horas_estimadas"},
            }
        },
        {"$sort": {"cantidad": -1}},
    ]
    filas = await Requerimiento.aggregate(pipeline).to_list()
    cifras = [
        {"estado": f["_id"], "cantidad": f["cantidad"], "horas": _a_float(f.get("horas"))}
        for f in filas
    ]
    return {"cifras": cifras}


@router.get("/squad")
async def por_squad(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Cantidad de requerimientos y horas estimadas, agrupadas por squad."""
    pipeline = [
        {"$match": ctx.filtro()},
        {
            "$group": {
                "_id": "$solicitud.squad_id",
                "cantidad": {"$sum": 1},
                "horas": {"$sum": "$total_horas_estimadas"},
            }
        },
    ]
    filas = await Requerimiento.aggregate(pipeline).to_list()
    squad_map, app_map = await _mapas_squad(ctx)

    agg: dict[str, dict] = {}
    for f in filas:
        nombre = _resolver_nombre_squad(f["_id"], squad_map, app_map)
        fila = agg.setdefault(nombre, {"squad": nombre, "cantidad": 0, "horas": 0.0})
        fila["cantidad"] += f["cantidad"]
        fila["horas"] += _a_float(f.get("horas"))
    return {"cifras": sorted(agg.values(), key=lambda f: f["cantidad"], reverse=True)}


@router.get("/ans")
async def por_ans(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Cumplimiento de ANS de estimación (requerimientos) y de entrega (entregas)."""
    pipeline = [
        {"$match": ctx.filtro()},
        {
            "$facet": {
                "estimacion": [
                    {
                        "$group": {
                            "_id": {"$ifNull": ["$ans_estimacion", "SIN_ANS"]},
                            "cantidad": {"$sum": 1},
                        }
                    }
                ],
                "entrega": [
                    {"$project": {"entregas.ans_entrega": 1}},
                    {"$unwind": "$entregas"},
                    {
                        "$group": {
                            "_id": {"$ifNull": ["$entregas.ans_entrega", "SIN_ANS"]},
                            "cantidad": {"$sum": 1},
                        }
                    }
                ],
            }
        },
    ]
    resultado = await Requerimiento.aggregate(pipeline).to_list()
    datos = resultado[0] if resultado else {"estimacion": [], "entrega": []}

    estimacion = {"CUMPLE": 0, "NO_CUMPLE": 0, "SIN_ANS": 0}
    entrega = {"CUMPLE": 0, "NO_CUMPLE": 0, "SIN_ANS": 0}
    for fila in datos.get("estimacion", []):
        clave = fila["_id"]
        estimacion[clave] = estimacion.get(clave, 0) + fila["cantidad"]
    for fila in datos.get("entrega", []):
        clave = fila["_id"]
        entrega[clave] = entrega.get(clave, 0) + fila["cantidad"]
    return {"estimacion": estimacion, "entrega": entrega}


@router.get("/liquidacion")
async def por_liquidacion(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Resumen de liquidación: monto pactado y horas por squad."""
    pipeline = [
        {"$match": ctx.filtro()},
        {
            "$facet": {
                "totales": [
                    {
                        "$group": {
                            "_id": None,
                            "total_monto": {"$sum": "$monto_pactado"},
                            "total_horas": {"$sum": "$total_horas_estimadas"},
                            "total_reqs": {"$sum": 1},
                            "con_monto": {
                                "$sum": {
                                    "$cond": [
                                        {
                                            "$and": [
                                                {"$ne": ["$monto_pactado", None]},
                                                {"$ne": ["$monto_pactado", 0]},
                                            ]
                                        },
                                        1,
                                        0,
                                    ]
                                }
                            },
                            "total_entregas": {"$sum": {"$size": {"$ifNull": ["$entregas", []]}}},
                        }
                    }
                ],
                "por_squad": [
                    {
                        "$group": {
                            "_id": "$solicitud.squad_id",
                            "monto": {"$sum": "$monto_pactado"},
                            "horas": {"$sum": "$total_horas_estimadas"},
                            "cantidad": {"$sum": 1},
                        }
                    }
                ],
            }
        },
    ]
    resultado = await Requerimiento.aggregate(pipeline).to_list()
    datos = resultado[0] if resultado else {"totales": [], "por_squad": []}
    totales = datos["totales"][0] if datos.get("totales") else {}

    squad_map, app_map = await _mapas_squad(ctx)
    por_squad_agg: dict[str, dict] = {}
    for fila in datos.get("por_squad", []):
        nombre = _resolver_nombre_squad(fila["_id"], squad_map, app_map)
        grupo = por_squad_agg.setdefault(
            nombre, {"squad": nombre, "monto": 0.0, "horas": 0.0, "cantidad": 0}
        )
        grupo["monto"] += _a_float(fila.get("monto"))
        grupo["horas"] += _a_float(fila.get("horas"))
        grupo["cantidad"] += fila["cantidad"]

    return {
        "total_monto": _a_float(totales.get("total_monto")),
        "total_horas": _a_float(totales.get("total_horas")),
        "total_reqs": totales.get("total_reqs", 0),
        "con_monto": totales.get("con_monto", 0),
        "total_entregas": totales.get("total_entregas", 0),
        "por_squad": sorted(por_squad_agg.values(), key=lambda f: f["monto"], reverse=True),
    }

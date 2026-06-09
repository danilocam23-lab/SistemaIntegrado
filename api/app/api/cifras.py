"""Router de cifras agregadas: tableros por estado, squad y cumplimiento de ANS."""
from fastapi import APIRouter, Depends

from app.documents.aplicacion import Aplicacion
from app.documents.requerimiento import Requerimiento
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion

router = APIRouter(prefix="/cifras", tags=["cifras"])


@router.get("/estado")
async def por_estado(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Cantidad de requerimientos y horas estimadas, agrupadas por estado."""
    reqs = await Requerimiento.find(ctx.filtro()).to_list()
    agg: dict[str, dict] = {}
    for r in reqs:
        clave = str(r.estado)
        fila = agg.setdefault(clave, {"estado": clave, "cantidad": 0, "horas": 0.0})
        fila["cantidad"] += 1
        fila["horas"] += float(r.total_horas_estimadas or 0)
    return {"cifras": sorted(agg.values(), key=lambda f: f["cantidad"], reverse=True)}


@router.get("/squad")
async def por_squad(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Cantidad de requerimientos y horas estimadas, agrupadas por squad."""
    reqs = await Requerimiento.find(ctx.filtro()).to_list()
    apps = await Aplicacion.find_all().to_list()
    app_map: dict[str, str] = {a.codigo: a.nombre for a in apps}
    agg: dict[str, dict] = {}
    for r in reqs:
        nombre = app_map.get(r.solicitud.squad_id or "", r.solicitud.squad_id or "Sin squad")
        fila = agg.setdefault(nombre, {"squad": nombre, "cantidad": 0, "horas": 0.0})
        fila["cantidad"] += 1
        fila["horas"] += float(r.total_horas_estimadas or 0)
    return {"cifras": sorted(agg.values(), key=lambda f: f["cantidad"], reverse=True)}


@router.get("/ans")
async def por_ans(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Cumplimiento de ANS de estimación (requerimientos) y de entrega (entregas)."""
    reqs = await Requerimiento.find(ctx.filtro()).to_list()
    estimacion = {"CUMPLE": 0, "NO_CUMPLE": 0, "SIN_ANS": 0}
    entrega = {"CUMPLE": 0, "NO_CUMPLE": 0, "SIN_ANS": 0}
    for r in reqs:
        clave = str(r.ans_estimacion) if r.ans_estimacion else "SIN_ANS"
        estimacion[clave] = estimacion.get(clave, 0) + 1
        for ent in r.entregas:
            clave_e = str(ent.ans_entrega) if ent.ans_entrega else "SIN_ANS"
            entrega[clave_e] = entrega.get(clave_e, 0) + 1
    return {"estimacion": estimacion, "entrega": entrega}


@router.get("/liquidacion")
async def por_liquidacion(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Resumen de liquidación: monto pactado y horas por squad."""
    reqs = await Requerimiento.find(ctx.filtro()).to_list()
    apps = await Aplicacion.find_all().to_list()
    app_map: dict[str, str] = {a.codigo: a.nombre for a in apps}

    total_monto = 0.0
    total_horas = 0.0
    total_entregas = 0
    con_monto = 0
    por_squad: dict[str, dict] = {}

    for r in reqs:
        monto = float(r.monto_pactado or 0)
        horas = float(r.total_horas_estimadas or 0)
        total_monto += monto
        total_horas += horas
        total_entregas += len(r.entregas)
        if r.monto_pactado:
            con_monto += 1
        squad = app_map.get(r.solicitud.squad_id or "", r.solicitud.squad_id or "Sin squad")
        fila = por_squad.setdefault(squad, {"squad": squad, "monto": 0.0, "horas": 0.0, "cantidad": 0})
        fila["monto"] += monto
        fila["horas"] += horas
        fila["cantidad"] += 1

    return {
        "total_monto": total_monto,
        "total_horas": total_horas,
        "total_reqs": len(reqs),
        "con_monto": con_monto,
        "total_entregas": total_entregas,
        "por_squad": sorted(por_squad.values(), key=lambda f: f["monto"], reverse=True),
    }

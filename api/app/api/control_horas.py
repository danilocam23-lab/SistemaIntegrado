"""API Control de Horas Facturables."""
from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.documents.control_horas import ControlHoras
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.security.deps import requiere_permiso

router = APIRouter(prefix="/control-horas", tags=["control-horas"])

_CAMPOS = [
    "persona_id", "squad", "lt_hitss", "anio", "mes",
    "horas_soporte", "horas_desarrollo",
    "horas_soporte_cerrado", "horas_desarrollo_cerrado",
    "horas_vacaciones", "horas_incapacidades", "horas_licencias",
    "horas_permisos", "otras_novedades",
    "horas_errores_analista", "horas_garantias", "horas_reprocesos",
    "otras_novedades_calidad", "observaciones",
]


class ControlHorasIn(BaseModel):
    persona_id: str
    squad: str
    lt_hitss: str = ""
    horas_soporte: float = 0
    horas_desarrollo: float = 0
    horas_soporte_cerrado: float = 0
    horas_desarrollo_cerrado: float = 0
    horas_vacaciones: float = 0
    horas_incapacidades: float = 0
    horas_licencias: float = 0
    horas_permisos: float = 0
    otras_novedades: float = 0
    horas_errores_analista: float = 0
    horas_garantias: float = 0
    horas_reprocesos: float = 0
    otras_novedades_calidad: float = 0
    observaciones: str = ""


class ControlHorasBulkIn(BaseModel):
    registros: list[ControlHorasIn]


def _doc_a_dict(d: ControlHoras) -> dict:
    return {c: getattr(d, c) for c in _CAMPOS} | {"id": str(d.id)}


def _aplicar(doc: ControlHoras, datos: ControlHorasIn) -> None:
    for c in _CAMPOS:
        if c not in ("persona_id", "squad", "anio", "mes"):
            setattr(doc, c, getattr(datos, c))


@router.get("", dependencies=[Depends(requiere_permiso("control_horas_facturable.ver"))])
async def listar(
    anio: int = Query(0),
    mes: int = Query(0),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> list[dict]:
    hoy = date.today()
    a = anio or hoy.year
    m = mes or hoy.month
    docs = await ControlHoras.find({
        "aplicacion_id": {"$in": ctx.codigos},
        "anio": a,
        "mes": m,
    }).to_list()
    return [_doc_a_dict(d) for d in docs]


@router.put(
    "/registro",
    dependencies=[Depends(requiere_permiso("control_horas_facturable.editar"))],
)
async def guardar_uno(
    datos: ControlHorasIn,
    anio: int = Query(0),
    mes: int = Query(0),
    # F1.3 (ADR-0008 S8): antes contexto_aplicacion permitía escribir en modo
    # consolidado, cayendo en `codigos[0]` (una aplicación arbitraria).
    ctx: ContextoAplicacion = Depends(contexto_escritura),
) -> dict:
    hoy = date.today()
    a = anio or hoy.year
    m = mes or hoy.month
    filtro = {
        "aplicacion_id": ctx.codigo,
        "anio": a,
        "mes": m,
        "persona_id": datos.persona_id,
        "squad": datos.squad,
    }
    doc = await ControlHoras.find_one(filtro)
    if doc is None:
        doc = ControlHoras(aplicacion_id=ctx.codigo, anio=a, mes=m,
                           persona_id=datos.persona_id, squad=datos.squad)
    _aplicar(doc, datos)
    doc.marcar_actualizado()
    await doc.save()
    return {"ok": True, "id": str(doc.id)}


@router.put(
    "/todos",
    dependencies=[Depends(requiere_permiso("control_horas_facturable.editar"))],
)
async def guardar_todos(
    datos: ControlHorasBulkIn,
    anio: int = Query(0),
    mes: int = Query(0),
    ctx: ContextoAplicacion = Depends(contexto_escritura),
) -> dict:
    hoy = date.today()
    a = anio or hoy.year
    m = mes or hoy.month
    guardados = 0
    for r in datos.registros:
        filtro = {
            "aplicacion_id": ctx.codigo,
            "anio": a,
            "mes": m,
            "persona_id": r.persona_id,
            "squad": r.squad,
        }
        doc = await ControlHoras.find_one(filtro)
        if doc is None:
            doc = ControlHoras(aplicacion_id=ctx.codigo, anio=a, mes=m,
                               persona_id=r.persona_id, squad=r.squad)
        _aplicar(doc, r)
        doc.marcar_actualizado()
        await doc.save()
        guardados += 1
    return {"ok": True, "guardados": guardados}

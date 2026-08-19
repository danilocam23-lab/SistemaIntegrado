"""API Control de Horas Facturables."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.documents.control_horas import ControlHoras
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion

router = APIRouter(prefix="/control-horas", tags=["control-horas"])


class ControlHorasIn(BaseModel):
    persona_id: str
    squad: str
    lt_hitss: str = ""
    horas_soporte: float = 0
    horas_desarrollo: float = 0


class ControlHorasBulkIn(BaseModel):
    registros: list[ControlHorasIn]


@router.get("")
async def listar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> list[dict]:
    """Devuelve todos los registros de control de horas."""
    docs = await ControlHoras.find({"aplicacion_id": {"$in": ctx.codigos}}).to_list()
    return [
        {
            "id": str(d.id),
            "persona_id": d.persona_id,
            "squad": d.squad,
            "lt_hitss": d.lt_hitss,
            "horas_soporte": d.horas_soporte,
            "horas_desarrollo": d.horas_desarrollo,
        }
        for d in docs
    ]


@router.put("/registro")
async def guardar_uno(
    datos: ControlHorasIn,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    """Guarda o actualiza un registro individual."""
    doc = await ControlHoras.find_one({
        "aplicacion_id": ctx.codigo,
        "persona_id": datos.persona_id,
        "squad": datos.squad,
    })
    if doc is None:
        doc = ControlHoras(
            aplicacion_id=ctx.codigo,
            persona_id=datos.persona_id,
            squad=datos.squad,
        )
    doc.lt_hitss = datos.lt_hitss
    doc.horas_soporte = datos.horas_soporte
    doc.horas_desarrollo = datos.horas_desarrollo
    doc.marcar_actualizado()
    await doc.save()
    return {"ok": True, "id": str(doc.id)}


@router.put("/todos")
async def guardar_todos(
    datos: ControlHorasBulkIn,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    """Guarda o actualiza todos los registros en lote."""
    guardados = 0
    for r in datos.registros:
        doc = await ControlHoras.find_one({
            "aplicacion_id": ctx.codigo,
            "persona_id": r.persona_id,
            "squad": r.squad,
        })
        if doc is None:
            doc = ControlHoras(
                aplicacion_id=ctx.codigo,
                persona_id=r.persona_id,
                squad=r.squad,
            )
        doc.lt_hitss = r.lt_hitss
        doc.horas_soporte = r.horas_soporte
        doc.horas_desarrollo = r.horas_desarrollo
        doc.marcar_actualizado()
        await doc.save()
        guardados += 1
    return {"ok": True, "guardados": guardados}

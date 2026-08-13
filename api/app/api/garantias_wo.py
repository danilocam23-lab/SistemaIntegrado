"""Endpoints para gestión de garantías de Work Orders."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.documents.garantia_wo import GarantiaWO
from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabrica
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion

router = APIRouter(prefix="/garantias-wo", tags=["garantias-wo"])


class GarantiaWOIn(BaseModel):
    work_order_id: str


class GarantiaWOUpdate(BaseModel):
    observaciones: str | None = None
    observaciones_resolucion: str | None = None


@router.get("")
async def listar(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    """Listar todas las garantías WO filtradas por aplicación activa."""
    filtro = ctx.filtro()
    docs = await GarantiaWO.find(filtro).sort("-creado_en").to_list()
    return [{**doc.dict(by_alias=True), "_id": str(doc.id)} for doc in docs]


@router.post("", status_code=201)
async def agregar(
    body: GarantiaWOIn,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Agregar una WO como garantía buscándola en soporte."""
    existente = await GarantiaWO.find_one({"work_order_id": body.work_order_id})
    if existente:
        raise HTTPException(409, "Esta WO ya está registrada como garantía")

    wo = await SoporteSolicitudFabrica.find_one(
        {"datos.Work Order ID": body.work_order_id, **ctx.filtro()}
    )
    if not wo:
        raise HTTPException(404, f"No se encontró la WO '{body.work_order_id}' en soporte")

    datos = wo.datos or {}
    doc = GarantiaWO(
        work_order_id=body.work_order_id,
        aplicacion_id=wo.aplicacion_id,
        squad=wo.squad,
        lider=wo.lider,
        descripcion=datos.get("Descripción") or datos.get("Descripcion") or datos.get("Description") or None,
        fecha_creacion_wo=datos.get("Fecha Creación") or datos.get("Fecha_Creacion") or datos.get("Created Date") or None,
        estado_wo=datos.get("Estado") or datos.get("State") or None,
    )
    await doc.insert()
    return doc.dict(by_alias=True)


@router.put("/{garantia_id}")
async def actualizar(garantia_id: str, body: GarantiaWOUpdate):
    """Actualizar observaciones de una garantía WO."""
    from bson import ObjectId
    doc = await GarantiaWO.get(ObjectId(garantia_id))
    if not doc:
        raise HTTPException(404, "Garantía no encontrada")
    if body.observaciones is not None:
        doc.observaciones = body.observaciones
    if body.observaciones_resolucion is not None:
        doc.observaciones_resolucion = body.observaciones_resolucion
    doc.marcar_actualizado()
    await doc.save()
    return doc.dict(by_alias=True)


@router.delete("/{garantia_id}", status_code=204)
async def eliminar(garantia_id: str):
    """Eliminar una garantía WO."""
    from bson import ObjectId
    doc = await GarantiaWO.get(ObjectId(garantia_id))
    if not doc:
        raise HTTPException(404, "Garantía no encontrada")
    await doc.delete()


@router.get("/buscar-wo")
async def buscar_wo(
    q: str = Query(..., min_length=1),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Buscar WO en soporte por Work Order ID (parcial), filtrado por app."""
    import re
    patron = re.compile(re.escape(q), re.IGNORECASE)
    filtro = {"datos.Work Order ID": {"$regex": patron.pattern, "$options": "i"}, **ctx.filtro()}
    resultados = await SoporteSolicitudFabrica.find(filtro).limit(10).to_list()

    return [
        {
            "work_order_id": r.datos.get("Work Order ID", ""),
            "aplicacion_id": r.aplicacion_id,
            "squad": r.squad,
            "lider": r.lider,
            "descripcion": r.datos.get("Descripción") or r.datos.get("Descripcion") or r.datos.get("Description") or "",
            "estado": r.datos.get("Estado") or r.datos.get("State") or "",
        }
        for r in resultados
    ]

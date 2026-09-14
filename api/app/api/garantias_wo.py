"""Endpoints para gestión de garantías de Work Orders."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo import UpdateOne

from app.documents.base import ahora
from app.documents.garantia_wo import GarantiaWO
from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabrica
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.security.deps import permiso

# F1.8 (ADR-0008 S3): ninguno de estos endpoints exigía ningún permiso.
# Se reutilizan los permisos ya existentes del módulo de soporte
# (la página de garantías vive bajo /soporte/garantias-wo en el frontend
# y ya se gatea ahí con "soporte.solicitudes_fabrica.ver").
router = APIRouter(prefix="/garantias-wo", tags=["garantias-wo"])
_VER = permiso("soporte.solicitudes_fabrica.ver")
_ACTUALIZAR = permiso("soporte.solicitudes_fabrica.actualizar")


class GarantiaWOIn(BaseModel):
    work_order_id: str


class GarantiaWOUpdate(BaseModel):
    observaciones: str | None = None
    observaciones_resolucion: str | None = None


@router.get("", dependencies=[_VER])
async def listar(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    """Listar todas las garantías WO filtradas por aplicación activa.

    ADR-0008 F3.3/C4 (P7): el backfill de registros antiguos sin
    descripción/estado (creados antes de corregir el mapeo de columnas de
    soporte) hacía un ``find_one`` + ``save`` por documento dentro del bucle
    (N+1). Se resuelve en dos consultas — una para traer TODAS las WO de
    soporte que hacen falta, y un único ``bulk_write`` para los cambios—, sin
    tocar el contrato del endpoint (sigue siendo un único `GET`).
    """
    filtro = ctx.filtro()
    docs = await GarantiaWO.find(filtro).sort("-creado_en").to_list()

    pendientes = [d for d in docs if not (d.descripcion and d.estado_wo)]
    if pendientes:
        wo_ids = list({d.work_order_id for d in pendientes})
        # La búsqueda se restringe a las aplicaciones del contexto (S7): antes
        # cruzaba aplicaciones porque no llevaba ningún filtro de aplicacion_id.
        soportes = await SoporteSolicitudFabrica.find(
            {"datos.Work Order ID": {"$in": wo_ids}, "aplicacion_id": {"$in": ctx.codigos}}
        ).to_list()
        soporte_por_clave = {
            (s.aplicacion_id, s.datos.get("Work Order ID")): s for s in soportes
        }

        marca = ahora()
        operaciones = []
        for doc in pendientes:
            wo = soporte_por_clave.get((doc.aplicacion_id, doc.work_order_id))
            if wo is None:
                continue
            datos = wo.datos or {}
            cambios: dict = {}
            if not doc.descripcion:
                nueva_desc = datos.get("Detailed Description") or datos.get("Summary") or None
                if nueva_desc:
                    cambios["descripcion"] = nueva_desc
            if not doc.estado_wo:
                nuevo_estado = datos.get("Status WO") or None
                if nuevo_estado:
                    cambios["estado_wo"] = nuevo_estado
            if not cambios:
                continue
            cambios["actualizado_en"] = marca
            operaciones.append(UpdateOne({"_id": doc.id}, {"$set": cambios}))
            for campo, valor in cambios.items():
                setattr(doc, campo, valor)

        if operaciones:
            await GarantiaWO.get_pymongo_collection().bulk_write(operaciones)

    return [{**doc.dict(by_alias=True), "_id": str(doc.id)} for doc in docs]


@router.post("", status_code=201, dependencies=[_ACTUALIZAR])
async def agregar(
    body: GarantiaWOIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
):
    """Agregar una WO como garantía buscándola en soporte."""
    # F1.3/S7 (ADR-0008): antes usaba contexto_aplicacion (permitía escribir en
    # modo consolidado con una aplicación arbitraria) y comprobaba duplicados
    # sin filtrar por aplicacion_id (dos aplicaciones no podían registrar la
    # misma WO por el índice único global; ver documents/garantia_wo.py).
    existente = await GarantiaWO.find_one({"work_order_id": body.work_order_id, **ctx.filtro()})
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
        descripcion=datos.get("Detailed Description") or datos.get("Summary") or None,
        fecha_creacion_wo=datos.get("Fecha Creación") or datos.get("Fecha_Creacion") or datos.get("Created Date") or None,
        estado_wo=datos.get("Status WO") or None,
    )
    await doc.insert()
    return doc.dict(by_alias=True)


@router.put("/{garantia_id}", dependencies=[_ACTUALIZAR])
async def actualizar(
    garantia_id: str,
    body: GarantiaWOUpdate,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
):
    """Actualizar observaciones de una garantía WO."""
    from bson import ObjectId

    # F1.4 (ADR-0008): antes no recibía ``ctx`` en absoluto — ni exigía
    # X-Aplicacion ni comprobaba que la garantía perteneciera a una
    # aplicación autorizada; cualquier usuario autenticado podía editar la
    # garantía de cualquier aplicación conociendo su id.
    doc = await GarantiaWO.get(ObjectId(garantia_id))
    if not doc or doc.aplicacion_id != ctx.codigo:
        raise HTTPException(404, "Garantía no encontrada")
    if body.observaciones is not None:
        doc.observaciones = body.observaciones
    if body.observaciones_resolucion is not None:
        doc.observaciones_resolucion = body.observaciones_resolucion
    doc.marcar_actualizado()
    await doc.save()
    return doc.dict(by_alias=True)


@router.delete("/{garantia_id}", status_code=204, dependencies=[_ACTUALIZAR])
async def eliminar(
    garantia_id: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
):
    """Eliminar una garantía WO."""
    from bson import ObjectId

    # F1.4 (ADR-0008): mismo caso que ``actualizar`` — sin ``ctx`` antes.
    doc = await GarantiaWO.get(ObjectId(garantia_id))
    if not doc or doc.aplicacion_id != ctx.codigo:
        raise HTTPException(404, "Garantía no encontrada")
    await doc.delete()


@router.get("/buscar-wo", dependencies=[_VER])
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
            "descripcion": r.datos.get("Detailed Description") or r.datos.get("Summary") or "",
            "estado": r.datos.get("Status WO") or "",
        }
        for r in resultados
    ]


@router.get("/detalle-wo/{work_order_id}", dependencies=[_VER])
async def detalle_wo(
    work_order_id: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Devuelve toda la información disponible de una WO en soporte (todas las columnas)."""
    wo = await SoporteSolicitudFabrica.find_one(
        {"datos.Work Order ID": work_order_id, **ctx.filtro()}
    )
    if not wo:
        raise HTTPException(404, f"No se encontró la WO '{work_order_id}' en soporte")
    return {
        "work_order_id": work_order_id,
        "aplicacion_id": wo.aplicacion_id,
        "squad": wo.squad,
        "lider": wo.lider,
        "datos": wo.datos or {},
    }

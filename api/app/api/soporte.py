"""API de Soporte / Solicitudes Fábrica."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import requiere_permiso
from app.services.soporte_solicitudes_fabrica_service import SoporteSolicitudesFabricaService
 
router = APIRouter(prefix="/soporte/solicitudes-fabrica", tags=["soporte"])


class DetalleAnsUpdate(BaseModel):
    tipo: str
    se_levanto_ans: bool | None = None
    observaciones: str | None = None


@router.get("")
async def listar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = Depends(requiere_permiso("soporte.solicitudes_fabrica.ver")),
) -> dict:
    return await SoporteSolicitudesFabricaService.listar(ctx)


@router.get("/pagina")
async def listar_paginado(
    pagina: int = 1,
    tamanio: int = 100,
    filtro_wo: str = "",
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = Depends(requiere_permiso("soporte.solicitudes_fabrica.ver")),
) -> dict:
    """Endpoint paginado para tablas grandes. Devuelve una página de registros."""
    return await SoporteSolicitudesFabricaService.listar_paginado(
        ctx, pagina=pagina, tamanio=tamanio, filtro_wo=filtro_wo or None
    )


@router.get("/resumen")
async def resumen(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = Depends(requiere_permiso("soporte.solicitudes_fabrica.ver")),
) -> dict:
    """Resumen ligero: solo campos clave por registro, sin datos completos."""
    return await SoporteSolicitudesFabricaService.resumen(ctx)


@router.get("/ans-datos")
async def ans_datos(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = Depends(requiere_permiso("soporte.solicitudes_fabrica.ver")),
) -> dict:
    """Datos ligeros para la vista Detalle ANS (solo campos ANS relevantes)."""
    return await SoporteSolicitudesFabricaService.datos_ans(ctx)


@router.patch("/{registro_id}/detalle-ans")
async def actualizar_detalle_ans(
    registro_id: str,
    datos: DetalleAnsUpdate,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = Depends(requiere_permiso("soporte.detalle_ans.editar")),
) -> dict:
    try:
        return await SoporteSolicitudesFabricaService.actualizar_detalle_ans(
            ctx,
            registro_id,
            tipo=datos.tipo,
            se_levanto_ans=datos.se_levanto_ans,
            observaciones=datos.observaciones,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
 
 
@router.post("/previsualizar")
async def previsualizar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    archivo: UploadFile | None = File(default=None),
    _: object = Depends(requiere_permiso("soporte.solicitudes_fabrica.actualizar")),
) -> dict:
    try:
        if archivo is None:
            raise ValueError("Debe cargar el archivo Excel para continuar.")
        contenido = await archivo.read()
        return await SoporteSolicitudesFabricaService.previsualizar(
            ctx,
            contenido_excel=contenido,
            nombre_archivo=archivo.filename,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/sincronizar")
async def sincronizar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    archivo: UploadFile | None = File(default=None),
    _: object = Depends(requiere_permiso("soporte.solicitudes_fabrica.actualizar")),
) -> dict:
    try:
        if archivo is None:
            raise ValueError("Debe cargar el archivo Excel para continuar.")
        contenido = await archivo.read()
        return await SoporteSolicitudesFabricaService.sincronizar(
            ctx,
            contenido_excel=contenido,
            nombre_archivo=archivo.filename,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"No se pudo sincronizar: {exc}") from exc


@router.get("/wo-por-persona")
async def wo_por_persona(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> list[dict]:
    """Devuelve WOs con campos clave para cruzar con personas en Asignaciones."""
    from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabrica

    registros = await SoporteSolicitudFabrica.find(
        {"aplicacion_id": {"$in": ctx.codigos}}
    ).to_list()
    resultado = []
    for r in registros:
        d = r.datos or {}
        assigned = d.get("Assigned To", "").strip()
        if not assigned:
            continue
        resultado.append({
            "id": str(r.id),
            "wo_id": d.get("Work Order ID", ""),
            "assigned_to": assigned,
            "status": d.get("Status WO", ""),
            "priority": d.get("Priority", ""),
            "created_date": d.get("Created Date", ""),
            "descripcion": d.get("Short Description", d.get("Descripción", "")),
        })
    return resultado


@router.get("/sincronizaciones/{sync_id}/errores.csv")
async def descargar_errores_csv(
    sync_id: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = Depends(requiere_permiso("soporte.solicitudes_fabrica.ver")),
) -> Response:
    try:
        contenido = await SoporteSolicitudesFabricaService.descargar_errores_csv(ctx, sync_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=contenido,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="errores_solicitudes_fabrica_{sync_id}.csv"'},
    )

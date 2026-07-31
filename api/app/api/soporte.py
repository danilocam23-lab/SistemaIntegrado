"""API de Soporte / Solicitudes Fábrica."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import requiere_permiso
from app.services.soporte_solicitudes_fabrica_service import SoporteSolicitudesFabricaService

router = APIRouter(prefix="/soporte/solicitudes-fabrica", tags=["soporte"])


@router.get("")
async def listar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = Depends(requiere_permiso("soporte.solicitudes_fabrica.ver")),
) -> dict:
    return await SoporteSolicitudesFabricaService.listar(ctx)


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

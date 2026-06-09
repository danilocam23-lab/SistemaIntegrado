"""Router de importación del Excel 'BITÁCORA GENERAL'."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.importer.excel_importer import ImportadorExcel
from app.middleware.aplicacion import ContextoAplicacion, contexto_escritura

router = APIRouter(prefix="/importacion", tags=["importacion"])


@router.post("/excel")
async def importar_excel(
    archivo: UploadFile = File(...),
    hoja: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
) -> dict:
    """Importa el Excel 'BITÁCORA GENERAL' a la aplicación activa.

    Cada fila es un requerimiento + una entrega; los catálogos (personas,
    squads, aplicativos, tarifas, actas, órdenes) se crean si no existen.
    """
    nombre = (archivo.filename or "").lower()
    if not nombre.endswith((".xlsx", ".xlsm")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El archivo debe ser .xlsx")

    contenido = await archivo.read()
    try:
        resultado = await ImportadorExcel(ctx.codigo, contenido, hoja).ejecutar()
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"No se pudo importar el archivo: {exc}"
        ) from exc

    return {
        "filas_procesadas": resultado.filas_procesadas,
        "requerimientos_creados": resultado.requerimientos_creados,
        "requerimientos_actualizados": resultado.requerimientos_actualizados,
        "entregas_creadas": resultado.entregas_creadas,
        "entregas_actualizadas": resultado.entregas_actualizadas,
        "festivos_cargados": resultado.festivos_cargados,
        "errores": resultado.errores,
    }

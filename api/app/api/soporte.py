"""API de Soporte / Solicitudes Fábrica."""
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import permiso
from app.security.rbac import PERM_ADMIN_ACCESO
from app.services.soporte_solicitudes_fabrica_service import SoporteSolicitudesFabricaService
 
router = APIRouter(prefix="/soporte/solicitudes-fabrica", tags=["soporte"])


class DetalleAnsUpdate(BaseModel):
    tipo: str
    se_levanto_ans: bool | None = None
    observaciones: str | None = None


@router.get("")
async def listar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = permiso("soporte.solicitudes_fabrica.ver"),
) -> dict:
    return await SoporteSolicitudesFabricaService.listar(ctx)


@router.get("/pagina")
async def listar_paginado(
    pagina: int = 1,
    tamanio: int = 100,
    filtro_wo: str = "",
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = permiso("soporte.solicitudes_fabrica.ver"),
) -> dict:
    """Endpoint paginado para tablas grandes. Devuelve una página de registros."""
    return await SoporteSolicitudesFabricaService.listar_paginado(
        ctx, pagina=pagina, tamanio=tamanio, filtro_wo=filtro_wo or None
    )


@router.get("/resumen")
async def resumen(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = permiso("soporte.solicitudes_fabrica.ver"),
) -> dict:
    """Resumen ligero: solo campos clave por registro, sin datos completos."""
    return await SoporteSolicitudesFabricaService.resumen(ctx)


@router.get("/ans-datos")
async def ans_datos(
    filtro_wo: str = "",
    filtro_assigned: str = "",
    filtro_ano: str = "",
    filtro_mes: str = "",
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = permiso("soporte.solicitudes_fabrica.ver"),
) -> dict:
    """Datos ligeros para la vista Detalle ANS con filtrado servidor."""
    return await SoporteSolicitudesFabricaService.datos_ans(
        ctx,
        filtro_wo=filtro_wo or None,
        filtro_assigned=filtro_assigned or None,
        filtro_ano=filtro_ano or None,
        filtro_mes=filtro_mes or None,
    )


@router.patch("/{registro_id}/detalle-ans")
async def actualizar_detalle_ans(
    registro_id: str,
    datos: DetalleAnsUpdate,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = permiso("soporte.detalle_ans.editar"),
) -> dict:
    # Un ValueError (tipo inválido, registro no encontrado) lo traduce a 400
    # el handler global (ADR-0008 F2.6).
    return await SoporteSolicitudesFabricaService.actualizar_detalle_ans(
        ctx,
        registro_id,
        tipo=datos.tipo,
        se_levanto_ans=datos.se_levanto_ans,
        observaciones=datos.observaciones,
    )
 
 
@router.post("/previsualizar")
async def previsualizar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    archivo: UploadFile | None = File(default=None),
    _: object = permiso("soporte.solicitudes_fabrica.actualizar"),
) -> dict:
    # Un ValueError (sin archivo, Excel inválido) lo traduce a 400 el handler
    # global (ADR-0008 F2.6).
    if archivo is None:
        raise ValueError("Debe cargar el archivo Excel para continuar.")
    contenido = await archivo.read()
    return await SoporteSolicitudesFabricaService.previsualizar(
        ctx,
        contenido_excel=contenido,
        nombre_archivo=archivo.filename,
    )


@router.post("/sincronizar")
async def sincronizar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    archivo: UploadFile | None = File(default=None),
    _: object = permiso("soporte.solicitudes_fabrica.actualizar"),
) -> dict:
    """Sincroniza el Excel cargado a mano con las solicitudes de fábrica.

    Antes este endpoint capturaba cualquier ``Exception`` y devolvía
    ``f"No se pudo sincronizar: {exc}"`` en un 500 (ADR-0008 E4): filtraba al
    cliente el mensaje crudo de la excepción (que puede incluir detalle de
    ``openpyxl``/``pymongo``). Ahora un ``ValueError`` de negocio lo traduce a
    400 el handler global, y cualquier otra excepción cae en la red de
    seguridad de ``main.py`` (500 genérico + ``error_id``, con el traceback
    completo solo en el log del servidor).
    """
    if archivo is None:
        raise ValueError("Debe cargar el archivo Excel para continuar.")
    contenido = await archivo.read()
    return await SoporteSolicitudesFabricaService.sincronizar(
        ctx,
        contenido_excel=contenido,
        nombre_archivo=archivo.filename,
    )


@router.get("/ultima-sincronizacion")
async def ultima_sincronizacion(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = permiso("soporte.solicitudes_fabrica.ver"),
) -> dict | None:
    """Resultado de la última sincronización (manual o automática 3x/día),
    para avisar en la vista si quedaron registros con error por revisar."""
    return await SoporteSolicitudesFabricaService.ultima_sincronizacion(ctx)


@router.post("/ejecutar-carga-automatica")
async def ejecutar_carga_automatica(
    _: object = permiso(PERM_ADMIN_ACCESO),
) -> dict:
    """Dispara manualmente el mismo proceso que corre el scheduler 3x/día
    (Configuración > Carga de Excel), para poder probar que la ruta/archivo
    configurados funcionan sin tener que esperar al próximo horario.

    F1.5 (ADR-0008 S9): el servicio subyacente (``sincronizar_automatico``,
    el mismo que usa el scheduler) no recibe ``ctx``: sincroniza TODAS las
    aplicaciones de una vez, no una en particular. Antes bastaba con tener
    ``soporte.solicitudes_fabrica.actualizar`` en una sola aplicación para
    disparar esa sincronización global; ahora exige ``admin.acceso``.
    """
    resultado = await SoporteSolicitudesFabricaService.sincronizar_automatico()
    if resultado is None:
        return {
            "ejecutado": False,
            "mensaje": (
                "No se encontró un archivo para cargar. Verifique la ruta "
                "configurada y que el archivo exista con el nombre esperado."
            ),
        }
    from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabricaSyncLog

    log = await SoporteSolicitudFabricaSyncLog.get(resultado["sync_id"])
    return {
        "ejecutado": True,
        "archivo": log.archivo if log else None,
        "total_encontrados": log.total_encontrados if log else resultado.get("total_procesados"),
        "cargados": log.cargados if log else resultado.get("registros_creados"),
        "con_error": log.con_error if log else resultado.get("registros_omitidos"),
    }


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
        status = d.get("Status WO", "").strip()
        if not assigned or status.lower() in ("cerrado", "cancelado", "terminado"):
            continue
        resultado.append({
            "id": str(r.id),
            "wo_id": d.get("Work Order ID", ""),
            "assigned_to": assigned,
            "status": d.get("Status WO", ""),
            "priority": d.get("Priority", ""),
            "created_date": d.get("Fecha_Requerida_Inicio", ""),
            "descripcion": d.get("Detailed Description", ""),
        })
    return resultado


@router.get("/sincronizaciones/{sync_id}/errores.csv")
async def descargar_errores_csv(
    sync_id: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: object = permiso("soporte.solicitudes_fabrica.ver"),
) -> Response:
    # El servicio lanza NoEncontrado (404) en vez de ValueError (400): la
    # sincronización solicitada de verdad no existe (o no es de esta
    # aplicación), no es un error de validación de la petición.
    contenido = await SoporteSolicitudesFabricaService.descargar_errores_csv(ctx, sync_id)
    return Response(
        content=contenido,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="errores_solicitudes_fabrica_{sync_id}.csv"'
            )
        },
    )

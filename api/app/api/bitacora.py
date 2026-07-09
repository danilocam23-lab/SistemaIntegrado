"""Router de bitácora (lectura de eventos y auditoría)."""
import logging
from datetime import datetime
from decimal import Decimal
from enum import Enum

from beanie import PydanticObjectId
from bson import ObjectId
from bson.decimal128 import Decimal128
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.bitacora import Bitacora
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import tiene_permiso, usuario_actual
from app.documents.usuario import Usuario

router = APIRouter(prefix="/bitacora", tags=["bitacora"])
logger = logging.getLogger(__name__)


def _iso(valor: object) -> str | None:
    if isinstance(valor, datetime):
        return valor.isoformat()
    return None


def _json_safe(valor: object) -> object:
    if valor is None or isinstance(valor, (str, int, float, bool)):
        return valor
    if isinstance(valor, datetime):
        return valor.isoformat()
    if isinstance(valor, (ObjectId, PydanticObjectId, Decimal, Decimal128, Enum)):
        return str(valor)
    if isinstance(valor, list):
        return [_json_safe(v) for v in valor]
    if isinstance(valor, dict):
        return {str(k): _json_safe(v) for k, v in valor.items()}
    return str(valor)


def _serializar_evento(doc: dict) -> dict:
    # Devolvemos un payload estable y plano para evitar errores de serialización
    # por datos históricos con estructura/tipos no compatibles.
    return {
        "id": str(doc.get("_id")),
        "aplicacion_id": _json_safe(doc.get("aplicacion_id")),
        "entidad_tipo": _json_safe(doc.get("entidad_tipo")),
        "entidad_id": _json_safe(doc.get("entidad_id")),
        "accion": _json_safe(doc.get("accion")),
        "descripcion": _json_safe(doc.get("descripcion", "")),
        "autor": _json_safe(doc.get("autor")),
        "creado_en": _iso(doc.get("creado_en")) or str(_json_safe(doc.get("creado_en"))),
        "actualizado_en": _iso(doc.get("actualizado_en")),
    }


@router.get("")
async def listar(
    entidad_id: str | None = None,
    entidad_tipo: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Lista eventos de bitácora; filtra opcionalmente por entidad."""
    consulta = ctx.filtro()
    if entidad_id:
        consulta["entidad_id"] = entidad_id
    if entidad_tipo:
        consulta["entidad_tipo"] = entidad_tipo

    try:
        col = Bitacora.get_pymongo_collection()
        docs = await col.find(consulta).sort("creado_en", -1).limit(200).to_list(None)
        return [_serializar_evento(d) for d in docs]
    except Exception as exc:  # noqa: BLE001 - error de capa DB
        logger.exception("Error consultando bitácora")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "No fue posible consultar la bitácora.",
        ) from exc


@router.delete("/{evento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    evento_id: PydanticObjectId,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
):
    """Elimina un evento de bitácora (requiere permiso de administración)."""
    if not await tiene_permiso(usuario, "admin.roles.editar"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado para eliminar eventos de bitácora.")
    consulta = ctx.filtro()
    consulta["_id"] = evento_id
    evento = await Bitacora.find_one(consulta)
    if not evento:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evento no encontrado.")
    await evento.delete()

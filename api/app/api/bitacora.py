"""Router de bitácora (lectura de eventos y auditoría)."""
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.bitacora import Bitacora
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import usuario_actual
from app.documents.usuario import Usuario

router = APIRouter(prefix="/bitacora", tags=["bitacora"])


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
    return await Bitacora.find(consulta).sort("-creado_en").limit(200).to_list()


@router.delete("/{evento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    evento_id: PydanticObjectId,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
):
    """Elimina un evento de bitácora (solo superadmin)."""
    if usuario.rol != "superadmin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo superadmin puede eliminar eventos de bitácora.")
    consulta = ctx.filtro()
    consulta["_id"] = evento_id
    evento = await Bitacora.find_one(consulta)
    if not evento:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evento no encontrado.")
    await evento.delete()

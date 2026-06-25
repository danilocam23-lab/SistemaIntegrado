"""Router de bitácora (lectura de eventos y auditoría)."""
import logging
import traceback
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.bitacora import Bitacora
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import usuario_actual
from app.documents.usuario import Usuario

router = APIRouter(prefix="/bitacora", tags=["bitacora"])
logger = logging.getLogger(__name__)


@router.get("")
async def listar(
    entidad_id: str | None = None,
    entidad_tipo: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Lista eventos de bitácora; filtra opcionalmente por entidad."""
    try:
        # Log de entrada
        print(f"[BITACORA] GET /bitacora called")
        print(f"  - entidad_id: {entidad_id}")
        print(f"  - entidad_tipo: {entidad_tipo}")
        print(f"  - ctx aplicacion_id: {ctx.aplicacion_id}")
        
        # Construir consulta
        consulta = ctx.filtro()
        if entidad_id:
            consulta["entidad_id"] = entidad_id
        if entidad_tipo:
            consulta["entidad_tipo"] = entidad_tipo
        
        print(f"  - consulta: {consulta}")
        
        # Intentar sin sort primero
        try:
            resultado = await Bitacora.find(consulta).limit(200).to_list()
            print(f"[BITACORA] Query sin sort OK, {len(resultado)} documentos")
            return resultado
        except Exception as query_err:
            print(f"[BITACORA] Query sin sort falló: {str(query_err)}")
            # Intentar nuevamente pero con sort
            try:
                resultado = await Bitacora.find(consulta).sort("-creado_en").limit(200).to_list()
                print(f"[BITACORA] Query con sort OK, {len(resultado)} documentos")
                return resultado
            except Exception as sort_err:
                print(f"[BITACORA] Query con sort también falló: {str(sort_err)}")
                # Última opción: sin filtro
                try:
                    resultado = await Bitacora.find({}).limit(50).to_list()
                    print(f"[BITACORA] Query sin filtro OK, {len(resultado)} documentos")
                    return resultado
                except Exception as nofilter_err:
                    print(f"[BITACORA] Todas las queries fallaron: {str(nofilter_err)}")
                    return []
        
    except Exception as e:
        logger.error(f"Error crítico en endpoint bitacora: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        print(f"❌ ERROR CRÍTICO EN BITACORA: {str(e)}")
        print(f"   Tipo: {type(e).__name__}")
        print(f"   Stack: {traceback.format_exc()}")
        
        # Retornar lista vacía en lugar de fallar
        return []


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

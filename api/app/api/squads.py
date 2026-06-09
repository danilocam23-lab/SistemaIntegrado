"""Router de squads."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.squad import Squad
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura

router = APIRouter(prefix="/squads", tags=["squads"])


class SquadIn(BaseModel):
    nombre: str
    lt_hitss_id: str | None = None
    activo: bool = True


def _serializar_squad(doc: dict) -> dict:
    """Serializa un documento crudo de MongoDB a dict con id siempre como string.

    Beanie omite silenciosamente documentos cuyo _id no es ObjectId (ej: enteros).
    Usamos PyMongo directo para no perder esos registros.
    """
    return {
        "id": str(doc["_id"]),
        "aplicacion_id": doc.get("aplicacion_id"),
        "nombre": doc.get("nombre", ""),
        "lt_hitss_id": doc.get("lt_hitss_id"),
        "activo": doc.get("activo", True),
    }


@router.get("")
async def listar(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    col = Squad.get_pymongo_collection()
    docs = await col.find(ctx.filtro()).sort("nombre", 1).to_list(None)
    return [_serializar_squad(d) for d in docs]


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(datos: SquadIn, ctx: ContextoAplicacion = Depends(contexto_escritura)):
    squad = Squad(aplicacion_id=ctx.codigo, **datos.model_dump())
    await squad.insert()
    return squad


@router.put("/{squad_id}")
async def actualizar(
    squad_id: str, datos: SquadIn, ctx: ContextoAplicacion = Depends(contexto_escritura)
):
    squad = await Squad.get(squad_id)
    if squad is None or squad.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Squad no encontrado")
    for campo, valor in datos.model_dump().items():
        setattr(squad, campo, valor)
    squad.marcar_actualizado()
    await squad.save()
    return squad


@router.delete("/{squad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    squad_id: str, ctx: ContextoAplicacion = Depends(contexto_escritura)
) -> None:
    squad = await Squad.get(squad_id)
    if squad is None or squad.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Squad no encontrado")
    await squad.delete()

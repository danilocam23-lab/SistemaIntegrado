"""Identidad analítica opaca, independiente de las credenciales y del JWT."""
from uuid import uuid4

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.documents.base import ahora
from app.documents.identidad_analitica import IdentidadAnalitica
from app.documents.usuario import Usuario
from app.errors import ErrorDominio


async def obtener_id_analitico(usuario: Usuario) -> str:
    coleccion = IdentidadAnalitica.get_pymongo_collection()
    filtro = {"usuario_id": str(usuario.id)}
    try:
        actualizado = await coleccion.find_one_and_update(
            filtro,
            {"$setOnInsert": {
                "usuario_id": str(usuario.id), "id_analitico": str(uuid4()),
                "creado_en": ahora(), "actualizado_en": ahora(),
            }},
            upsert=True,
            return_document=ReturnDocument.AFTER,
            projection={"id_analitico": 1},
        )
    except DuplicateKeyError:
        actualizado = await coleccion.find_one(filtro, projection={"id_analitico": 1})
    if actualizado is None or not isinstance(actualizado.get("id_analitico"), str):
        raise ErrorDominio("No se pudo resolver la identidad analítica.", status_code=503)
    return actualizado["id_analitico"]

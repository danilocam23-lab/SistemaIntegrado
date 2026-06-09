"""Router de configuración (parámetros clave/valor globales del proyecto).

Los parámetros de configuración son globales: no están segmentados por squad.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.documents.configuracion import Configuracion

router = APIRouter(prefix="/configuracion", tags=["configuracion"])

_APP_GLOBAL = "global"


class ConfigIn(BaseModel):
    valor: str
    grupo: str = "general"


@router.get("")
async def listar():
    return await Configuracion.find_all().sort("grupo").to_list()


@router.put("/{clave}")
async def guardar(clave: str, datos: ConfigIn):
    """Crea o actualiza un parámetro de configuración global."""
    config = await Configuracion.find_one(
        Configuracion.aplicacion_id == _APP_GLOBAL,
        Configuracion.clave == clave,
    )
    if config is None:
        # También buscar por clave sin importar aplicacion_id (migración de registros viejos)
        config = await Configuracion.find_one(Configuracion.clave == clave)
    if config is None:
        config = Configuracion(
            aplicacion_id=_APP_GLOBAL, clave=clave, valor=datos.valor, grupo=datos.grupo
        )
        await config.insert()
    else:
        config.aplicacion_id = _APP_GLOBAL
        config.valor = datos.valor
        config.grupo = datos.grupo
        config.marcar_actualizado()
        await config.save()
    return config


@router.delete("/{clave}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(clave: str) -> None:
    """Elimina un parámetro de configuración."""
    config = await Configuracion.find_one(Configuracion.clave == clave)
    if config is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Parámetro no encontrado")
    await config.delete()

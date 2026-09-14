"""Router del dashboard consolidado (solo lectura, roles admin).

Devuelve cifras agregadas con la aplicación como dimensión. No mezcla datos:
cada cifra identifica a qué aplicación pertenece. Al portar el dominio
(fases 3–5) se amplía con requerimientos, ANS, horas, facturación y carga.
"""
from beanie import Document
from fastapi import APIRouter, Depends

from app.documents.aplicacion import Aplicacion
from app.documents.categoria import Categoria
from app.documents.persona import Persona
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import requiere_permiso

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _conteos_por_aplicacion(modelo: type[Document], codigos: list[str]) -> dict[str, int]:
    """Cuenta documentos de ``modelo`` agrupados por ``aplicacion_id`` en un solo viaje."""
    filas = await modelo.aggregate(
        [
            {"$match": {"aplicacion_id": {"$in": codigos}}},
            {"$group": {"_id": "$aplicacion_id", "cantidad": {"$sum": 1}}},
        ]
    ).to_list()
    return {f["_id"]: f["cantidad"] for f in filas}


@router.get("/consolidado")
async def consolidado(
    _: Usuario = Depends(requiere_permiso("consolidado.ver")),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    """Cifras agregadas por aplicación para el dashboard unificado.

    ADR-0008 F3.3 (P8): antes hacía 3 consultas por aplicación dentro de un
    bucle (N+1). Se resuelve con 3 consultas en total, sin importar cuántas
    aplicaciones tenga el contexto: una para las aplicaciones y una por
    colección contada, agregando con `$group` en vez de un `.count()` por
    aplicación.
    """
    apps_por_codigo = {
        a.codigo: a
        for a in await Aplicacion.find({"codigo": {"$in": ctx.codigos}}).to_list()
    }
    personas_por_codigo = await _conteos_por_aplicacion(Persona, ctx.codigos)
    categorias_por_codigo = await _conteos_por_aplicacion(Categoria, ctx.codigos)

    por_aplicacion = [
        {
            "aplicacion": codigo,
            "nombre": apps_por_codigo[codigo].nombre if codigo in apps_por_codigo else codigo,
            "activa": apps_por_codigo[codigo].activa if codigo in apps_por_codigo else False,
            "personas": personas_por_codigo.get(codigo, 0),
            "categorias": categorias_por_codigo.get(codigo, 0),
            # TODO fases 3-5: requerimientos, ANS, horas, facturación, carga.
        }
        for codigo in ctx.codigos
    ]
    return {
        "modo_consolidado": ctx.modo_consolidado,
        "total_aplicaciones": len(por_aplicacion),
        "aplicaciones": por_aplicacion,
    }

"""Router del dashboard consolidado (solo lectura, roles admin).

Devuelve cifras agregadas con la aplicación como dimensión. No mezcla datos:
cada cifra identifica a qué aplicación pertenece. Al portar el dominio
(fases 3–5) se amplía con requerimientos, ANS, horas, facturación y carga.
"""
from fastapi import APIRouter, Depends

from app.documents.aplicacion import Aplicacion
from app.documents.categoria import Categoria
from app.documents.enums import RolUsuario
from app.documents.persona import Persona
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import requiere_rol

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/consolidado")
async def consolidado(
    _: Usuario = Depends(requiere_rol(RolUsuario.SUPERADMIN, RolUsuario.ADMIN_APP)),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    """Cifras agregadas por aplicación para el dashboard unificado."""
    por_aplicacion = []
    for codigo in ctx.codigos:
        app = await Aplicacion.find_one(Aplicacion.codigo == codigo)
        por_aplicacion.append(
            {
                "aplicacion": codigo,
                "nombre": app.nombre if app else codigo,
                "activa": app.activa if app else False,
                "personas": await Persona.find(Persona.aplicacion_id == codigo).count(),
                "categorias": await Categoria.find(Categoria.aplicacion_id == codigo).count(),
                # TODO fases 3-5: requerimientos, ANS, horas, facturación, carga.
            }
        )
    return {
        "modo_consolidado": ctx.modo_consolidado,
        "total_aplicaciones": len(por_aplicacion),
        "aplicaciones": por_aplicacion,
    }

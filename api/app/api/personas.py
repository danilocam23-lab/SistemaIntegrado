"""Router de personas (directorio operativo del dominio)."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.asignacion import Asignacion
from app.documents.azdo import AzdoWorkItem
from app.documents.capacidad import Capacidad
from app.documents.persona import Persona
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import usuario_actual

router = APIRouter(prefix="/personas", tags=["personas"])

ROLES_PERSONA_DEFAULT = ["DEV", "LT_HITSS", "LT_EPM", "SCRUM", "EPM", "COORD", "LECTOR"]


class PersonaIn(BaseModel):
    nombre: str
    email: str | None = None
    rol_operativo: str = "DEV"
    activo: bool = True
    squads: list[str] = []
    es_lider_tecnico: bool = False
    permite_sobrecarga: bool = False
    usuario_id: str | None = None
    aplicacion_id: str | None = None  # requerido en modo consolidado; derivado del squad si no se indica

@router.get("/roles")
async def obtener_roles():
    """Devuelve la lista de roles configurados para personas (global)."""
    from app.documents.configuracion import Configuracion
    config = await Configuracion.find_one(
        Configuracion.clave == "roles_persona",
    )
    if config and config.valor:
        return [r.strip() for r in config.valor.split(",") if r.strip()]
    return ROLES_PERSONA_DEFAULT


@router.get("")
async def listar(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    if ctx.modo_consolidado:
        return await Persona.find({"aplicacion_id": {"$in": ctx.codigos}}).sort("nombre").to_list()
    # Query por aplicacion_id + query por squad (nombre del app), unión sin duplicados
    por_id = await Persona.find({"aplicacion_id": ctx.codigo}).to_list()
    if ctx.nombre_app:
        por_squad = await Persona.find({"squads": ctx.nombre_app}).to_list()
        vistos = {str(p.id) for p in por_id}
        for p in por_squad:
            if str(p.id) not in vistos:
                por_id.append(p)
    por_id.sort(key=lambda p: p.nombre)
    return por_id


@router.get("/{persona_id}")
async def obtener(persona_id: str, ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    persona = await Persona.get(persona_id)
    if persona is None or persona.aplicacion_id not in ctx.codigos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    return persona


async def _resolver_app_id(datos: PersonaIn, ctx: ContextoAplicacion, usuario: Usuario) -> str:
    """Determina aplicacion_id: usa el explícito del body; si no, ctx.codigo.
    El superadmin puede crear en cualquier aplicación sin restricción de contexto.
    """
    if datos.aplicacion_id:
        es_superadmin = usuario.rol == "superadmin"
        if not es_superadmin and datos.aplicacion_id not in ctx.codigos:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a esa aplicación.")
        return datos.aplicacion_id
    if ctx.modo_consolidado:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "En modo consolidado indique 'aplicacion_id' en el cuerpo.",
        )
    return ctx.codigo


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(
    datos: PersonaIn,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
):
    app_id = await _resolver_app_id(datos, ctx, usuario)
    data = datos.model_dump(exclude={"aplicacion_id"})
    persona = Persona(aplicacion_id=app_id, **data)
    await persona.insert()
    return persona


@router.put("/{persona_id}")
async def actualizar(
    persona_id: str,
    datos: PersonaIn,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    persona = await Persona.get(persona_id)
    if persona is None or persona.aplicacion_id not in ctx.codigos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    # Actualiza solo los campos operativos, preserva aplicacion_id original
    for campo, valor in datos.model_dump(exclude={"aplicacion_id"}).items():
        setattr(persona, campo, valor)
    persona.marcar_actualizado()
    await persona.save()
    return persona


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    persona_id: str, ctx: ContextoAplicacion = Depends(contexto_aplicacion)
) -> None:
    persona = await Persona.get(persona_id)
    if persona is None or persona.aplicacion_id not in ctx.codigos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    # Cascade: eliminar registros relacionados antes de borrar la persona
    await Asignacion.find(Asignacion.persona_id == persona_id).delete()
    await Capacidad.find(
        Capacidad.scope == "persona", Capacidad.persona_id == persona_id
    ).delete()
    await AzdoWorkItem.find(AzdoWorkItem.persona_id == persona_id).delete()
    await persona.delete()

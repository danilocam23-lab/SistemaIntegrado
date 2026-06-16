"""Router de asignaciones de carga de trabajo (proyectos y sprints embebidos)."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.asignacion import Asignacion, Proyecto
from app.documents.requerimiento import Requerimiento
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.services.sync_catalogo import sincronizar_requerimiento_a_carga

router = APIRouter(prefix="/asignaciones", tags=["asignaciones"])


class AsignacionIn(BaseModel):
    persona_id: str
    categoria_id: str
    total_porcentaje: float = 0
    estado: str = "active"
    activo: bool = True
    prioridad: bool = False
    proyectos: list[Proyecto] = []


@router.get("")
async def listar(
    persona_id: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Lista asignaciones; opcionalmente filtra por persona."""
    consulta = ctx.filtro()
    if persona_id:
        consulta["persona_id"] = persona_id
    return await Asignacion.find(consulta).to_list()


@router.get("/{asignacion_id}")
async def obtener(
    asignacion_id: str, ctx: ContextoAplicacion = Depends(contexto_aplicacion)
):
    asignacion = await Asignacion.get(asignacion_id)
    if asignacion is None or asignacion.aplicacion_id not in ctx.codigos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignación no encontrada")
    return asignacion


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(datos: AsignacionIn, ctx: ContextoAplicacion = Depends(contexto_escritura)):
    asignacion = Asignacion(aplicacion_id=ctx.codigo, **datos.model_dump())
    await asignacion.insert()
    return asignacion


@router.put("/{asignacion_id}")
async def actualizar(
    asignacion_id: str,
    datos: AsignacionIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
):
    asignacion = await Asignacion.get(asignacion_id)
    if asignacion is None or asignacion.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignación no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(asignacion, campo, valor)
    asignacion.marcar_actualizado()
    await asignacion.save()
    return asignacion


@router.patch("/{asignacion_id}/prioridad")
async def cambiar_prioridad(
    asignacion_id: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
):
    """Marca esta asignación como prioritaria para la persona y desmarca las demás."""
    asignacion = await Asignacion.get(asignacion_id)
    if asignacion is None or asignacion.aplicacion_id not in ctx.codigos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignación no encontrada")

    nueva_prioridad = not asignacion.prioridad

    if nueva_prioridad:
        # Desmarcar todas las demás asignaciones de la misma persona
        otras = await Asignacion.find(
            {"persona_id": asignacion.persona_id, "_id": {"$ne": asignacion.id}}
        ).to_list()
        for otra in otras:
            if otra.prioridad:
                otra.prioridad = False
                otra.marcar_actualizado()
                await otra.save()

    asignacion.prioridad = nueva_prioridad
    asignacion.marcar_actualizado()
    await asignacion.save()
    return asignacion



async def eliminar(
    asignacion_id: str, ctx: ContextoAplicacion = Depends(contexto_escritura)
) -> None:
    asignacion = await Asignacion.get(asignacion_id)
    if asignacion is None or asignacion.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignación no encontrada")
    await asignacion.delete()


@router.post("/sincronizar/{codigo_req}")
async def sincronizar(
    codigo_req: str, ctx: ContextoAplicacion = Depends(contexto_escritura)
) -> dict:
    """Proyecta un requerimiento sobre las asignaciones de carga de sus developers."""
    req = await Requerimiento.find_one(
        Requerimiento.aplicacion_id == ctx.codigo,
        Requerimiento.codigo_req == codigo_req,
    )
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requerimiento no encontrado")
    creadas = await sincronizar_requerimiento_a_carga(req)
    return {"codigo_req": codigo_req, "asignaciones_sincronizadas": creadas}

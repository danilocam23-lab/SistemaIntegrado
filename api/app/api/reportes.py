"""Router de reportes consolidables: resumen de equipo y roadmap."""
from fastapi import APIRouter, Depends

from app.documents.asignacion import Asignacion
from app.documents.persona import Persona
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion

router = APIRouter(prefix="/reportes", tags=["reportes"])


@router.get("/equipo")
async def equipo(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Resumen de carga por persona (asignaciones, proyectos, % de carga)."""
    if ctx.modo_consolidado:
        personas = await Persona.find({"aplicacion_id": {"$in": ctx.codigos}}).to_list()
    else:
        personas = await Persona.find({"aplicacion_id": ctx.codigo}).to_list()
        if ctx.nombre_app:
            por_squad = await Persona.find({"squads": ctx.nombre_app}).to_list()
            vistos = {str(p.id) for p in personas}
            for p in por_squad:
                if str(p.id) not in vistos:
                    personas.append(p)
    asignaciones = await Asignacion.find(ctx.filtro()).to_list()

    por_persona: dict[str, dict] = {}
    for asig in asignaciones:
        registro = por_persona.setdefault(
            asig.persona_id, {"asignaciones": 0, "proyectos": 0, "carga": 0.0}
        )
        registro["asignaciones"] += 1
        registro["proyectos"] += len(asig.proyectos)
        registro["carga"] += asig.total_porcentaje

    filas = []
    for persona in personas:
        datos = por_persona.get(
            str(persona.id), {"asignaciones": 0, "proyectos": 0, "carga": 0.0}
        )
        filas.append(
            {
                "persona": persona.nombre,
                "rol": persona.rol_operativo,
                "activo": persona.activo,
                **datos,
            }
        )
    filas.sort(key=lambda f: f["carga"], reverse=True)
    return {"total_personas": len(personas), "equipo": filas}


@router.get("/roadmap")
async def roadmap(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Proyectos de todas las asignaciones, con sus fechas y sprints."""
    asignaciones = await Asignacion.find(ctx.filtro()).to_list()
    items = []
    for asig in asignaciones:
        for proyecto in asig.proyectos:
            items.append(
                {
                    "persona_id": asig.persona_id,
                    "proyecto": proyecto.nombre,
                    "estado": proyecto.estado,
                    "fecha_inicio": proyecto.fecha_inicio,
                    "fecha_fin": proyecto.fecha_fin,
                    "sprints": len(proyecto.sprints),
                    "requerimiento_id": proyecto.requerimiento_id,
                }
            )
    return {"total_proyectos": len(items), "roadmap": items}

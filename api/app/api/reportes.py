# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de reportes consolidables: resumen de equipo y roadmap."""
from fastapi import APIRouter, Depends

from app.documents.asignacion import Asignacion
from app.documents.categoria import Categoria
from app.documents.persona import Persona
from app.documents.requerimiento import Requerimiento
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import permiso

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


# Proyecciones del Roadmap: lista blanca de campos. Nunca incluyen datos económicos
# (valor_persona, valor_perifericos, monto_pactado, horas, facturación, etc.).
_PROY_REQ = {
    "codigo_req": 1, "nombre": 1, "estado": 1, "categoria_id": 1,
    "developers_asignados": 1, "fecha_inicio": 1, "fecha_fin": 1,
    "fecha_solicitud_acta": 1, "solicitud.lt_hitss_id": 1,
    "entregas.numero": 1, "entregas.fecha_comprometida": 1,
    "entregas.fecha_aprobacion": 1, "entregas.estado": 1,
}
_PROY_PERSONA = {"nombre": 1, "activo": 1, "rol_operativo": 1}
_PROY_CATEGORIA = {"nombre": 1, "color": 1}
_PROY_ASIGNACION = {
    "persona_id": 1, "categoria_id": 1, "total_porcentaje": 1,
    "estado": 1, "proyectos.requerimiento_id": 1,
}


def _con_id(doc: dict) -> dict:
    """Expone ``_id`` como cadena (misma convención que el resto de la API)."""
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("/roadmap", dependencies=[permiso("roadmap.ver")])
async def roadmap(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> dict:
    """Todo lo que dibuja la pantalla Roadmap, en una sola respuesta bajo ``roadmap.ver``.

    Forma de la respuesta (solo lectura; admite el modo consolidado):

    - ``total_proyectos`` / ``roadmap``: proyectos de las asignaciones (forma histórica,
      sin cambios): ``persona_id, proyecto, estado, fecha_inicio, fecha_fin, sprints,
      requerimiento_id``.
    - ``requerimientos``: ``_id, codigo_req, nombre, estado, categoria_id,
      developers_asignados, fecha_inicio, fecha_fin, fecha_solicitud_acta,
      solicitud{lt_hitss_id}, entregas[{numero, fecha_comprometida, fecha_aprobacion,
      estado}]``.
    - ``personas``: ``_id, nombre, activo, rol_operativo`` (sin datos económicos).
    - ``categorias``: ``_id, nombre, color``.
    - ``asignaciones``: ``_id, persona_id, categoria_id, total_porcentaje, estado,
      proyectos[{requerimiento_id}]``.
    """
    filtro = ctx.filtro()

    asignaciones = await Asignacion.find(filtro).to_list()
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

    filtro_personas = filtro
    if not ctx.modo_consolidado and ctx.nombre_app:
        # Mismo criterio que GET /personas: incluye personas de otros squads que listan
        # este aplicativo (solo se exponen id, nombre, activo y rol).
        filtro_personas = {"$or": [filtro, {"squads": ctx.nombre_app}]}

    requerimientos = [
        _con_id(d)
        async for d in Requerimiento.get_pymongo_collection().find(filtro, _PROY_REQ)
    ]
    personas = [
        _con_id(d)
        async for d in Persona.get_pymongo_collection()
        .find(filtro_personas, _PROY_PERSONA)
        .sort("nombre", 1)
    ]
    categorias = [
        _con_id(d)
        async for d in Categoria.get_pymongo_collection()
        .find(filtro, _PROY_CATEGORIA)
        .sort("orden", 1)
    ]
    asignaciones_min = [
        _con_id(d)
        async for d in Asignacion.get_pymongo_collection().find(filtro, _PROY_ASIGNACION)
    ]
    for d in asignaciones_min:
        d["proyectos"] = [
            {"requerimiento_id": p.get("requerimiento_id")} for p in d.get("proyectos", [])
        ]

    return {
        "total_proyectos": len(items),
        "roadmap": items,
        "requerimientos": requerimientos,
        "personas": personas,
        "categorias": categorias,
        "asignaciones": asignaciones_min,
    }

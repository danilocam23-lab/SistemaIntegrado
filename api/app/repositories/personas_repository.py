# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Acceso a datos especializado para ``Persona`` (visibilidad cross-squad).

``Persona.squads`` guarda los nombres de los squads en los que la persona
colabora además de su ``aplicacion_id`` "dueña". Una persona es visible en el
squad activo si su ``aplicacion_id`` coincide con el contexto, o si (fuera de
modo consolidado) el nombre del squad activo está en su lista ``squads``.

Este es el mismo criterio que ya aplica ``GET /personas`` (ver
``api/app/api/personas.py``: ``listar()`` / ``_persona_visible``) y
``GET /reportes/equipo``. Las validaciones de "¿existe esta persona?" al
escribir OTROS recursos (capacidades, asignaciones, planes de acción) deben
usar este mismo filtro para no romper la visibilidad cross-squad.
"""
from app.middleware.aplicacion import ContextoAplicacion


def filtro_personas_visibles(ctx: ContextoAplicacion) -> dict:
    """Filtro Mongo para ``Persona`` visible desde el contexto activo.

    Incluye tanto las personas con ``aplicacion_id`` propia como, fuera de modo
    consolidado, las que colaboran en el squad activo vía ``squads`` (personas
    que participan en más de un squad)."""
    filtro = ctx.filtro()
    if not ctx.modo_consolidado and ctx.nombre_app:
        return {"$or": [filtro, {"squads": ctx.nombre_app}]}
    return filtro

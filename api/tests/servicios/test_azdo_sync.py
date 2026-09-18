# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Test de `sincronizar_iteracion` (ADR-0008 F3.3, P5).

Antes hacía un `find_one` (Persona) + `find_one` (AzdoWorkItem) + `save` por
work item (3N viajes por sprint). Se reescribe precargando las personas por
email y reemplazando la persistencia por un único `bulk_write` con upsert.
Este test simula la respuesta de Azure DevOps (sin red) y verifica que el
resultado no cambió: crea, resuelve `persona_id` por email, y actualiza sin
duplicar en una segunda sincronización.
"""
from app.documents.azdo import AzdoSyncLog, AzdoWorkItem
from app.documents.azdo_config import AzdoConfig
from app.documents.persona import Persona
from app.services import azdo_sync
from app.services.azure_devops import AzureDevOpsService


def _item(azdo_id: int, asignado_a: str | None, completed: float = 0.0) -> dict:
    return {
        "azdo_id": azdo_id,
        "tipo": "Task",
        "titulo": f"Tarea {azdo_id}",
        "estado": "New",
        "asignado_a": asignado_a,
        "original_estimate": 8.0,
        "completed_work": completed,
        "remaining_work": 8.0 - completed,
        "fecha_inicio": None,
        "iteration_path": "Proyecto\\Sprint 1",
        "area_path": "Proyecto",
        "tags": "",
        "url": "",
    }


async def test_sincronizar_iteracion_resuelve_persona_y_no_duplica(
    fabrica_aplicacion, monkeypatch
):
    app = await fabrica_aplicacion()
    await AzdoConfig(
        aplicacion_id=app.codigo, scope="app", org_url="https://dev.azure.com/x", pat="pat-test"
    ).insert()
    persona = await Persona(
        aplicacion_id=app.codigo, nombre="Dev Uno", email="dev@x.com"
    ).insert()

    items_primera = [_item(1, "dev@x.com", completed=2.0), _item(2, None, completed=0.0)]

    async def _obtener_primera(self, proyecto, iteration_path, asignado_a=None):
        return items_primera

    monkeypatch.setattr(
        AzureDevOpsService, "obtener_work_items_sprint", _obtener_primera
    )

    resultado = await azdo_sync.sincronizar_iteracion(
        app.codigo, "Proyecto", "Proyecto\\Sprint 1"
    )
    assert resultado["work_items"] == 2
    assert resultado["total_completado"] == 2.0

    docs = await AzdoWorkItem.find(AzdoWorkItem.aplicacion_id == app.codigo).to_list()
    assert len(docs) == 2
    por_azdo_id = {d.azdo_id: d for d in docs}
    assert por_azdo_id[1].persona_id == str(persona.id)
    assert por_azdo_id[2].persona_id is None

    log = await AzdoSyncLog.find_one(AzdoSyncLog.aplicacion_id == app.codigo)
    assert log is not None
    assert log.estado == "success"

    # Segunda sincronización: el item 1 avanza. No debe duplicar, solo actualizar.
    items_segunda = [_item(1, "dev@x.com", completed=8.0)]

    async def _obtener_segunda(self, proyecto, iteration_path, asignado_a=None):
        return items_segunda

    monkeypatch.setattr(
        AzureDevOpsService, "obtener_work_items_sprint", _obtener_segunda
    )
    resultado2 = await azdo_sync.sincronizar_iteracion(
        app.codigo, "Proyecto", "Proyecto\\Sprint 1"
    )
    assert resultado2["work_items"] == 1
    assert resultado2["total_completado"] == 8.0

    docs2 = await AzdoWorkItem.find(AzdoWorkItem.aplicacion_id == app.codigo).to_list()
    assert len(docs2) == 2  # sigue habiendo 2: el item 1 se actualizó, no se duplicó.
    actualizado = next(d for d in docs2 if d.azdo_id == 1)
    assert actualizado.completed_work == 8.0

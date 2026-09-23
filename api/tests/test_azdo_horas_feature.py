# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de ``GET /azdo/esquema/horas-por-feature``.

Cubre la agregación de horas de Tasks descendientes de una Feature (a través
de una Historia de Usuario intermedia) agrupadas por ``asignado_a``, y que un
``feature_id`` inexistente en el espejo devuelve lista vacía en vez de error.
"""
from datetime import UTC, datetime

import pytest_asyncio

from app.documents.azdo import AzdoEsquemaItem
from app.documents.azdo_config import AzdoConfig
from tests.conftest import headers_con_token


@pytest_asyncio.fixture(autouse=True)
async def _limpiar_espejo():
    """``AzdoEsquemaItem`` no lleva ``aplicacion_id`` (ver docstring de la clase);
    comparte clave (``org_key``+``proyecto``) entre tests, así que se limpia
    antes de cada uno para aislarlos, igual que en ``test_azdo_esquema_sync.py``."""
    await AzdoEsquemaItem.delete_all()
    yield


async def _item(
    azdo_id: int,
    parent_id: int | None,
    tipo: str,
    org_key: str = "https://dev.azure.com/org-test",
    proyecto: str = "Proyecto Test",
    asignado_a: str | None = None,
    original_estimate: float = 0,
    completed_work: float = 0,
    remaining_work: float = 0,
) -> AzdoEsquemaItem:
    return await AzdoEsquemaItem(
        target="hitss",
        org_key=org_key,
        proyecto=proyecto,
        azdo_id=azdo_id,
        parent_id=parent_id,
        tipo=tipo,
        titulo=f"Item {azdo_id}",
        asignado_a=asignado_a,
        original_estimate=original_estimate,
        completed_work=completed_work,
        remaining_work=remaining_work,
        ultima_sync=datetime.now(UTC),
    ).insert()


async def test_horas_por_feature_agrupa_por_persona_a_traves_de_hu(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["asignaciones.ver"])
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url="https://dev.azure.com/org-test",
        pat="pat-test",
        default_project="Proyecto Test",
    ).insert()

    await _item(101, None, "Feature")
    await _item(201, 101, "User Story")
    await _item(
        301,
        201,
        "Task",
        asignado_a="ana@hitss.com",
        original_estimate=5,
        completed_work=2,
        remaining_work=3,
    )
    await _item(
        302,
        201,
        "Task",
        asignado_a="beto@hitss.com",
        original_estimate=8,
        completed_work=8,
        remaining_work=0,
    )
    # Una segunda Task de Ana en otra rama, para confirmar que se suman.
    await _item(
        303,
        201,
        "Task",
        asignado_a="ana@hitss.com",
        original_estimate=1,
        completed_work=1,
        remaining_work=0,
    )
    # Task sin asignar.
    await _item(304, 201, "Task", asignado_a=None, original_estimate=2)

    resp = await cliente.get(
        "/api/azdo/esquema/horas-por-feature?ids=101,999",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    datos = resp.json()

    assert datos["999"] == []

    filas_101 = {fila["email"]: fila for fila in datos["101"]}
    assert set(filas_101) == {"ana@hitss.com", "beto@hitss.com", None}

    ana = filas_101["ana@hitss.com"]
    assert ana["original_estimate"] == 6
    assert ana["completed_work"] == 3
    assert ana["remaining_work"] == 3

    beto = filas_101["beto@hitss.com"]
    assert beto["original_estimate"] == 8
    assert beto["completed_work"] == 8
    assert beto["remaining_work"] == 0

    sin_asignar = filas_101[None]
    assert sin_asignar["original_estimate"] == 2


async def test_horas_por_feature_ignora_ids_no_numericos(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["asignaciones.ver"])
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url="https://dev.azure.com/org-test",
        pat="pat-test",
        default_project="Proyecto Test",
    ).insert()

    resp = await cliente.get(
        "/api/azdo/esquema/horas-por-feature?ids=abc, ,101",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    assert resp.json() == {"101": []}


async def test_horas_por_feature_sin_permiso_azure_devops_ver_pero_con_asignaciones_ver(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    """El permiso exigido es ``asignaciones.ver``, no ``azure_devops.ver``."""
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])

    resp = await cliente.get(
        "/api/azdo/esquema/horas-por-feature?ids=101",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 403

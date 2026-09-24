# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de ``GET /azdo/esquema/horas-por-feature`` y ``.../detalle-feature``.

Cubre la agregación de horas de Tasks y Bugs descendientes de una Feature (a
través de una Historia de Usuario intermedia) agrupadas por ``asignado_a``, que
un ``feature_id`` inexistente en el espejo devuelve lista vacía en vez de
error, y el desglose por Sprint/Mes de ``detalle-feature``.
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
    iteration_path: str = "",
    fecha_inicio: datetime | None = None,
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
        iteration_path=iteration_path,
        fecha_inicio=fecha_inicio,
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


async def test_horas_por_feature_suma_bugs_ademas_de_tasks(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    """El conteo de horas incluye Bug además de Task (ambos cargan horas en Azure)."""
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
        "Bug",
        asignado_a="ana@hitss.com",
        original_estimate=3,
        completed_work=1,
        remaining_work=2,
    )
    # Un tipo distinto de Task/Bug no debe contarse.
    await _item(303, 201, "Product Backlog Item", asignado_a="ana@hitss.com", completed_work=99)

    resp = await cliente.get(
        "/api/azdo/esquema/horas-por-feature?ids=101",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    filas = {fila["email"]: fila for fila in resp.json()["101"]}
    assert set(filas) == {"ana@hitss.com"}
    ana = filas["ana@hitss.com"]
    assert ana["original_estimate"] == 8
    assert ana["completed_work"] == 3
    assert ana["remaining_work"] == 5


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


# ── GET /azdo/esquema/detalle-feature ──

async def _preparar_config(fabrica_aplicacion, fabrica_usuario, permisos=("asignaciones.ver",)):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=list(permisos))
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url="https://dev.azure.com/org-test",
        pat="pat-test",
        default_project="Proyecto Test",
    ).insert()
    return app, token


async def test_detalle_feature_agrupa_por_sprint(cliente, fabrica_usuario, fabrica_aplicacion):
    app, token = await _preparar_config(fabrica_aplicacion, fabrica_usuario)

    await _item(101, None, "Feature")
    await _item(201, 101, "User Story")
    await _item(
        301,
        201,
        "Task",
        asignado_a="ana@hitss.com",
        completed_work=10,
        iteration_path="Proyecto\\Sprint 1",
    )
    await _item(
        302,
        201,
        "Bug",
        asignado_a="beto@hitss.com",
        completed_work=5,
        iteration_path="Proyecto\\Sprint 1",
    )
    await _item(
        303,
        201,
        "Task",
        asignado_a="ana@hitss.com",
        completed_work=7,
        iteration_path="Proyecto\\Sprint 2",
    )

    resp = await cliente.get(
        "/api/azdo/esquema/detalle-feature?id=101",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    por_sprint = {g["clave"]: g for g in resp.json()["por_sprint"]}
    assert set(por_sprint) == {"Proyecto\\Sprint 1", "Proyecto\\Sprint 2"}

    sprint1 = por_sprint["Proyecto\\Sprint 1"]
    assert sprint1["total_horas"] == 15
    assert sprint1["personas"][0] == {"email": "ana@hitss.com", "horas": 10}
    assert sprint1["personas"][1] == {"email": "beto@hitss.com", "horas": 5}

    sprint2 = por_sprint["Proyecto\\Sprint 2"]
    assert sprint2["total_horas"] == 7


async def test_detalle_feature_item_sin_iteration_path_cae_en_sin_sprint(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app, token = await _preparar_config(fabrica_aplicacion, fabrica_usuario)

    await _item(101, None, "Feature")
    await _item(201, 101, "User Story")
    await _item(301, 201, "Task", asignado_a="ana@hitss.com", completed_work=4, iteration_path="")
    await _item(
        302,
        201,
        "Task",
        asignado_a="beto@hitss.com",
        completed_work=6,
        iteration_path="Proyecto\\Sprint 1",
    )

    resp = await cliente.get(
        "/api/azdo/esquema/detalle-feature?id=101",
        headers=headers_con_token(token, app.codigo),
    )

    por_sprint = resp.json()["por_sprint"]
    # "Sin sprint" siempre al final.
    assert por_sprint[-1]["clave"] == "Sin sprint"
    assert por_sprint[-1]["total_horas"] == 4
    assert por_sprint[0]["clave"] == "Proyecto\\Sprint 1"


async def test_detalle_feature_agrupa_por_mes_derivado_de_fecha_inicio(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app, token = await _preparar_config(fabrica_aplicacion, fabrica_usuario)

    await _item(101, None, "Feature")
    await _item(201, 101, "User Story")
    await _item(
        301,
        201,
        "Task",
        asignado_a="ana@hitss.com",
        completed_work=3,
        fecha_inicio=datetime(2026, 5, 4, tzinfo=UTC),
    )
    await _item(
        302,
        201,
        "Bug",
        asignado_a="beto@hitss.com",
        completed_work=4,
        fecha_inicio=datetime(2026, 5, 20, tzinfo=UTC),
    )
    await _item(303, 201, "Task", asignado_a="ana@hitss.com", completed_work=8, fecha_inicio=None)

    resp = await cliente.get(
        "/api/azdo/esquema/detalle-feature?id=101",
        headers=headers_con_token(token, app.codigo),
    )

    por_mes = {g["clave"]: g for g in resp.json()["por_mes"]}
    assert set(por_mes) == {"2026-05", "Sin fecha"}
    assert por_mes["2026-05"]["total_horas"] == 7
    assert por_mes["Sin fecha"]["total_horas"] == 8
    # "Sin fecha" siempre al final.
    assert resp.json()["por_mes"][-1]["clave"] == "Sin fecha"


async def test_detalle_feature_ignora_tipos_fuera_de_task_y_bug(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app, token = await _preparar_config(fabrica_aplicacion, fabrica_usuario)

    await _item(101, None, "Feature")
    await _item(201, 101, "User Story")
    await _item(
        301,
        201,
        "Product Backlog Item",
        asignado_a="ana@hitss.com",
        completed_work=99,
        iteration_path="Proyecto\\Sprint 1",
        fecha_inicio=datetime(2026, 5, 4, tzinfo=UTC),
    )

    resp = await cliente.get(
        "/api/azdo/esquema/detalle-feature?id=101",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    assert resp.json() == {"por_sprint": [], "por_mes": []}


async def test_detalle_feature_sin_permiso_azure_devops_ver_pero_con_asignaciones_ver(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    """El permiso exigido es ``asignaciones.ver``, no ``azure_devops.ver``."""
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])

    resp = await cliente.get(
        "/api/azdo/esquema/detalle-feature?id=101",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 403

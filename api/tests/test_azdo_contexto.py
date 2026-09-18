# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de Azure DevOps en contexto multi-aplicación consolidado."""
from app.documents.azdo_config import AzdoConfig
from app.services.azure_devops import AzureDevOpsService
from tests.conftest import CONSOLIDADO, headers_con_token


async def test_azdo_test_en_consolidado_no_devuelve_409(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    await AzdoConfig(
        aplicacion_id=app_a.codigo,
        scope="app",
        org_url="https://dev.azure.com/test",
        pat="pat-test",
    ).insert()

    async def _test_conexion(self):
        return {"ok": True}

    monkeypatch.setattr(AzureDevOpsService, "test_conexion", _test_conexion)

    _, token = await fabrica_usuario(
        [app_a.codigo, app_b.codigo],
        permisos=["azure_devops.ver", "consolidado.ver"],
    )
    resp = await cliente.get(
        "/api/azdo/test",
        headers=headers_con_token(token, CONSOLIDADO),
    )

    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


async def test_azdo_config_consolidado_resuelve_segunda_config_valida(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    await AzdoConfig(
        aplicacion_id=app_a.codigo,
        scope="app",
        org_url="https://dev.azure.com/sin-pat",
        pat="",
        default_project="Proyecto A",
    ).insert()
    await AzdoConfig(
        aplicacion_id=app_b.codigo,
        scope="app",
        org_url="https://dev.azure.com/con-pat",
        pat="pat-test",
        default_project="Proyecto B",
    ).insert()

    _, token = await fabrica_usuario(
        [app_a.codigo, app_b.codigo],
        permisos=["azure_devops.ver", "consolidado.ver"],
    )
    resp = await cliente.get(
        "/api/azdo/config",
        headers=headers_con_token(token, CONSOLIDADO),
    )

    assert resp.status_code == 200
    datos = resp.json()
    assert datos["org_url"] == "https://dev.azure.com/con-pat"
    assert datos["pat_guardado"] is True
    assert datos["default_project"] == "Proyecto B"


async def test_tipos_config_consolidado_guarda_y_recupera_sin_409(
    cliente, fabrica_usuario, fabrica_aplicacion, monkeypatch
):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    await AzdoConfig(
        aplicacion_id=app_a.codigo,
        scope="app",
        org_url="https://dev.azure.com/sin-pat",
        pat="",
        default_project="Proyecto A",
    ).insert()
    await AzdoConfig(
        aplicacion_id=app_b.codigo,
        scope="app",
        org_url="https://dev.azure.com/con-pat",
        pat="pat-test",
        default_project="Proyecto B",
    ).insert()

    async def _tipos_proceso(self, proyecto):
        return [
            {"nombre": "Epic", "referencia": "Epic"},
            {"nombre": "Feature", "referencia": "Feature"},
            {"nombre": "Task", "referencia": "Task"},
        ]

    monkeypatch.setattr(AzureDevOpsService, "obtener_tipos_proceso", _tipos_proceso)

    _, token = await fabrica_usuario(
        [app_a.codigo, app_b.codigo],
        permisos=["azure_devops.ver", "azure_devops.editar", "consolidado.ver"],
    )
    resp_guardar = await cliente.put(
        "/api/azdo/esquema/tipos-config",
        json={"activos": ["Task", "Feature"]},
        headers=headers_con_token(token, CONSOLIDADO),
    )
    resp_leer = await cliente.get(
        "/api/azdo/esquema/tipos-config",
        headers=headers_con_token(token, CONSOLIDADO),
    )

    assert resp_guardar.status_code == 200
    assert resp_guardar.json()["proyecto"] == "Proyecto B"
    assert resp_guardar.json()["activos"] == ["Task", "Feature"]
    assert resp_leer.status_code == 200
    assert resp_leer.json()["activos"] == ["Task", "Feature"]


async def test_azdo_sync_en_consolidado_sigue_devolviendo_409(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()

    _, token = await fabrica_usuario(
        [app_a.codigo, app_b.codigo],
        permisos=["azure_devops.editar", "consolidado.ver"],
    )
    resp = await cliente.post(
        "/api/azdo/sync",
        json={
            "azdo_project": "Proyecto",
            "iteration_path": "Proyecto\\Sprint 1",
            "target": "hitss",
        },
        headers=headers_con_token(token, CONSOLIDADO),
    )

    assert resp.status_code == 409
